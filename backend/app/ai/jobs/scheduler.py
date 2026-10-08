"""
AI Scheduled Jobs and Background Run Scheduler
"""
import os
import logging
from datetime import datetime, date, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app import create_app
from app.extensions import db
from app.models.inventory import InventoryItem
from app.models.prediction import PredictionResult
from app.models.job_log import JobLog
from app.models.sales_log import SalesTransaction
from app.models.waste_log import WasteLog
from app.models.notification import Notification
from app.ai.forecast.model_service import ForecastModelService
from app.ai.algorithms.waste_risk_scorer import WasteRiskScorer
from app.ai.reorder.reorder_engine import ReorderEngine

from flask import current_app, has_app_context

logger = logging.getLogger(__name__)

# Initialize a Flask app context for database access (fallback)
flask_app = create_app(os.getenv('FLASK_ENV', 'development'))

def get_app_context():
    if has_app_context():
        return current_app.app_context()
    return flask_app.app_context()

def sanitize_consistency(res: dict, days_to_expiry: int, current_stock: float) -> dict:
    """
    Performs backend validation to ensure absolute logical consistency between:
    risk_score -> risk_level -> risk_contributors -> primary_reason -> recommended_action -> reorder_quantity
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

    # Setup audit log
    reasons = []
    orig_risk_score = risk_score
    orig_risk_level = risk_level
    orig_action = action
    orig_qty = reorder_qty
    
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

def run_daily_prediction_job():
    """
    Refreshes forecasts, waste risks, and reorder recommendations for all products.
    """
    job_start = datetime.utcnow()
    job_name = "daily_prediction_job"
    
    with get_app_context():
        # Create JobLog entry
        job_run = JobLog(job_name=job_name, status="STARTED", start_time=job_start)
        db.session.add(job_run)
        db.session.commit()

        processed_count = 0
        failed_count = 0
        critical_count = 0
        high_risk_count = 0
        redistribution_opportunities = 0
        suppressed_count = 0
        potential_waste_value = 0.0
        estimated_recovery = 0.0
        error_msg = None

        try:
            # Fetch all active inventory items
            items = InventoryItem.query.all()
            for item in items:
                try:
                    # 1. Generate Demand Forecast (daily horizon = 14 days)
                    forecast_res = ForecastModelService.generate_forecast(
                        user_id=item.user_id,
                        product_name=item.product_name,
                        category=item.category.value,
                        current_stock=item.quantity,
                        horizon=14,
                        period='daily'
                    )
                    forecast_daily_demand = float(np_mean_safe(forecast_res['forecast']))

                    # 2. Query previous prediction for trend analysis
                    prev_pred = PredictionResult.query.filter_by(
                        inventory_item_id=item.id,
                        forecast_period='daily'
                    ).order_by(PredictionResult.created_at.desc()).first()

                    # 3. Calculate Risk
                    scorer = WasteRiskScorer()
                    # Query average waste rate if there are logs
                    wastes = WasteLog.query.filter_by(user_id=item.user_id, product_name=item.product_name).all()
                    waste_rate = None
                    if wastes:
                        total_qty = sum(w.quantity for w in wastes)
                        waste_rate = min(100.0, (total_qty / max(1.0, item.quantity)) * 100.0)

                    risk_res = scorer.calculate_risk(
                        current_stock=item.quantity,
                        forecast_demand=forecast_daily_demand,
                        days_to_expiry=item.days_remaining,
                        waste_rate=waste_rate,
                        storage_capacity=item.storage_capacity
                    )

                    # Normalize and run backend consistency checks
                    reorder_res = ReorderEngine.calculate_reorder(
                        current_stock=item.quantity,
                        forecast_daily_demand=forecast_daily_demand,
                        lead_time_days=item.lead_time_days,
                        safety_stock=item.safety_stock,
                        storage_capacity=item.storage_capacity,
                        waste_risk_level=risk_res['risk_level'],
                        days_to_expiry=item.days_remaining
                    )

                    # Gather calculations for report
                    expected_surplus = max(0.0, item.quantity - (forecast_daily_demand * max(1, item.days_remaining)))
                    if item.days_remaining <= 5 or (item.days_remaining <= 7 and expected_surplus > 0):
                        redistribution_opportunities += 1

                    if item.cost_price > 0.0:
                        pred_waste_qty = item.quantity if item.days_remaining <= 0 else expected_surplus
                        potential_waste_item = round(pred_waste_qty * item.cost_price, 2)
                        potential_waste_value += potential_waste_item
                        estimated_recovery += round(potential_waste_item * 0.40, 2)

                    # Consistency validation
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

                    # Update references
                    risk_res['risk_score'] = item_res['risk_score']
                    risk_res['risk_level'] = item_res['risk_level']
                    risk_res['recommended_action'] = item_res['recommended_action']
                    risk_res['risk_contributors'] = item_res['risk_contributors']
                    risk_res['primary_reason'] = item_res['primary_reason']
                    reorder_res['recommended_quantity'] = item_res['recommended_quantity']
                    reorder_res['action'] = item_res['recommended_action']

                    if risk_res['risk_level'] == 'CRITICAL':
                        critical_count += 1
                    elif risk_res['risk_level'] == 'HIGH':
                        high_risk_count += 1

                    if reorder_res['is_suppressed']:
                        suppressed_count += 1

                    # 5. Save historically (do not save priority_score to DB since column doesn't exist)
                    pred = PredictionResult(
                        user_id=item.user_id,
                        inventory_item_id=item.id,
                        product_name=item.product_name,
                        forecast_demand=forecast_daily_demand,
                        forecast_period='daily',
                        days_to_expiry=item.days_remaining,
                        waste_risk_score=risk_res['risk_score'],
                        risk_level=risk_res['risk_level'],
                        recommended_action=risk_res['recommended_action'],
                        recommended_reorder=reorder_res['recommended_quantity'],
                        model_name=forecast_res['model_name'],
                        prediction_date=datetime.utcnow()
                    )
                    db.session.add(pred)

                    # Automated Expiry Alert Logic
                    alert_threshold = int(os.getenv('EXPIRY_ALERT_THRESHOLD_DAYS', 3))
                    days = item.days_remaining

                    is_approaching = (days >= 0 and days <= alert_threshold)
                    is_expired = (days < 0)

                    if is_approaching or is_expired:
                        event_type = "expired" if is_expired else f"approaching_{alert_threshold}_days"
                        time_limit = datetime.utcnow() - timedelta(days=7)
                        existing_notif = Notification.query.filter(
                            Notification.user_id == item.user_id,
                            Notification.title.like(f"%[{item.product_name} - {event_type}]%"),
                            Notification.created_at >= time_limit
                        ).first()

                        if not existing_notif:
                            title = f"[{item.product_name} - {event_type}] Expiry Warning: {item.product_name}" if is_approaching else f"[{item.product_name} - {event_type}] Expired Product Alert: {item.product_name}"
                            if is_expired:
                                message = f"The product '{item.product_name}' (Quantity: {item.quantity} {item.unit}) expired {abs(days)} days ago on {item.expiry_date}."
                            else:
                                message = f"The product '{item.product_name}' (Quantity: {item.quantity} {item.unit}) is approaching expiry in {days} days on {item.expiry_date}."
                            
                            new_notif = Notification(user_id=item.user_id, title=title, message=message)
                            db.session.add(new_notif)

                    processed_count += 1

                except Exception as e:
                    failed_count += 1
                    logger.error(f"Error processing item {item.id} in daily job: {str(e)}")
                    error_msg = f"Failed on item {item.id}: {str(e)}"

            # Finalize JobLog
            job_run.status = "COMPLETED" if failed_count == 0 else "PARTIAL"
            if processed_count == 0 and failed_count > 0:
                job_run.status = "FAILED"
            job_run.end_time = datetime.utcnow()
            job_run.products_processed = processed_count
            job_run.products_failed = failed_count
            job_run.critical_products = critical_count
            
            if job_run.status in ["COMPLETED", "PARTIAL"]:
                # Successful run: store structured Operations Report JSON
                import json
                report_data = {
                    "report_type": "operations_report",
                    "execution_duration": round((job_run.end_time - job_run.start_time).total_seconds(), 2),
                    "items_processed": processed_count,
                    "critical_items": critical_count,
                    "high_risk_items": high_risk_count,
                    "redistribution_opportunities": redistribution_opportunities,
                    "suppressed_orders": suppressed_count,
                    "potential_waste_value": round(potential_waste_value, 2),
                    "estimated_recovery": round(estimated_recovery, 2)
                }
                job_run.error_message = json.dumps(report_data)
            else:
                job_run.error_message = error_msg
            
            db.session.commit()
            logger.info(f"Daily prediction job completed. Processed: {processed_count}, Failed: {failed_count}")

        except Exception as e:
            job_run.status = "FAILED"
            job_run.end_time = datetime.utcnow()
            job_run.error_message = f"Job crashed: {str(e)}"
            db.session.commit()
            logger.error(f"Daily prediction job failed to execute: {str(e)}")

def run_weekly_prediction_job():
    """
    Generates weekly aggregated forecasts and trends summaries.
    """
    job_start = datetime.utcnow()
    job_name = "weekly_prediction_job"
    
    with get_app_context():
        job_run = JobLog(job_name=job_name, status="STARTED", start_time=job_start)
        db.session.add(job_run)
        db.session.commit()

        processed_count = 0
        failed_count = 0
        critical_count = 0
        error_msg = None

        try:
            items = InventoryItem.query.all()
            for item in items:
                try:
                    # Generate Weekly Demand Forecast (horizon = 4 weeks)
                    forecast_res = ForecastModelService.generate_forecast(
                        user_id=item.user_id,
                        product_name=item.product_name,
                        category=item.category.value,
                        current_stock=item.quantity,
                        horizon=4,
                        period='weekly'
                    )
                    forecast_weekly_demand = float(np_mean_safe(forecast_res['forecast']))

                    # Save prediction result under 'weekly' period
                    scorer = WasteRiskScorer()
                    risk_res = scorer.calculate_risk(
                        current_stock=item.quantity,
                        forecast_demand=forecast_weekly_demand / 7.0, # convert weekly demand to daily proxy
                        days_to_expiry=item.days_remaining,
                        storage_capacity=item.storage_capacity
                    )

                    if risk_res['risk_level'] == 'CRITICAL':
                        critical_count += 1

                    reorder_res = ReorderEngine.calculate_reorder(
                        current_stock=item.quantity,
                        forecast_daily_demand=forecast_weekly_demand / 7.0,
                        lead_time_days=item.lead_time_days,
                        safety_stock=item.safety_stock,
                        storage_capacity=item.storage_capacity,
                        waste_risk_level=risk_res['risk_level'],
                        days_to_expiry=item.days_remaining
                    )

                    pred = PredictionResult(
                        user_id=item.user_id,
                        inventory_item_id=item.id,
                        product_name=item.product_name,
                        forecast_demand=forecast_weekly_demand,
                        forecast_period='weekly',
                        days_to_expiry=item.days_remaining,
                        waste_risk_score=risk_res['risk_score'],
                        risk_level=risk_res['risk_level'],
                        recommended_action=risk_res['recommended_action'],
                        recommended_reorder=reorder_res['recommended_quantity'],
                        model_name=forecast_res['model_name'],
                        prediction_date=datetime.utcnow()
                    )
                    db.session.add(pred)
                    processed_count += 1
                except Exception as e:
                    failed_count += 1
                    logger.error(f"Error in weekly job: {str(e)}")
                    error_msg = str(e)

            job_run.status = "COMPLETED" if failed_count == 0 else "PARTIAL"
            if processed_count == 0 and failed_count > 0:
                job_run.status = "FAILED"
            job_run.end_time = datetime.utcnow()
            job_run.products_processed = processed_count
            job_run.products_failed = failed_count
            job_run.critical_products = critical_count
            job_run.error_message = error_msg
            db.session.commit()

        except Exception as e:
            job_run.status = "FAILED"
            job_run.end_time = datetime.utcnow()
            job_run.error_message = str(e)
            db.session.commit()

def run_monthly_prediction_job():
    """
    Generates monthly aggregated forecasts, evaluations and AI reports.
    """
    job_start = datetime.utcnow()
    job_name = "monthly_prediction_job"
    
    with get_app_context():
        job_run = JobLog(job_name=job_name, status="STARTED", start_time=job_start)
        db.session.add(job_run)
        db.session.commit()

        processed_count = 0
        failed_count = 0
        critical_count = 0
        error_msg = None

        try:
            items = InventoryItem.query.all()
            for item in items:
                try:
                    # Generate Monthly Forecast (horizon = 1 month)
                    forecast_res = ForecastModelService.generate_forecast(
                        user_id=item.user_id,
                        product_name=item.product_name,
                        category=item.category.value,
                        current_stock=item.quantity,
                        horizon=1,
                        period='monthly'
                    )
                    forecast_monthly_demand = float(np_mean_safe(forecast_res['forecast']))

                    scorer = WasteRiskScorer()
                    risk_res = scorer.calculate_risk(
                        current_stock=item.quantity,
                        forecast_demand=forecast_monthly_demand / 30.0,
                        days_to_expiry=item.days_remaining,
                        storage_capacity=item.storage_capacity
                    )

                    if risk_res['risk_level'] == 'CRITICAL':
                        critical_count += 1

                    reorder_res = ReorderEngine.calculate_reorder(
                        current_stock=item.quantity,
                        forecast_daily_demand=forecast_monthly_demand / 30.0,
                        lead_time_days=item.lead_time_days,
                        safety_stock=item.safety_stock,
                        storage_capacity=item.storage_capacity,
                        waste_risk_level=risk_res['risk_level'],
                        days_to_expiry=item.days_remaining
                    )

                    pred = PredictionResult(
                        user_id=item.user_id,
                        inventory_item_id=item.id,
                        product_name=item.product_name,
                        forecast_demand=forecast_monthly_demand,
                        forecast_period='monthly',
                        days_to_expiry=item.days_remaining,
                        waste_risk_score=risk_res['risk_score'],
                        risk_level=risk_res['risk_level'],
                        recommended_action=risk_res['recommended_action'],
                        recommended_reorder=reorder_res['recommended_quantity'],
                        model_name=forecast_res['model_name'],
                        prediction_date=datetime.utcnow()
                    )
                    db.session.add(pred)
                    processed_count += 1
                except Exception as e:
                    failed_count += 1
                    error_msg = str(e)

            job_run.status = "COMPLETED" if failed_count == 0 else "PARTIAL"
            if processed_count == 0 and failed_count > 0:
                job_run.status = "FAILED"
            job_run.end_time = datetime.utcnow()
            job_run.products_processed = processed_count
            job_run.products_failed = failed_count
            job_run.critical_products = critical_count
            job_run.error_message = error_msg
            db.session.commit()

        except Exception as e:
            job_run.status = "FAILED"
            job_run.end_time = datetime.utcnow()
            job_run.error_message = str(e)
            db.session.commit()

def np_mean_safe(vals):
    if not vals:
        return 0.0
    return sum(vals) / len(vals)

# Setup background scheduler
scheduler = BackgroundScheduler()

def start_scheduler():
    """Starts the background scheduler based on config parameters."""
    if scheduler.running:
        return

    # Parse cron variables from env
    daily_hour = int(os.getenv('AI_DAILY_JOB_HOUR', 2))
    daily_minute = int(os.getenv('AI_DAILY_JOB_MINUTE', 0))

    weekly_day = os.getenv('AI_WEEKLY_JOB_DAY', 'mon')[:3].lower()  # e.g., 'monday' -> 'mon'
    weekly_hour = int(os.getenv('AI_WEEKLY_JOB_HOUR', 3))
    weekly_minute = int(os.getenv('AI_WEEKLY_JOB_MINUTE', 0))

    monthly_day = int(os.getenv('AI_MONTHLY_JOB_DAY', 1))
    monthly_hour = int(os.getenv('AI_MONTHLY_JOB_HOUR', 4))
    monthly_minute = int(os.getenv('AI_MONTHLY_JOB_MINUTE', 0))

    # Add daily trigger
    scheduler.add_job(
        run_daily_prediction_job,
        trigger=CronTrigger(hour=daily_hour, minute=daily_minute),
        id='daily_prediction',
        replace_existing=True
    )

    # Add weekly trigger
    scheduler.add_job(
        run_weekly_prediction_job,
        trigger=CronTrigger(day_of_week=weekly_day, hour=weekly_hour, minute=weekly_minute),
        id='weekly_prediction',
        replace_existing=True
    )

    # Add monthly trigger
    scheduler.add_job(
        run_monthly_prediction_job,
        trigger=CronTrigger(day=monthly_day, hour=monthly_hour, minute=monthly_minute),
        id='monthly_prediction',
        replace_existing=True
    )

    scheduler.start()
    logger.info("AI Background Scheduler started successfully.")
