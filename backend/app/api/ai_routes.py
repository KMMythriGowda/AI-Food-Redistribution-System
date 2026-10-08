"""
Flask API Blueprint acting as secure JWT Proxy to the FastAPI AI Microservice
"""
import os
import httpx
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.middleware.auth_middleware import role_required
from app.models.job_log import JobLog

ai_bp = Blueprint('ai', __name__)

# Load service URL from environment configuration
AI_SERVICE_URL = os.getenv('AI_SERVICE_URL', 'http://127.0.0.1:8000')

@ai_bp.route('/health', methods=['GET'])
def health():
    """Proxy health check to FastAPI."""
    try:
        r = httpx.get(f"{AI_SERVICE_URL}/api/ai/health")
        return jsonify(r.json()), r.status_code
    except httpx.RequestError as e:
        return jsonify({"success": False, "error": "AI Microservice Connection Failed", "message": str(e)}), 503

@ai_bp.route('/forecast', methods=['POST'])
@jwt_required()
@role_required(['BUSINESS'])
def forecast():
    """Proxy forecast demand query."""
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    
    # Optional: pass user_id inside payload
    data['user_id'] = user_id

    try:
        r = httpx.post(f"{AI_SERVICE_URL}/api/ai/forecast", json=data)
        return jsonify(r.json()), r.status_code
    except httpx.RequestError as e:
        return jsonify({"success": False, "error": "AI Service Unreachable", "message": str(e)}), 503

@ai_bp.route('/waste-risk', methods=['POST'])
@jwt_required()
@role_required(['BUSINESS'])
def waste_risk():
    """Proxy waste risk calculation scoped to the authenticated business."""
    data = request.get_json() or {}
    data['user_id'] = get_jwt_identity()
    try:
        r = httpx.post(f"{AI_SERVICE_URL}/api/ai/waste-risk", json=data)
        return jsonify(r.json()), r.status_code
    except httpx.RequestError as e:
        return jsonify({"success": False, "error": "AI Service Unreachable", "message": str(e)}), 503

@ai_bp.route('/reorder-recommendations', methods=['POST'])
@jwt_required()
@role_required(['BUSINESS'])
def reorder_recommendations():
    """Proxy reorder calculation."""
    data = request.get_json() or {}
    try:
        r = httpx.post(f"{AI_SERVICE_URL}/api/ai/reorder-recommendations", json=data)
        return jsonify(r.json()), r.status_code
    except httpx.RequestError as e:
        return jsonify({"success": False, "error": "AI Service Unreachable", "message": str(e)}), 503

@ai_bp.route('/batch-predict', methods=['POST'])
@jwt_required()
@role_required(['BUSINESS'])
def batch_predict():
    """Trigger scheduled predictions for this user."""
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    data['user_id'] = user_id

    try:
        r = httpx.post(f"{AI_SERVICE_URL}/api/ai/batch-predict", json=data)
        return jsonify(r.json()), r.status_code
    except httpx.RequestError as e:
        return jsonify({"success": False, "error": "AI Service Unreachable", "message": str(e)}), 503

@ai_bp.route('/model-metrics', methods=['GET'])
@jwt_required()
@role_required(['BUSINESS'])
def model_metrics():
    """Retrieve model benchmark metadata and tenant data sufficiency."""
    user_id = get_jwt_identity()
    try:
        r = httpx.get(f"{AI_SERVICE_URL}/api/ai/model-metrics", params={"user_id": user_id})
        return jsonify(r.json()), r.status_code
    except httpx.RequestError as e:
        return jsonify({"success": False, "error": "AI Service Unreachable", "message": str(e)}), 503

@ai_bp.route('/risk-summary', methods=['GET'])
@jwt_required()
@role_required(['BUSINESS'])
def risk_summary():
    """Retrieve summarized risk numbers for this user."""
    user_id = get_jwt_identity()
    try:
        r = httpx.get(f"{AI_SERVICE_URL}/api/ai/risk-summary", params={"user_id": user_id})
        return jsonify(r.json()), r.status_code
    except httpx.RequestError as e:
        return jsonify({"success": False, "error": "AI Service Unreachable", "message": str(e)}), 503

@ai_bp.route('/risk-trends', methods=['GET'])
@jwt_required()
@role_required(['BUSINESS'])
def risk_trends():
    """Retrieve risk changes and trends for this user."""
    user_id = get_jwt_identity()
    try:
        r = httpx.get(f"{AI_SERVICE_URL}/api/ai/risk-trends", params={"user_id": user_id})
        return jsonify(r.json()), r.status_code
    except httpx.RequestError as e:
        return jsonify({"success": False, "error": "AI Service Unreachable", "message": str(e)}), 503

@ai_bp.route('/reorder-summary', methods=['GET'])
@jwt_required()
@role_required(['BUSINESS'])
def reorder_summary():
    """Retrieve replenishment suggestions for this user."""
    user_id = get_jwt_identity()
    try:
        r = httpx.get(f"{AI_SERVICE_URL}/api/ai/reorder-summary", params={"user_id": user_id})
        return jsonify(r.json()), r.status_code
    except httpx.RequestError as e:
        return jsonify({"success": False, "error": "AI Service Unreachable", "message": str(e)}), 503

@ai_bp.route('/simulate', methods=['POST'])
@jwt_required()
@role_required(['BUSINESS'])
def simulate():
    """Run what-if replenishment simulation."""
    data = request.get_json() or {}
    try:
        r = httpx.post(f"{AI_SERVICE_URL}/api/ai/simulate", json=data)
        return jsonify(r.json()), r.status_code
    except httpx.RequestError as e:
        return jsonify({"success": False, "error": "AI Service Unreachable", "message": str(e)}), 503

@ai_bp.route('/scheduler-status', methods=['GET'])
@jwt_required()
@role_required(['BUSINESS'])
def scheduler_status():
    """Return historical jobs log for dashboard widgets."""
    try:
        # Get live scheduler status details from FastAPI microservice
        live_details = {
            "scheduler_status": "ACTIVE",
            "daily_schedule": "02:00",
            "weekly_schedule": "Monday 03:00",
            "next_daily_run": None,
            "next_weekly_run": None,
            "active_jobs": [],
            "reason": None
        }
        try:
            r = httpx.get(f"{AI_SERVICE_URL}/api/ai/scheduler-details", timeout=2.0)
            if r.status_code == 200:
                live_details = r.json()
                live_details["reason"] = None
            else:
                live_details["scheduler_status"] = "UNAVAILABLE"
                live_details["reason"] = f"Microservice returned status {r.status_code}"
        except Exception as e:
            # Fallback gracefully if microservice details are not reachable
            live_details["scheduler_status"] = "UNAVAILABLE"
            live_details["reason"] = f"Microservice connection failed: {str(e)}"

        # Query database logs
        logs = JobLog.query.order_by(JobLog.start_time.desc()).limit(10).all()
        
        # Deserialise successful JobLog report data from error_message column
        logs_dict = []
        import json
        for l in logs:
            ld = l.to_dict()
            ld["report"] = None
            if l.status in ["COMPLETED", "PARTIAL"] and l.error_message:
                try:
                    data = json.loads(l.error_message)
                    if isinstance(data, dict) and data.get("report_type") == "operations_report":
                        ld["report"] = data
                        ld["error_message"] = None # Suppress serialized JSON from raw display
                except Exception:
                    pass
            logs_dict.append(ld)

        # Calculate metrics for the last run from recent logs
        last_run = None
        last_run_status = None
        last_run_items = 0
        if logs_dict:
            last_run = logs_dict[0]['start_time']
            last_run_status = logs_dict[0]['status']
            last_run_items = logs_dict[0]['products_processed']

        return jsonify({
            "success": True,
            "logs": logs_dict,
            "scheduler_status": live_details.get("scheduler_status", "ACTIVE"),
            "daily_schedule": live_details.get("daily_schedule", "02:00"),
            "weekly_schedule": live_details.get("weekly_schedule", "Monday 03:00"),
            "next_daily_run": live_details.get("next_daily_run"),
            "next_weekly_run": live_details.get("next_weekly_run"),
            "last_run": last_run,
            "last_run_status": last_run_status,
            "last_run_items": last_run_items,
            "active_jobs": live_details.get("active_jobs", []),
            "jobs": live_details.get("active_jobs", []),
            "reason": live_details.get("reason"),
            "scheduler_error": live_details.get("reason")
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": "Failed to load scheduler logs", "message": str(e)}), 500

@ai_bp.route('/system-health', methods=['GET'])
@jwt_required()
@role_required(['BUSINESS'])
def system_health():
    """Retrieve detailed AI system health indicators."""
    try:
        r = httpx.get(f"{AI_SERVICE_URL}/api/ai/system-health", timeout=2.0)
        return jsonify(r.json()), r.status_code
    except httpx.RequestError as e:
        # Fallback if microservice is down
        from datetime import datetime
        return jsonify({
            "success": False,
            "overall_status": "UNAVAILABLE",
            "forecast_engine": "ERROR",
            "risk_engine": "ERROR",
            "batch_predictor": "ERROR",
            "scheduler": "WARNING",
            "database": "READY",
            "ai_microservice": "ERROR",
            "timestamp": datetime.utcnow().isoformat(),
            "message": f"AI Microservice connection failed: {str(e)}",
            "health": {
                "forecast_engine": "ERROR",
                "risk_engine": "ERROR",
                "batch_predictor": "ERROR",
                "scheduler": "WARNING",
                "database": "READY",
                "ai_microservice": "ERROR"
            },
            "details": {
                "last_successful_prediction": None,
                "last_forecast_update": None,
                "last_scheduler_run": None,
                "products_processed": "0",
                "categories_forecasted": "0"
            }
        }), 200
