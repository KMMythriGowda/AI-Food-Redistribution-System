"""Administrative account-management API."""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity
from sqlalchemy import or_

from app.extensions import db
from app.middleware.auth_middleware import admin_required
from app.models.user import User
from app.models.enums import UserRole
from app.models.marketplace import SurplusListing, MarketplaceOrder

admin_bp = Blueprint('admin', __name__)


@admin_bp.route('/stats', methods=['GET'])
@admin_required
def stats():
    return jsonify({
        'success': True,
        'data': {
            'total_users': User.query.count(),
            'businesses': User.query.filter_by(role=UserRole.BUSINESS).count(),
            'ngos': User.query.filter_by(role=UserRole.NGO).count(),
            'pending_ngos': User.query.filter_by(role=UserRole.NGO, is_verified=False, is_active=True).count(),
            'active_listings': SurplusListing.query.filter_by(status='AVAILABLE').count(),
            'total_orders': MarketplaceOrder.query.count(),
        }
    }), 200


@admin_bp.route('/users', methods=['GET'])
@admin_required
def list_users():
    query = User.query
    role = (request.args.get('role') or '').upper().strip()
    verification = (request.args.get('verification') or '').lower().strip()
    search = (request.args.get('search') or '').strip()

    if role in {r.value for r in UserRole}:
        query = query.filter(User.role == UserRole(role))
    if verification == 'pending':
        query = query.filter(User.role == UserRole.NGO, User.is_verified.is_(False))
    elif verification == 'verified':
        query = query.filter(User.is_verified.is_(True))
    if search:
        term = f'%{search}%'
        query = query.filter(or_(
            User.email.ilike(term),
            User.full_name.ilike(term),
            User.organization_name.ilike(term),
        ))

    users = query.order_by(User.created_at.desc()).all()
    return jsonify({'success': True, 'data': [u.to_dict() for u in users]}), 200


@admin_bp.route('/users/<user_id>/verify', methods=['POST'])
@admin_required
def verify_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({'success': False, 'error': 'Not Found', 'message': 'User not found.'}), 404
    if user.role != UserRole.NGO:
        return jsonify({'success': False, 'error': 'Bad Request', 'message': 'Verification applies to NGO accounts only.'}), 400

    verified = bool((request.get_json() or {}).get('verified', True))
    user.is_verified = verified
    db.session.commit()
    return jsonify({
        'success': True,
        'message': 'NGO verification updated.',
        'data': user.to_dict()
    }), 200


@admin_bp.route('/users/<user_id>/status', methods=['POST'])
@admin_required
def set_user_status(user_id):
    current_admin_id = str(get_jwt_identity())
    if str(user_id) == current_admin_id:
        return jsonify({'success': False, 'error': 'Bad Request', 'message': 'You cannot deactivate your own admin account.'}), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify({'success': False, 'error': 'Not Found', 'message': 'User not found.'}), 404

    active = bool((request.get_json() or {}).get('active', True))
    user.is_active = active
    db.session.commit()
    return jsonify({
        'success': True,
        'message': 'User account status updated.',
        'data': user.to_dict()
    }), 200
