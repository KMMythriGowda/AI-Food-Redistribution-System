"""Flask Application Factory module."""
import os
from flask import Flask
from app.config.config import config_by_name
from app.extensions import db, migrate, jwt, cors, ma
from app.utils.logger import setup_logger
from app.middleware.error_handler import register_error_handlers
from app.api import api_bp


def _ensure_bootstrap_admin():
    """Create an optional demo/admin account from environment variables once."""
    from app.models.user import User
    from app.models.enums import UserRole

    email = os.getenv('BOOTSTRAP_ADMIN_EMAIL', '').strip().lower()
    password = os.getenv('BOOTSTRAP_ADMIN_PASSWORD', '')
    if not email or not password:
        return
    if User.query.filter_by(email=email).first():
        return

    admin = User(
        email=email,
        full_name=os.getenv('BOOTSTRAP_ADMIN_NAME', 'System Administrator'),
        organization_name='Food Redistribution Platform',
        role=UserRole.ADMIN,
        is_verified=True,
        is_active=True,
    )
    admin.set_password(password)
    db.session.add(admin)
    db.session.commit()


def create_app(config_name=None):
    if config_name is None:
        config_name = os.getenv('FLASK_ENV', 'development')

    app = Flask(__name__)
    app.config.from_object(config_by_name.get(config_name, config_by_name['default']))

    # Import all models so db.create_all/migrations see complete metadata.
    from app.models import (  # noqa: F401
        User, UserRole, InventoryCategory, InventoryStatus, RiskLevel, StorageType,
        InventoryItem, SalesTransaction, WasteLog, PredictionResult, JobLog,
        SurplusListing, MarketplaceOrder, NgoRequirement, Notification, RevokedToken
    )

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": app.config['CORS_ORIGINS']}})
    ma.init_app(app)

    @jwt.token_in_blocklist_loader
    def is_token_revoked(_jwt_header, jwt_payload):
        return RevokedToken.query.filter_by(jti=jwt_payload.get('jti')).first() is not None

    @jwt.revoked_token_loader
    def revoked_token_response(_jwt_header, _jwt_payload):
        return {'success': False, 'error': 'Unauthorized', 'message': 'This token has been revoked.'}, 401

    with app.app_context():
        # Kept for the student/demo deployment: makes a fresh clone immediately runnable.
        # Alembic migrations are still provided for controlled production upgrades.
        db.create_all()
        _ensure_bootstrap_admin()

    setup_logger(app)
    register_error_handlers(app)
    app.register_blueprint(api_bp)
    return app
