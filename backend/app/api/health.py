"""
Health check blueprint module.
"""
from flask import Blueprint, jsonify, current_app
from datetime import datetime

health_bp = Blueprint('health', __name__)

@health_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint confirming API factory status."""
    return jsonify({
        'status': 'healthy',
        'service': 'AI Food Redistribution Backend',
        'environment': current_app.config.get('ENV', 'development'),
        'timestamp': datetime.utcnow().isoformat() + 'Z'
    }), 200
