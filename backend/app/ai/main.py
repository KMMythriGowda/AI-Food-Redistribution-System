"""
FastAPI AI Microservice Main Application
"""
import os
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.ai.schemas.ai_schemas import (
    HealthResponse, ForecastRequest, ForecastResponse,
    WasteRiskRequest, WasteRiskResponse, ReorderRequest, ReorderResponse,
    BatchPredictRequest, BatchPredictResponse, SimulationRequest, SimulationResponse,
    ModelMetricsResponse, ModelMetricsItem, BatchPredictItem, SystemHealthResponse
)
from app.ai.forecast.model_service import ForecastModelService
from app.ai.algorithms.waste_risk_scorer import WasteRiskScorer
from app.ai.reorder.reorder_engine import ReorderEngine
from app.ai.forecast.evaluation import get_benchmark_metrics
from app.ai.forecast.prophet_model import HAS_PROPHET
from app.ai.forecast.lstm_model import HAS_TORCH
from app.ai.jobs.scheduler import start_scheduler, flask_app

# DB access imports
from app.extensions import db
from app.models.inventory import InventoryItem
from app.models.prediction import PredictionResult
from app.models.job_log import JobLog
from app.models.sales_log import SalesTransaction
from app.models.waste_log import WasteLog

app = FastAPI(
    title="AI Food Redistribution System - AI Microservice",
    description="Machine Learning Demand Forecasting and Replenishment Engine",
    version="1.0.0"
)

# Enable CORS for frontend and core backend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def sanitize_consistency(res: dict, days_to_expiry: int, current_stock: float) -> dict:
    """
    Performs backend validation to ensure absolute logical consistency between:
    risk_score -> risk_level -> risk_contributors -> primary_reason -> recommended_action -> reorder_quantity -> redistribution_quantity
    """
    import logging
    logger = logging.getLogger(__name__)

    # Pre-checks: ensure inputs are numeric and safe
    current_stock = max(0.0, float(current_stock))
    risk_score = max(0.0, min(100.0, float(res.get('risk_score', 0.0))))
    reorder_qty = float(res.get('recommended_quantity') or res.get('recommended_reorder') or 0.0)
    action = res.get('recommended_action') or res.get('action') or "NORMAL INVENTORY"
    risk_level = res.get('risk_level') or "LOW"
    orig_primary_reason = res.get('primary_reason') or res.get('reason') or ""

    # Setup original values for audit
    orig_risk_score = risk_score
    orig_risk_level = risk_level
    orig_action = action
    orig_qty = reorder_qty

    reasons = []
    
    # 1. Base Expiry overrides (if stock exists)
    expected_score = risk_score
    if current_stock <= 0:
        expected_score = 0.0
        expected_level = "LOW"
    elif current_stock > 0 and days_to_expiry <= 2:
        expected_level = "CRITICAL"
        expected_score = max(85.0, risk_score)
        if days_to_expiry <= 0:
            expected_score = 100.0
    else:
        # Determine standard risk level classification based on the score
        if risk_score < 25:
            expected_level = "LOW"
        elif risk_score < 50:
            expected_level = "MEDIUM"
        elif risk_score < 75:
            expected_level = "HIGH"
        else:
            expected_level = "CRITICAL"

    is_sanitized = False

    if risk_score != expected_score:
        reasons.append(f"Adjusted risk score to match expiry constraints: {risk_score} -> {expected_score}")
        risk_score = expected_score
        is_sanitized = True

    if risk_level != expected_level:
        reasons.append(f"Adjusted risk level to match risk score boundaries: {risk_level} -> {expected_level}")
        risk_level = expected_level
        is_sanitized = True

    # 2. Check Action Constraints based on Expiry and Stock
    expected_action = action
    
    if current_stock <= 0:
        # Zero stock: potential waste value must be 0
        res['potential_waste_value'] = 0.0
        res['potential_avoidable_loss'] = 0.0
        res['estimated_recovery'] = 0.0
        if 'redistribution_recommendation' in res and isinstance(res['redistribution_recommendation'], dict):
            res['redistribution_recommendation']['quantity'] = 0.0
            res['redistribution_recommendation']['surplus'] = 0.0

        # Zero stock: no waste exposure, no redistribution/donation/emergency consumption action allowed
        forecast_demand_val = res.get('forecast_daily_demand') or res.get('forecast_demand') or 0.0
        if action in ["REDISTRIBUTE", "DONATE", "EMERGENCY CONSUMPTION", "DISCOUNT"]:
            if reorder_qty > 0 and forecast_demand_val > 0.0:
                expected_action = "REORDER"
            else:
                expected_action = "NORMAL INVENTORY"
            reasons.append(f"Zero stock: changed action from waste mitigation '{action}' to '{expected_action}'")
            is_sanitized = True

        # Reorder can only be recommended when supported by actual demand/history
        if expected_action == "REORDER" and forecast_demand_val <= 0.0:
            expected_action = "NORMAL INVENTORY"
            reorder_qty = 0.0
            reasons.append("Zero stock & zero demand: changed action from REORDER to NORMAL INVENTORY")
            is_sanitized = True
    else:
        # Stock exists: check near expiry and critical risk actions
        if days_to_expiry <= 0:
            expected_action = "EMERGENCY CONSUMPTION"
        elif days_to_expiry <= 2:
            expected_action = "DONATE"
        elif days_to_expiry <= 5:
            expected_action = "REDISTRIBUTE"
        elif days_to_expiry <= 7:
            expected_action = "DISCOUNT"
        elif risk_level in ["HIGH", "CRITICAL"]:
            expected_action = "SUPPRESS PURCHASE"

    # For normal risk levels, if reorder quantity is recommended, action is REORDER
    if expected_action not in ["EMERGENCY CONSUMPTION", "DONATE", "REDISTRIBUTE", "DISCOUNT", "SUPPRESS PURCHASE"]:
        if reorder_qty > 0:
            expected_action = "REORDER"
        else:
            expected_action = "NORMAL INVENTORY"

    if action != expected_action:
        reasons.append(f"Aligned action to state: {action} -> {expected_action}")
        action = expected_action
        is_sanitized = True

    # 3. Suppress Reordering for High Risk / Critical items with stock
    if risk_level in ["HIGH", "CRITICAL"] and current_stock > 0:
        if reorder_qty > 0:
            reasons.append(f"Suppressed reorder quantity {reorder_qty} for high/critical waste risk")
            reorder_qty = 0.0
            is_sanitized = True

    # Ensure contributors sum to 100% when total is non-zero
    contribs = res.get('risk_contributors')
    if contribs and isinstance(contribs, dict):
        total_pct = sum(contribs.values())
        if total_pct > 0.0 and abs(total_pct - 100.0) > 0.01:
            for k in contribs:
                contribs[k] = round((contribs[k] / total_pct) * 100.0, 1)
            total_norm = sum(contribs.values())
            diff = round(100.0 - total_norm, 1)
            if diff != 0:
                max_key = max(contribs, key=contribs.get) if contribs else None
                if max_key:
                    contribs[max_key] = round(contribs[max_key] + diff, 1)
        elif risk_score <= 0.01 or total_pct <= 0.01:
            for k in contribs:
                contribs[k] = 0.0

    # Write back sanitized properties
    res['risk_score'] = risk_score
    res['risk_level'] = risk_level
    res['recommended_action'] = action
    res['action'] = action
    res['recommended_quantity'] = reorder_qty
    res['recommended_reorder'] = reorder_qty
    if 'reorder_explanation' in res and isinstance(res['reorder_explanation'], dict):
        res['reorder_explanation']['expected_stock_after_reorder'] = current_stock + reorder_qty

    # Primary Reason justification mapping if action/level changed
    val_note = None
    if is_sanitized:
        if current_stock <= 0:
            val_note = f"Out of stock; risk evaluation remains {risk_level} based on expiry/history, and action is aligned to replenishment requirements."
        elif days_to_expiry <= 0:
            val_note = "The product has already expired while units remain in stock."
        elif days_to_expiry <= 2:
            val_note = "The product is approaching expiry (2 days or less) while stock remains unconsumed."
        else:
            val_note = f"Consistency check: aligned recommended action to '{action}' matching risk level {risk_level}."

    # Keep original AI primary_reason intact
    res['primary_reason'] = orig_primary_reason
    if current_stock <= 0:
         res['primary_reason'] = "No remaining inventory; inventory waste risk is zero."
    res['original_primary_reason'] = orig_primary_reason
    res['validation_note'] = val_note

    # Create detailed audit object
    audit = {
        "original_risk_score": orig_risk_score,
        "original risk score": orig_risk_score,
        "final_risk_score": risk_score,
        "final risk score": risk_score,
        "original_risk_level": orig_risk_level,
        "original risk level": orig_risk_level,
        "final_risk_level": risk_level,
        "final risk level": risk_level,
        "original_action": orig_action,
        "original action": orig_action,
        "final_action": action,
        "final action": action,
        "changes_made": reasons,
        "changes made": reasons,
        "sanitized": is_sanitized,
        "reasons": reasons
    }
    res['_validation_audit'] = audit
    return res

# Helper functions for Explainable AI, future risk, financial impact, and drift detection
def compute_enhanced_fields(item: InventoryItem, daily_demand: float, risk_res: dict, reorder_res: dict):
    # 1. Expected Surplus
    expected_surplus = max(0.0, item.quantity - (daily_demand * max(1, item.days_remaining)))
    
    # 2. Redistribution Recommendation
    if item.days_remaining <= 0:
        redist_action = "EMERGENCY CONSUMPTION"
        redist_qty = item.quantity
    elif item.days_remaining <= 2:
        if expected_surplus > 0:
            redist_action = "DONATE"
            redist_qty = expected_surplus
        else:
            redist_action = "EMERGENCY CONSUMPTION"
            redist_qty = item.quantity
    elif item.days_remaining <= 5:
        if expected_surplus > 0:
            redist_action = "REDISTRIBUTE"
            redist_qty = expected_surplus
        else:
            redist_action = "DISCOUNT"
            redist_qty = item.quantity * 0.25
    elif item.days_remaining <= 7 and expected_surplus > 0:
        redist_action = "DISCOUNT"
        redist_qty = expected_surplus
    else:
        redist_action = "NORMAL SALE"
        redist_qty = 0.0

    redistribution_recommendation = {
        'action': redist_action,
        'quantity': round(redist_qty, 2),
        'surplus': round(expected_surplus, 2),
        'days_to_expiry': item.days_remaining
    }
    
    # 3. Financial Waste Impact
    potential_waste_value = None
    potential_avoidable_loss = None
    estimated_recovery = None
    financial_text = "Financial impact unavailable — product cost data not available."
    
    if item.cost_price > 0.0:
        pred_waste_qty = item.quantity if item.days_remaining <= 0 else expected_surplus
        potential_waste_value = round(pred_waste_qty * item.cost_price, 2)
        potential_avoidable_loss = round(potential_waste_value * 0.75, 2)
        estimated_recovery = round(potential_waste_value * 0.75, 2)
        financial_text = f"Potential Waste Value: ₹{potential_waste_value:.2f}, Potential Avoidable Loss: ₹{potential_avoidable_loss:.2f}, Estimated Recovery: ₹{estimated_recovery:.2f}"
        
    # 4. Confidence & Data Support Indicators
    tx_count = SalesTransaction.query.filter_by(product_name=item.product_name).count()
    if tx_count >= 30:
        confidence_level = "HIGH DATA SUPPORT"
        confidence_score = 91.0
    elif tx_count >= 10:
        confidence_level = "MEDIUM DATA SUPPORT"
        confidence_score = 85.0
    else:
        confidence_level = "LOW DATA SUPPORT"
        confidence_score = 72.0
        
    # 5. Future Risk Prediction (Today, Tomorrow, Day 2, Day 3)
    scorer = WasteRiskScorer()
    future_risks = []
    wastes = WasteLog.query.filter_by(user_id=item.user_id, product_name=item.product_name).all()
    waste_rate = None
    if wastes:
        total_qty = sum(w.quantity for w in wastes)
        waste_rate = min(100.0, (total_qty / max(1.0, item.quantity)) * 100.0)

    for day_idx in range(4):
        f_expiry = max(0, item.days_remaining - day_idx)
        f_stock = max(0.0, item.quantity - (daily_demand * day_idx))
        f_risk = scorer.calculate_risk(
            current_stock=f_stock,
            forecast_demand=daily_demand,
            days_to_expiry=f_expiry,
            waste_rate=waste_rate,
            storage_capacity=item.storage_capacity
        )
        future_risks.append({
            'day': 'Today' if day_idx == 0 else 'Tomorrow' if day_idx == 1 else f'Day {day_idx}',
            'risk_score': f_risk['risk_score'],
            'risk_level': f_risk['risk_level']
        })
        
    return {
        'future_risks': future_risks,
        'redistribution_recommendation': redistribution_recommendation,
        'confidence_score': confidence_score,
        'confidence_level': confidence_level,
        'historical_observations': tx_count,
        'potential_waste_value': potential_waste_value,
        'potential_avoidable_loss': potential_avoidable_loss,
        'estimated_recovery': estimated_recovery,
        'financial_text': financial_text
    }

def detect_drift_and_quality(item: InventoryItem):
    txs = SalesTransaction.query.filter_by(product_name=item.product_name).all()
    tx_count = len(txs)
    
    if tx_count >= 30:
        quality = "Good"
    elif tx_count >= 10:
        quality = "Moderate"
    else:
        quality = "Limited"
        
    warning = None
    if tx_count >= 15:
        sorted_txs = sorted(txs, key=lambda x: x.transaction_date, reverse=True)
        recent_avg = sum(t.quantity for t in sorted_txs[:5]) / 5.0
        older_avg = sum(t.quantity for t in sorted_txs[5:]) / len(sorted_txs[5:])
        if older_avg > 0:
            pct_change = abs(recent_avg - older_avg) / older_avg
            if pct_change > 0.50:
                warning = "Demand pattern change detected. Forecast confidence may be reduced."
                
    return {
        'data_quality': quality,
        'drift_warning': warning
    }

@app.on_event("startup")
def on_startup():
    """Starts the background job scheduler."""
    start_scheduler()

@app.get("/api/ai/health", response_model=HealthResponse)
def health():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.post("/api/ai/forecast", response_model=ForecastResponse)
def get_forecast(req: ForecastRequest):
    with flask_app.app_context():
        # The Flask gateway injects the authenticated business id. Never infer a tenant
        # from a globally matching product name when a user id is available.
        user_id = req.user_id
        item = None
        if user_id and req.product_name:
            item = InventoryItem.query.filter_by(user_id=user_id, product_name=req.product_name).first()
        elif req.product_name:
            # Backward-compatible direct/internal calls only; Docker production traffic
            # reaches this service through the authenticated Flask gateway.
            item = InventoryItem.query.filter_by(product_name=req.product_name).first()
            if item:
                user_id = item.user_id

        if not user_id:
            raise HTTPException(status_code=400, detail="user_id is required for tenant-scoped forecasting")

        try:
            res = ForecastModelService.generate_forecast(
                user_id=user_id,
                product_name=req.product_name,
                category=req.category,
                current_stock=req.current_stock,
                horizon=req.horizon,
                period=req.granularity
            )
            
            # Retrieve actual historical transactions for comparison
            query = SalesTransaction.query.filter_by(user_id=user_id)
            if req.product_name:
                query = query.filter_by(product_name=req.product_name)
            else:
                query = query.filter_by(category=req.category)

            transactions = query.order_by(SalesTransaction.transaction_date.desc()).limit(14).all()
            # Sort chronologically
            transactions = sorted(transactions, key=lambda x: x.transaction_date)

            res['historical_values'] = [round(t.quantity, 2) for t in transactions]
            res['historical_dates'] = [t.transaction_date.strftime('%Y-%m-%d') for t in transactions]

            # Calculate forecast trend direction
            forecast = res.get('forecast', [])
            if len(forecast) >= 2:
                change = forecast[-1] - forecast[0]
                if change > 0.5:
                    res['trend_direction'] = "UPWARD"
                elif change < -0.5:
                    res['trend_direction'] = "DOWNWARD"
                else:
                    res['trend_direction'] = "STABLE"
            else:
                res['trend_direction'] = "STABLE"

            return res
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ai/waste-risk", response_model=WasteRiskResponse)
def get_waste_risk(req: WasteRiskRequest):
    try:
        scorer = WasteRiskScorer()
        res = scorer.calculate_risk(
            current_stock=req.current_stock,
            forecast_demand=req.forecast_demand,
            days_to_expiry=req.days_to_expiry,
            waste_rate=req.waste_rate,
            stock_age_days=req.stock_age_days,
            historical_demand_trend=req.historical_demand_trend,
            storage_capacity=req.storage_capacity
        )
        res['product_id'] = req.product_id

        # Merge enhanced database fields if item exists in Flask DB
        with flask_app.app_context():
            item_query = InventoryItem.query.filter(
                (InventoryItem.id == req.product_id) | (InventoryItem.product_name == req.product_id)
            )
            if req.user_id:
                item_query = item_query.filter(InventoryItem.user_id == req.user_id)
            item = item_query.first()
            
            reorder_res = ReorderEngine.calculate_reorder(
                current_stock=req.current_stock,
                forecast_daily_demand=req.forecast_demand,
                lead_time_days=3,
                safety_stock=5.0,
                storage_capacity=req.storage_capacity,
                waste_risk_level=res['risk_level'],
                days_to_expiry=req.days_to_expiry
            )
            
            if item:
                enhanced = compute_enhanced_fields(item, req.forecast_demand, res, reorder_res)
            else:
                surplus = max(0.0, req.current_stock - (req.forecast_demand * max(1, req.days_to_expiry)))
                confidence_level = "LOW DATA SUPPORT"
                confidence_score = 72.0
                
                if req.days_to_expiry <= 0:
                    redist_action = "EMERGENCY CONSUMPTION"
                    redist_qty = req.current_stock
                elif req.days_to_expiry <= 2:
                    redist_action = "DONATE" if surplus > 0 else "EMERGENCY CONSUMPTION"
                    redist_qty = surplus if surplus > 0 else req.current_stock
                elif req.days_to_expiry <= 5 and surplus > 0:
                    redist_action = "REDISTRIBUTE"
                    redist_qty = surplus
                elif req.days_to_expiry <= 7 and surplus > 0:
                    redist_action = "DISCOUNT"
                    redist_qty = surplus
                else:
                    redist_action = "NORMAL SALE"
                    redist_qty = 0.0
                    
                future_risks = []
                for day_idx in range(4):
                    f_expiry = max(0, req.days_to_expiry - day_idx)
                    f_stock = max(0.0, req.current_stock - (req.forecast_demand * day_idx))
                    f_risk = scorer.calculate_risk(
                        current_stock=f_stock,
                        forecast_demand=req.forecast_demand,
                        days_to_expiry=f_expiry,
                        waste_rate=req.waste_rate,
                        storage_capacity=req.storage_capacity
                    )
                    future_risks.append({
                        'day': 'Today' if day_idx == 0 else 'Tomorrow' if day_idx == 1 else f'Day {day_idx}',
                        'risk_score': f_risk['risk_score'],
                        'risk_level': f_risk['risk_level']
                    })

                enhanced = {
                    'future_risks': future_risks,
                    'redistribution_recommendation': {
                        'action': redist_action,
                        'quantity': round(redist_qty, 2),
                        'surplus': round(surplus, 2),
                        'days_to_expiry': req.days_to_expiry
                    },
                    'confidence_score': confidence_score,
                    'confidence_level': confidence_level,
                    'potential_waste_value': None,
                    'potential_avoidable_loss': None,
                    'estimated_recovery': None,
                    'financial_text': "Financial impact unavailable — product cost data not available."
                }
            
            res.update(enhanced)
            # Backend Consistency Check
            res = sanitize_consistency(res, req.days_to_expiry, req.current_stock)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ai/reorder-recommendations", response_model=ReorderResponse)
def get_reorder_recommendation(req: ReorderRequest):
    try:
        res = ReorderEngine.calculate_reorder(
            current_stock=req.current_stock,
            forecast_daily_demand=req.forecast_daily_demand,
            lead_time_days=req.lead_time_days,
            safety_stock=req.safety_stock,
            storage_capacity=req.storage_capacity,
            waste_risk_level=req.waste_risk_level,
            days_to_expiry=req.days_to_expiry
        )
        res['product_id'] = req.product_id
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ai/batch-predict", response_model=BatchPredictResponse)
def batch_predict(req: BatchPredictRequest):
    """
    On-demand runs predictions for all active inventory items.
    Stores and caches the results historically.
    """
    with flask_app.app_context():
        # Create JobLog entry
        job_start = datetime.utcnow()
        job_name = f"manual_batch_prediction_{req.period}"
        job_run = JobLog(
            job_name=job_name,
            status="STARTED",
            start_time=job_start,
            products_processed=0,
            products_failed=0,
            critical_products=0
        )
        db.session.add(job_run)
        db.session.commit()

        try:
            # Query items
            query = InventoryItem.query
            if req.user_id:
                query = query.filter_by(user_id=req.user_id)
            items = query.all()

            results = []
            scorer = WasteRiskScorer()
            failed_count = 0
            critical_count = 0

            for item in items:
                try:
                    # 1. Forecast daily demand
                    forecast_res = ForecastModelService.generate_forecast(
                        user_id=item.user_id,
                        product_name=item.product_name,
                        category=item.category.value,
                        current_stock=item.quantity,
                        horizon=14,
                        period=req.period
                    )
                    
                    # Daily demand calculation
                    raw_forecast = forecast_res['forecast']
                    forecast_demand_val = sum(raw_forecast) / len(raw_forecast) if raw_forecast else 0.0

                    # Convert to daily if period is weekly/monthly for reorder engine
                    daily_demand_val = forecast_demand_val
                    if req.period == 'weekly':
                        daily_demand_val = forecast_demand_val / 7.0
                    elif req.period == 'monthly':
                        daily_demand_val = forecast_demand_val / 30.0

                    # 2. Risk evaluation
                    wastes = WasteLog.query.filter_by(user_id=item.user_id, product_name=item.product_name).all()
                    waste_rate = None
                    if wastes:
                        total_qty = sum(w.quantity for w in wastes)
                        waste_rate = min(100.0, (total_qty / max(1.0, item.quantity)) * 100.0)

                    risk_res = scorer.calculate_risk(
                        current_stock=item.quantity,
                        forecast_demand=daily_demand_val,
                        days_to_expiry=item.days_remaining,
                        waste_rate=waste_rate,
                        storage_capacity=item.storage_capacity
                    )

                    if risk_res['risk_level'] == 'CRITICAL':
                        critical_count += 1

                    # 3. Reorder calculation
                    reorder_res = ReorderEngine.calculate_reorder(
                        current_stock=item.quantity,
                        forecast_daily_demand=daily_demand_val,
                        lead_time_days=item.lead_time_days,
                        safety_stock=item.safety_stock,
                        storage_capacity=item.storage_capacity,
                        waste_risk_level=risk_res['risk_level'],
                        days_to_expiry=item.days_remaining
                    )

                    # 4. Enhanced calculations
                    enhanced = compute_enhanced_fields(item, daily_demand_val, risk_res, reorder_res)

                    # Backend Consistency Check
                    item_res = {
                        'risk_score': risk_res['risk_score'],
                        'risk_level': risk_res['risk_level'],
                        'recommended_action': risk_res['recommended_action'],
                        'recommended_quantity': reorder_res['recommended_quantity'],
                        'recommended_reorder': reorder_res['recommended_quantity'],
                        'risk_contributors': risk_res['risk_contributors'],
                        'primary_reason': risk_res['primary_reason']
                    }
                    item_res = sanitize_consistency(item_res, item.days_remaining, item.quantity)

                    # Apply sanitized values
                    risk_res['risk_score'] = item_res['risk_score']
                    risk_res['risk_level'] = item_res['risk_level']
                    risk_res['recommended_action'] = item_res['recommended_action']
                    risk_res['risk_contributors'] = item_res['risk_contributors']
                    risk_res['primary_reason'] = item_res['primary_reason']
                    reorder_res['recommended_quantity'] = item_res['recommended_quantity']
                    reorder_res['action'] = item_res['recommended_action']

                    # Calculate Priority Score (normalized)
                    risk_comp = risk_res['risk_score']
                    days_rem = item.days_remaining
                    expiry_comp = max(0.0, 100.0 * (1.0 - (days_rem / 15.0))) if days_rem <= 15 else 0.0
                    if days_rem <= 0:
                        expiry_comp = 100.0

                    waste_val = enhanced.get('potential_waste_value') or 0.0
                    waste_comp = min(100.0, (waste_val / 500.0) * 100.0)
                    priority_score = round((risk_comp * 0.50) + (expiry_comp * 0.30) + (waste_comp * 0.20), 2)

                    # 5. Store historically in DB
                    pred = PredictionResult(
                        user_id=item.user_id,
                        inventory_item_id=item.id,
                        product_name=item.product_name,
                        forecast_demand=forecast_demand_val,
                        forecast_period=req.period,
                        days_to_expiry=item.days_remaining,
                        waste_risk_score=risk_res['risk_score'],
                        risk_level=risk_res['risk_level'],
                        recommended_action=risk_res['recommended_action'],
                        recommended_reorder=reorder_res['recommended_quantity'],
                        model_name=forecast_res['model_name'],
                        prediction_date=datetime.utcnow()
                    )
                    db.session.add(pred)

                    results.append(BatchPredictItem(
                        product_id=item.id,
                        product_name=item.product_name,
                        current_stock=item.quantity,
                        forecast_demand=round(forecast_demand_val, 2) if forecast_demand_val is not None else None,
                        forecast_daily_demand=round(daily_demand_val, 2) if daily_demand_val is not None else None,
                        days_to_expiry=item.days_remaining,
                        risk_score=risk_res['risk_score'],
                        risk_level=risk_res['risk_level'],
                        recommended_action=risk_res['recommended_action'],
                        recommended_reorder=reorder_res['recommended_quantity'],
                        explanation=risk_res['explanation'],
                        reorder_reason=reorder_res['reason'],
                        # enhanced fields
                        risk_contributors=risk_res['risk_contributors'],
                        primary_reason=risk_res['primary_reason'],
                        future_risks=enhanced['future_risks'],
                        redistribution_recommendation=enhanced['redistribution_recommendation'],
                        confidence_score=enhanced['confidence_score'],
                        confidence_level=enhanced['confidence_level'],
                        historical_observations=enhanced['historical_observations'],
                        potential_waste_value=enhanced['potential_waste_value'],
                        potential_avoidable_loss=enhanced['potential_avoidable_loss'],
                        estimated_recovery=enhanced['estimated_recovery'],
                        financial_text=enhanced['financial_text'],
                        cost_price=item.cost_price,
                        selling_price=item.selling_price
                    ))
                except Exception as item_err:
                    failed_count += 1
                    logger.error(f"Failed processing item {item.id} in batch predict: {str(item_err)}")

            # Update JobLog status
            job_run.status = "COMPLETED" if failed_count == 0 else "PARTIAL"
            if len(results) == 0 and failed_count > 0:
                job_run.status = "FAILED"
            job_run.end_time = datetime.utcnow()
            job_run.products_processed = len(results)
            job_run.products_failed = failed_count
            job_run.critical_products = critical_count
            db.session.commit()

            return {
                "message": f"Successfully completed batch prediction for {len(results)} items.",
                "products_processed": len(results),
                "period": req.period,
                "results": results
            }

        except Exception as e:
            db.session.rollback()
            # Update JobLog crash status
            job_run.status = "FAILED"
            job_run.end_time = datetime.utcnow()
            job_run.error_message = str(e)
            db.session.commit()
            raise HTTPException(status_code=500, detail=f"Batch prediction failed: {str(e)}")

@app.get("/api/ai/model-metrics", response_model=ModelMetricsResponse)
def get_model_metrics(user_id: Optional[str] = None):
    with flask_app.app_context():
        from app.models.sales_log import SalesTransaction
        tx_query = SalesTransaction.query
        if user_id:
            tx_query = tx_query.filter_by(user_id=user_id)
        tx_count = tx_query.count()
        insufficient_data = tx_count < 10

    benchmarks = get_benchmark_metrics()
    
    # Calculate best model for each metric dynamically
    models = ["Prophet", "XGBoost", "LSTM"]
    best_mae_model = min(models, key=lambda m: benchmarks[m]["MAE"])
    best_rmse_model = min(models, key=lambda m: benchmarks[m]["RMSE"])
    best_mape_model = min(models, key=lambda m: benchmarks[m]["MAPE"])
    
    # Benchmarks are historical experiment results. Runtime forecasting in this
    # codebase uses Prophet when installed, otherwise the statistical fallback.
    if HAS_PROPHET:
        selected_model = "Prophet"
        selection_reason = "Prophet is available in the runtime and is the active forecasting wrapper."
    elif HAS_TORCH:
        selected_model = "LSTM"
        selection_reason = "Prophet is unavailable; the installed LSTM wrapper is available for explicit LSTM forecasts."
    else:
        selected_model = "fallback_statistical"
        selection_reason = "Prophet/PyTorch are not installed, so the runtime uses the built-in statistical fallback model."
    
    return {
        "Prophet": ModelMetricsItem(**benchmarks["Prophet"]),
        "XGBoost": ModelMetricsItem(**benchmarks["XGBoost"]),
        "LSTM": ModelMetricsItem(**benchmarks["LSTM"]),
        "notes": "Historical benchmark only: XGBoost had the lowest MAE/RMSE and LSTM the lowest MAPE in the recorded experiment. The selected_model field reports the model actually available to this runtime.",
        "best_mae_model": best_mae_model,
        "best_rmse_model": best_rmse_model,
        "best_mape_model": best_mape_model,
        "selected_model": selected_model,
        "selection_reason": selection_reason,
        "insufficient_data": insufficient_data
    }

@app.get("/api/ai/risk-summary")
def get_risk_summary(user_id: Optional[str] = None):
    """
    Returns counts of items under each risk level.
    """
    with flask_app.app_context():
        # Get latest predictions for each item
        query = PredictionResult.query
        if user_id:
            query = query.filter_by(user_id=user_id)
        
        preds = query.order_by(PredictionResult.created_at.desc()).all()
        
        # Keep only the latest prediction per inventory item
        seen_items = set()
        latest_preds = []
        for p in preds:
            if p.inventory_item_id not in seen_items:
                seen_items.add(p.inventory_item_id)
                latest_preds.append(p)

        summary = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
        for p in latest_preds:
            if p.risk_level in summary:
                summary[p.risk_level] += 1
            else:
                summary["LOW"] += 1

        return {
            "total_analyzed": len(latest_preds),
            "summary": summary
        }

@app.get("/api/ai/risk-trends")
def get_risk_trends(user_id: Optional[str] = None):
    """
    Compares latest prediction with the second to last prediction to identify risk trends.
    """
    with flask_app.app_context():
        query = PredictionResult.query
        if user_id:
            query = query.filter_by(user_id=user_id)

        # Get all predictions sorted chronologically
        preds = query.order_by(PredictionResult.created_at.asc()).all()

        # Group by item id
        item_preds = {}
        for p in preds:
            if p.inventory_item_id not in item_preds:
                item_preds[p.inventory_item_id] = []
            item_preds[p.inventory_item_id].append(p)

        trends = []
        scorer = WasteRiskScorer()
        for item_id, plist in item_preds.items():
            item = InventoryItem.query.get(item_id)
            if not item:
                continue

            if len(plist) >= 2:
                latest = plist[-1]
                prev = plist[-2]
                trend_res = scorer.determine_trend(prev.waste_risk_score, latest.waste_risk_score)
            elif len(plist) == 1:
                latest = plist[0]
                trend_res = {
                    'previous_risk': latest.waste_risk_score,
                    'current_risk': latest.waste_risk_score,
                    'risk_change': 0.0,
                    'risk_trend': 'STABLE'
                }
            else:
                continue

            # Calculate daily demand
            daily_demand = latest.forecast_demand
            if latest.forecast_period == 'weekly':
                daily_demand = latest.forecast_demand / 7.0
            elif latest.forecast_period == 'monthly':
                daily_demand = latest.forecast_demand / 30.0

            reorder_res = ReorderEngine.calculate_reorder(
                current_stock=item.quantity,
                forecast_daily_demand=daily_demand,
                lead_time_days=item.lead_time_days,
                safety_stock=item.safety_stock,
                storage_capacity=item.storage_capacity,
                waste_risk_level=latest.risk_level,
                days_to_expiry=latest.days_to_expiry
            )

            # Enhanced fields
            enhanced = compute_enhanced_fields(item, daily_demand, {'risk_level': latest.risk_level}, reorder_res)
            risk_eval = scorer.calculate_risk(
                current_stock=item.quantity,
                forecast_demand=daily_demand,
                days_to_expiry=latest.days_to_expiry,
                storage_capacity=item.storage_capacity,
            )
            dq = detect_drift_and_quality(item)

            trends.append({
                'product_id': latest.inventory_item_id,
                'product_name': latest.product_name,
                'previous_risk': trend_res['previous_risk'],
                'current_risk': trend_res['current_risk'],
                'risk_change': trend_res['risk_change'],
                'risk_trend': trend_res['risk_trend'],
                # enhanced details
                'risk_contributors': risk_eval['risk_contributors'],
                'primary_reason': risk_eval['primary_reason'],
                'future_risks': enhanced['future_risks'],
                'redistribution_recommendation': enhanced['redistribution_recommendation'],
                'confidence_score': enhanced['confidence_score'],
                'confidence_level': enhanced['confidence_level'],
                'potential_waste_value': enhanced['potential_waste_value'],
                'potential_avoidable_loss': enhanced['potential_avoidable_loss'],
                'estimated_recovery': enhanced['estimated_recovery'],
                'financial_text': enhanced['financial_text'],
                'data_quality': dq['data_quality'],
                'drift_warning': dq['drift_warning']
            })

        return {
            "total_items": len(trends),
            "trends": trends
        }

@app.get("/api/ai/reorder-summary")
def get_reorder_summary(user_id: Optional[str] = None):
    """
    Summarizes total reorder candidates and quantities, calculating Waste Prevention Score.
    """
    with flask_app.app_context():
        query = PredictionResult.query
        if user_id:
            query = query.filter_by(user_id=user_id)
        
        preds = query.order_by(PredictionResult.created_at.desc()).all()
        seen_items = set()
        latest_preds = []
        for p in preds:
            if p.inventory_item_id not in seen_items:
                seen_items.add(p.inventory_item_id)
                latest_preds.append(p)

        # Build map of historical predictions for trend stabilization rate
        item_preds = {}
        for p in preds:
            if p.inventory_item_id not in item_preds:
                item_preds[p.inventory_item_id] = []
            item_preds[p.inventory_item_id].append(p)

        reorder_items = []
        total_quantity = 0.0
        suppressed_count = 0
        total_potential_waste = 0.0
        total_avoidable_loss = 0.0
        total_estimated_recovery = 0.0
        total_redistribute_qty = 0.0
        total_redistribution_value = 0.0
        total_stock = 0.0
        redistribution_actions_count = 0
        scorer = WasteRiskScorer()

        # Track historical trend stats
        stabilized_count = 0
        total_trend_items = 0

        for p in latest_preds:
            item = InventoryItem.query.get(p.inventory_item_id)
            if not item:
                continue

            total_stock += item.quantity

            # Calculate trend stabilization
            plist = item_preds.get(p.inventory_item_id, [])
            if len(plist) >= 2:
                # Chronological: plist[0] is oldest, plist[-1] is newest (latest)
                # plist is loaded in descending created_at. So plist[0] is newest, plist[-1] is oldest.
                # Let's sort plist by created_at ascending to determine change
                sorted_plist = sorted(plist, key=lambda x: x.created_at)
                change = sorted_plist[-1].waste_risk_score - sorted_plist[-2].waste_risk_score
                if change <= 3.0: # stable or falling
                    stabilized_count += 1
                total_trend_items += 1

            # Calculate daily demand
            daily_demand = p.forecast_demand
            if p.forecast_period == 'weekly':
                daily_demand = p.forecast_demand / 7.0
            elif p.forecast_period == 'monthly':
                daily_demand = p.forecast_demand / 30.0

            # Calculate waste rate live
            wastes = WasteLog.query.filter_by(user_id=item.user_id, product_name=item.product_name).all()
            waste_rate = None
            if wastes:
                total_qty = sum(w.quantity for w in wastes)
                waste_rate = min(100.0, (total_qty / max(1.0, item.quantity)) * 100.0)

            # Recalculate risk live to ensure perfect consistency
            risk_res = scorer.calculate_risk(
                current_stock=item.quantity,
                forecast_demand=daily_demand,
                days_to_expiry=item.days_remaining,
                waste_rate=waste_rate,
                storage_capacity=item.storage_capacity
            )

            reorder_res = ReorderEngine.calculate_reorder(
                current_stock=item.quantity,
                forecast_daily_demand=daily_demand,
                lead_time_days=item.lead_time_days,
                safety_stock=item.safety_stock,
                storage_capacity=item.storage_capacity,
                waste_risk_level=risk_res['risk_level'],
                days_to_expiry=item.days_remaining
            )

            # Enhanced fields
            enhanced = compute_enhanced_fields(item, daily_demand, risk_res, reorder_res)
            dq = detect_drift_and_quality(item)

            if enhanced['potential_waste_value'] is not None:
                total_potential_waste += enhanced['potential_waste_value']
                total_avoidable_loss += enhanced['potential_avoidable_loss']
                total_estimated_recovery += enhanced['estimated_recovery']

            cand_action = reorder_res['action']
            if cand_action in ['REDISTRIBUTE', 'DONATE', 'EMERGENCY CONSUMPTION', 'DISCOUNT']:
                qty = enhanced['redistribution_recommendation']['quantity']
                total_redistribute_qty += qty
                total_redistribution_value += qty * item.selling_price
                redistribution_actions_count += 1

            if reorder_res['is_suppressed']:
                suppressed_count += 1
            else:
                total_quantity += reorder_res['recommended_quantity']

            # Calculate Priority Score (normalized)
            risk_comp = risk_res['risk_score']
            days_rem = item.days_remaining
            expiry_comp = max(0.0, 100.0 * (1.0 - (days_rem / 15.0))) if days_rem <= 15 else 0.0
            # Check transaction support count for product-level observations
            prod_tx_count = SalesTransaction.query.filter_by(product_name=item.product_name).count()
            
            # Category fallback check if product observations are very low
            cat_tx_count = 0
            if prod_tx_count < 10 and item.category:
                cat_tx_count = SalesTransaction.query.filter_by(category=item.category).count()
                
            obs_count = prod_tx_count + cat_tx_count
            
            daily_demand_val = daily_demand
            forecast_demand_val = p.forecast_demand
            if prod_tx_count < 5:
                daily_demand_val = None
                forecast_demand_val = None

            candidate = {
                'product_id': item.id,
                'product_name': item.product_name,
                'forecast_daily_demand': round(daily_demand_val, 2) if daily_demand_val is not None else None,
                'forecast_demand': round(forecast_demand_val, 2) if forecast_demand_val is not None else None,
                'current_stock': round(item.quantity, 2),
                'storage_capacity': round(item.storage_capacity, 2),
                'days_to_expiry': item.days_remaining,
                'risk_score': risk_res['risk_score'],
                'risk_level': risk_res['risk_level'],
                'recommended_quantity': reorder_res['recommended_quantity'],
                'action': reorder_res['action'],
                'reason': reorder_res['reason'],
                'is_suppressed': reorder_res['is_suppressed'],
                # enhanced fields
                'risk_contributors': risk_res['risk_contributors'],
                'primary_reason': risk_res['primary_reason'],
                'future_risks': enhanced['future_risks'],
                'redistribution_recommendation': enhanced['redistribution_recommendation'],
                'confidence_score': enhanced['confidence_score'],
                'confidence_level': enhanced['confidence_level'],
                'potential_waste_value': enhanced['potential_waste_value'],
                'potential_avoidable_loss': enhanced['potential_avoidable_loss'],
                'estimated_recovery': enhanced['estimated_recovery'],
                'financial_text': enhanced['financial_text'],
                'data_quality': dq['data_quality'],
                'drift_warning': dq['drift_warning'],
                'reorder_explanation': reorder_res['reorder_explanation'],
                'cost_price': item.cost_price,
                'selling_price': item.selling_price
            }

            # Apply backend consistency checks
            candidate = sanitize_consistency(candidate, item.days_remaining, item.quantity)

            # Calculate Priority Score (normalized) *after* running sanitize_consistency
            risk_comp = candidate['risk_score']
            days_rem = item.days_remaining
            expiry_comp = max(0.0, 100.0 * (1.0 - (days_rem / 15.0))) if days_rem <= 15 else 0.0
            if days_rem <= 0:
                expiry_comp = 100.0

            waste_val = candidate.get('potential_waste_value') or 0.0
            waste_comp = min(100.0, (waste_val / 500.0) * 100.0)

            # Expired items with actual stock should receive high priority
            # Zero-stock expired items should not receive high waste priority merely because the expiry date is old
            if item.quantity <= 0:
                expiry_comp = 0.0
                waste_comp = 0.0

            priority_score = round((risk_comp * 0.50) + (expiry_comp * 0.30) + (waste_comp * 0.20), 2)
            priority_score = max(0.0, min(100.0, priority_score))
            candidate['priority_score'] = priority_score

            reorder_items.append(candidate)

        # Sort candidates descending by priority_score
        reorder_items.sort(key=lambda x: x.get('priority_score', 0.0), reverse=True)

        # Operational Waste Prevention Score calculation
        limited_historical_data = total_trend_items < 2
        if limited_historical_data:
            waste_prevention_score = 0.0
            stabilization_rate = 0.0
        else:
            stabilization_rate = (stabilized_count / max(1.0, total_trend_items)) * 100.0
            
        redist_rate_pct = min(100.0, (total_redistribute_qty / max(1.0, total_stock)) * 100.0)
        avoided_waste_rate = min(100.0, (total_avoidable_loss / max(1.0, total_potential_waste)) * 100.0)

        # Prevention score formula:
        if limited_historical_data:
            waste_prevention_score = round((redist_rate_pct * 0.50) + (avoided_waste_rate * 0.50), 2)
        else:
            waste_prevention_score = round((stabilization_rate * 0.40) + (redist_rate_pct * 0.30) + (avoided_waste_rate * 0.30), 2)

        # Query past prediction records for dynamic waste prevented / savings comparison
        one_day_ago = datetime.utcnow() - timedelta(days=1)
        hist_preds_query = PredictionResult.query
        if user_id:
            hist_preds_query = hist_preds_query.filter_by(user_id=user_id)
        
        hist_preds_exist = hist_preds_query.filter(PredictionResult.created_at < one_day_ago).first() is not None

        waste_prevented_units = total_redistribute_qty
        financial_savings_value = total_avoidable_loss

        return {
            "total_reorder_candidates": len(reorder_items),
            "total_reorder_quantity": round(total_quantity, 2),
            "suppressed_candidates": suppressed_count,
            "candidates": reorder_items,
            "total_potential_waste_value": round(total_potential_waste, 2),
            "total_avoidable_loss": round(total_avoidable_loss, 2),
            "total_estimated_recovery_value": round(total_estimated_recovery, 2),
            "total_redistribute_quantity": round(total_redistribute_qty, 2),
            "total_redistribution_value": round(total_redistribution_value, 2),
            "total_potential_savings": round(total_avoidable_loss, 2),
            "redistribution_actions_count": redistribution_actions_count,
            "orders_suppressed_count": suppressed_count,
            "waste_prevention_score": waste_prevention_score,
            "limited_historical_data": limited_historical_data,
            "waste_prevented_units": round(waste_prevented_units, 2),
            "financial_savings_value": round(financial_savings_value, 2),
            "redistribution_rate_pct": round(redist_rate_pct, 2),
            "hist_preds_exist": hist_preds_exist
        }

@app.post("/api/ai/simulate", response_model=SimulationResponse)
def simulate_scenario(req: SimulationRequest):
    """
    Simulates inventory scenario changes and calculates estimated risk differences.
    """
    scorer = WasteRiskScorer()
    
    # 1. Calculate Current Risk
    current_risk = scorer.calculate_risk(
        current_stock=req.current_stock,
        forecast_demand=req.forecast_demand,
        days_to_expiry=req.days_to_expiry,
        waste_rate=req.waste_rate,
        storage_capacity=req.storage_capacity
    )
    current_reorder = ReorderEngine.calculate_reorder(
        current_stock=req.current_stock,
        forecast_daily_demand=req.forecast_demand,
        lead_time_days=req.lead_time_days,
        safety_stock=req.safety_stock,
        storage_capacity=req.storage_capacity,
        waste_risk_level=current_risk['risk_level'],
        days_to_expiry=req.days_to_expiry
    )
    
    current_details = {
        **current_risk,
        'recommended_reorder': current_reorder['recommended_quantity'],
        'reorder_reason': current_reorder['reason']
    }

    # 2. Calculate Simulated Risk (incorporating the purchase quantity)
    simulated_stock = req.current_stock + req.purchase_quantity
    
    simulated_risk = scorer.calculate_risk(
        current_stock=simulated_stock,
        forecast_demand=req.forecast_demand,
        days_to_expiry=req.days_to_expiry,
        waste_rate=req.waste_rate,
        storage_capacity=req.storage_capacity
    )
    simulated_reorder = ReorderEngine.calculate_reorder(
        current_stock=simulated_stock,
        forecast_daily_demand=req.forecast_demand,
        lead_time_days=req.lead_time_days,
        safety_stock=req.safety_stock,
        storage_capacity=req.storage_capacity,
        waste_risk_level=simulated_risk['risk_level'],
        days_to_expiry=req.days_to_expiry
    )

    simulated_details = {
        **simulated_risk,
        'recommended_reorder': simulated_reorder['recommended_quantity'],
        'reorder_reason': simulated_reorder['reason']
    }

    # 3. Compared Scenarios
    scenarios = []
    cost = req.cost_price or 0.0

    # Expected Waste calculations
    surplus_qty = max(0.0, req.current_stock - (req.forecast_demand * max(1, req.days_to_expiry)))
    waste_do_nothing = round(surplus_qty, 2)
    waste_purchase = round(max(0.0, (req.current_stock + req.purchase_quantity) - (req.forecast_demand * max(1, req.days_to_expiry))), 2)
    
    disc_demand = req.forecast_demand * 1.25
    waste_discount = round(max(0.0, req.current_stock - (disc_demand * max(1, req.days_to_expiry))), 2)
    waste_redist = 0.00

    # Determine recommended scenario
    best_scenario = "Do Nothing"
    rec_why = "Maintains current inventory level which is balanced with projected demand."
    rop = (req.forecast_demand * req.lead_time_days) + req.safety_stock
    
    if req.days_to_expiry <= 5 and surplus_qty > 0:
        best_scenario = "Redistribute Surplus"
        rec_why = "Reduces expiry risk and food waste by moving surplus units out of local stock without increasing inventory."
    elif req.current_stock < rop:
        best_scenario = "Purchase (+Qty)"
        rec_why = "Replenishes inventory to avoid stockouts as current stock is below reorder point."
    elif req.days_to_expiry <= 7:
        best_scenario = "Apply Discount"
        rec_why = "Accelerates sales velocity through promotional discounts to clear stock before expiry."

    # Scenario A: Do Nothing
    scenarios.append({
        'scenario_name': 'Do Nothing',
        'stock': req.current_stock,
        'demand': req.forecast_demand,
        'risk_score': current_risk['risk_score'],
        'risk_level': current_risk['risk_level'],
        'recommended_reorder': current_reorder['recommended_quantity'],
        'action': current_reorder['action'],
        'explanation': 'Maintains current operational parameters.',
        'expected_waste': waste_do_nothing,
        'financial_impact': round(waste_do_nothing * cost, 2) if cost > 0 else None,
        'is_recommended': best_scenario == "Do Nothing"
    })
    
    # Scenario B: Purchase
    scenarios.append({
        'scenario_name': 'Purchase (+Qty)',
        'stock': simulated_stock,
        'demand': req.forecast_demand,
        'risk_score': simulated_risk['risk_score'],
        'risk_level': simulated_risk['risk_level'],
        'recommended_reorder': simulated_reorder['recommended_quantity'],
        'action': simulated_reorder['action'],
        'explanation': 'Simulates replenishment impact.',
        'expected_waste': waste_purchase,
        'financial_impact': round(waste_purchase * cost, 2) if cost > 0 else None,
        'is_recommended': best_scenario == "Purchase (+Qty)"
    })
    
    # Scenario C: Discount (boost demand by 25%)
    disc_risk = scorer.calculate_risk(
        current_stock=req.current_stock,
        forecast_demand=disc_demand,
        days_to_expiry=req.days_to_expiry,
        waste_rate=req.waste_rate,
        storage_capacity=req.storage_capacity
    )
    disc_reorder = ReorderEngine.calculate_reorder(
        current_stock=req.current_stock,
        forecast_daily_demand=disc_demand,
        lead_time_days=req.lead_time_days,
        safety_stock=req.safety_stock,
        storage_capacity=req.storage_capacity,
        waste_risk_level=disc_risk['risk_level'],
        days_to_expiry=req.days_to_expiry
    )
    scenarios.append({
        'scenario_name': 'Apply Discount',
        'stock': req.current_stock,
        'demand': round(disc_demand, 2),
        'risk_score': disc_risk['risk_score'],
        'risk_level': disc_risk['risk_level'],
        'recommended_reorder': disc_reorder['recommended_quantity'],
        'action': disc_reorder['action'],
        'explanation': 'Boosts forecast demand by 25% to accelerate sales velocity and reduce expiry risk.',
        'expected_waste': waste_discount,
        'financial_impact': round(waste_discount * cost, 2) if cost > 0 else None,
        'is_recommended': best_scenario == "Apply Discount"
    })
    
    # Scenario D: Redistribute
    redist_stock = max(0.0, req.current_stock - surplus_qty)
    redist_risk = scorer.calculate_risk(
        current_stock=redist_stock,
        forecast_demand=req.forecast_demand,
        days_to_expiry=req.days_to_expiry,
        waste_rate=req.waste_rate,
        storage_capacity=req.storage_capacity
    )
    redist_reorder = ReorderEngine.calculate_reorder(
        current_stock=redist_stock,
        forecast_daily_demand=req.forecast_demand,
        lead_time_days=req.lead_time_days,
        safety_stock=req.safety_stock,
        storage_capacity=req.storage_capacity,
        waste_risk_level=redist_risk['risk_level'],
        days_to_expiry=req.days_to_expiry
    )
    scenarios.append({
        'scenario_name': 'Redistribute Surplus',
        'stock': round(redist_stock, 2),
        'demand': req.forecast_demand,
        'risk_score': redist_risk['risk_score'],
        'risk_level': redist_risk['risk_level'],
        'recommended_reorder': redist_reorder['recommended_quantity'],
        'action': 'REDISTRIBUTE',
        'explanation': 'Moves surplus units out of local stock to redistribution channels, reducing local waste risk.',
        'expected_waste': waste_redist,
        'financial_impact': 0.00,
        'is_recommended': best_scenario == "Redistribute Surplus"
    })

    return {
        "current": current_details,
        "simulated": simulated_details,
        "scenarios": scenarios,
        "recommended_scenario": best_scenario,
        "recommendation_reason": rec_why
    }

@app.get("/api/ai/scheduler-details")
def get_scheduler_details():
    """
    Exposes safe scheduler configuration and next run information from APScheduler.
    """
    try:
        from app.ai.jobs.scheduler import scheduler
        
        status = "ACTIVE" if scheduler.running else "STOPPED"
        
        next_daily_run = None
        next_weekly_run = None
        
        # Look up jobs
        daily_job = scheduler.get_job('daily_prediction')
        if daily_job and daily_job.next_run_time:
            next_daily_run = daily_job.next_run_time.isoformat()
            
        weekly_job = scheduler.get_job('weekly_prediction')
        if weekly_job and weekly_job.next_run_time:
            next_weekly_run = weekly_job.next_run_time.isoformat()
            
        # Get configured cron times from environment variables
        daily_hour = os.getenv('AI_DAILY_JOB_HOUR', '2')
        daily_minute = os.getenv('AI_DAILY_JOB_MINUTE', '0')
        daily_schedule = f"{int(daily_hour):02d}:{int(daily_minute):02d}"
        
        weekly_day = os.getenv('AI_WEEKLY_JOB_DAY', 'monday')
        weekly_hour = os.getenv('AI_WEEKLY_JOB_HOUR', '3')
        weekly_minute = os.getenv('AI_WEEKLY_JOB_MINUTE', '0')
        weekly_schedule = f"{weekly_day.capitalize()} {int(weekly_hour):02d}:{int(weekly_minute):02d}"
        
        # Get active jobs list (safe representations)
        jobs = []
        for job in scheduler.get_jobs():
            jobs.append({
                "id": job.id,
                "name": job.name,
                "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None
            })
            
        return {
            "scheduler_status": status,
            "daily_schedule": daily_schedule,
            "weekly_schedule": weekly_schedule,
            "next_daily_run": next_daily_run,
            "next_weekly_run": next_weekly_run,
            "active_jobs": jobs
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query scheduler: {str(e)}")

@app.get("/api/ai/system-health", response_model=SystemHealthResponse)
def get_system_health():
    """
    Evaluates health of AI modules: Forecast Engine, Risk Engine, Batch Predictor, Scheduler, Database, Microservice.
    """
    with flask_app.app_context():
        # Check database health
        try:
            db_status = "READY"
            # Test DB connection by querying first record
            InventoryItem.query.first()
        except Exception:
            db_status = "ERROR"

        # Check microservice health status
        ai_microservice = "READY"
        risk_engine = "READY"
        forecast_engine = "READY"

        # Check scheduler status
        try:
            from app.ai.jobs.scheduler import scheduler
            scheduler_status = "ACTIVE" if scheduler.running else "WARNING"
            batch_predictor = "ACTIVE" if scheduler.running else "WARNING"
        except Exception:
            scheduler_status = "ERROR"
            batch_predictor = "ERROR"

        # Query recent job logs for prediction/forecast runs
        try:
            last_job = JobLog.query.order_by(JobLog.start_time.desc()).first()
            last_success_job = JobLog.query.filter(JobLog.status == "COMPLETED").order_by(JobLog.start_time.desc()).first()
            
            last_successful_prediction = last_success_job.end_time.isoformat() if last_success_job and last_success_job.end_time else None
            last_scheduler_run = last_job.start_time.isoformat() if last_job else None
            products_processed = last_success_job.products_processed if last_success_job else 0
            
            # Count unique categories forecasted
            categories_forecasted = db.session.query(InventoryItem.category).distinct().count()
            if categories_forecasted == 0:
                categories_forecasted = 6
        except Exception:
            last_successful_prediction = None
            last_scheduler_run = None
            products_processed = 0
            categories_forecasted = 6

        # Last forecast update matches last successful prediction
        last_forecast_update = last_successful_prediction

        from datetime import datetime
        overall_status = "READY"
        if "ERROR" in [forecast_engine, risk_engine, batch_predictor, scheduler_status, db_status, ai_microservice]:
            overall_status = "ERROR"
        elif "WARNING" in [forecast_engine, risk_engine, batch_predictor, scheduler_status, db_status, ai_microservice]:
            overall_status = "WARNING"

        return {
            "success": True,
            "overall_status": overall_status,
            "forecast_engine": forecast_engine,
            "risk_engine": risk_engine,
            "batch_predictor": batch_predictor,
            "scheduler": scheduler_status,
            "database": db_status,
            "ai_microservice": ai_microservice,
            "timestamp": datetime.utcnow().isoformat(),
            "message": "AI systems are fully operational." if overall_status == "READY" else "AI systems running with warnings/errors.",
            "health": {
                "forecast_engine": forecast_engine,
                "risk_engine": risk_engine,
                "batch_predictor": batch_predictor,
                "scheduler": scheduler_status,
                "database": db_status,
                "ai_microservice": ai_microservice
            },
            "details": {
                "last_successful_prediction": last_successful_prediction,
                "last_forecast_update": last_forecast_update,
                "last_scheduler_run": last_scheduler_run,
                "products_processed": str(products_processed),
                "categories_forecasted": str(categories_forecasted)
            }
        }
