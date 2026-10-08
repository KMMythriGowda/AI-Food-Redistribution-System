"""JWT Authentication & Role-Based Access Control (RBAC) Middleware"""
from functools import wraps
from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from app.models.user import User
from app.models.enums import UserRole


def role_required(allowed_roles):
    """Require an active, appropriately privileged and (for NGOs) verified user."""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            user_id = get_jwt_identity()
            user = User.query.get(user_id)

            if not user or not user.is_active:
                return jsonify({
                    'success': False,
                    'error': 'Unauthorized',
                    'message': 'User account is inactive or not found.'
                }), 401

            user_role = user.role.value if hasattr(user.role, 'value') else str(user.role)
            if user_role not in allowed_roles:
                return jsonify({
                    'success': False,
                    'error': 'Forbidden',
                    'message': f'Access forbidden. Requires one of roles: {", ".join(allowed_roles)}'
                }), 403

            if user.role == UserRole.NGO and not user.is_verified:
                return jsonify({
                    'success': False,
                    'error': 'Verification Required',
                    'message': 'Your NGO account is pending administrator verification.'
                }), 403

            return fn(*args, **kwargs)
        return wrapper
    return decorator


def admin_required(fn):
    return role_required(['ADMIN'])(fn)
