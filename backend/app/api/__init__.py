"""API Blueprints Registration Module"""
from flask import Blueprint
from app.api.health import health_bp
from app.api.auth import auth_bp
from app.api.inventory import inventory_bp
from app.api.ai_routes import ai_bp
from app.api.marketplace import marketplace_bp
from app.api.admin import admin_bp

api_bp = Blueprint('api', __name__, url_prefix='/api')
api_bp.register_blueprint(health_bp)
api_bp.register_blueprint(auth_bp, url_prefix='/auth')
api_bp.register_blueprint(inventory_bp, url_prefix='/inventory')
api_bp.register_blueprint(ai_bp, url_prefix='/ai')
api_bp.register_blueprint(marketplace_bp, url_prefix='/marketplace')
api_bp.register_blueprint(admin_bp, url_prefix='/admin')
