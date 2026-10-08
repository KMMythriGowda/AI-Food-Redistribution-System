"""Authentication REST API Routes"""
import os
import smtplib
from email.message import EmailMessage
from urllib.parse import urljoin

from flask import Blueprint, current_app, request, jsonify
from flask_jwt_extended import (
    create_access_token, create_refresh_token, jwt_required, get_jwt_identity,
    get_jwt, decode_token
)
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from marshmallow import ValidationError

from app.extensions import db
from app.models.user import User
from app.models.enums import UserRole
from app.models.revoked_token import RevokedToken
from app.schemas.user_schema import register_schema, login_schema
from app.utils.geocoding import geocode_address

auth_bp = Blueprint('auth', __name__)


def _issue_tokens(user):
    return create_access_token(identity=user.id), create_refresh_token(identity=user.id)


def _reset_serializer():
    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'], salt='password-reset-v1')


def _make_reset_token(user: User) -> str:
    return _reset_serializer().dumps({
        'user_id': user.id,
        'pwd': user.password_hash[-16:],
    })


def _load_reset_token(token: str):
    try:
        payload = _reset_serializer().loads(
            token,
            max_age=current_app.config['PASSWORD_RESET_EXPIRES_SECONDS']
        )
    except SignatureExpired:
        return None, 'Password reset link has expired.'
    except BadSignature:
        return None, 'Invalid password reset link.'

    user = User.query.get(payload.get('user_id'))
    if not user or payload.get('pwd') != user.password_hash[-16:]:
        return None, 'Invalid or already-used password reset link.'
    return user, None


def _send_reset_email(recipient: str, reset_url: str) -> bool:
    host = os.getenv('SMTP_HOST')
    if not host:
        return False
    port = int(os.getenv('SMTP_PORT', '587'))
    username = os.getenv('SMTP_USERNAME')
    password = os.getenv('SMTP_PASSWORD')
    sender = os.getenv('SMTP_FROM', username or 'noreply@foodredistribution.local')
    use_tls = os.getenv('SMTP_USE_TLS', 'true').lower() in {'1', 'true', 'yes'}

    message = EmailMessage()
    message['Subject'] = 'Food Redistribution Platform - Password Reset'
    message['From'] = sender
    message['To'] = recipient
    message.set_content(
        'A password reset was requested for your account.\n\n'
        f'Open this link to choose a new password:\n{reset_url}\n\n'
        'If you did not request this, you can ignore this email.'
    )

    try:
        if port == 465:
            with smtplib.SMTP_SSL(host, port, timeout=8) as server:
                if username:
                    server.login(username, password or '')
                server.send_message(message)
        else:
            with smtplib.SMTP(host, port, timeout=8) as server:
                if use_tls:
                    server.starttls()
                if username:
                    server.login(username, password or '')
                server.send_message(message)
        return True
    except Exception:
        current_app.logger.exception('Unable to send password reset email')
        return False


@auth_bp.route('/register', methods=['POST'])
def register():
    try:
        data = register_schema.load(request.get_json() or {})
    except ValidationError as err:
        return jsonify({'success': False, 'error': 'Validation Error', 'details': err.messages}), 400

    if User.query.filter_by(email=data['email'].lower()).first():
        return jsonify({'success': False, 'error': 'Conflict', 'message': 'Email address is already registered.'}), 409

    user_role = UserRole(data.get('role', UserRole.BUSINESS.value))
    is_verified = user_role == UserRole.BUSINESS or current_app.config.get('AUTO_VERIFY_NGO', False)

    latitude = data.get('latitude')
    longitude = data.get('longitude')
    if (latitude is None or longitude is None) and data.get('address'):
        latitude, longitude = geocode_address(data.get('address'))

    user = User(
        email=data['email'].lower(),
        full_name=data['full_name'],
        organization_name=data.get('organization_name'),
        role=user_role,
        phone=data.get('phone'),
        address=data.get('address'),
        latitude=latitude,
        longitude=longitude,
        business_type=data.get('business_type'),
        is_verified=is_verified,
    )
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()

    access_token = refresh_token = None
    if is_verified:
        access_token, refresh_token = _issue_tokens(user)

    message = 'Registration successful.' if is_verified else 'Registration successful. Your NGO account is pending administrator verification.'
    return jsonify({
        'success': True,
        'message': message,
        'data': {
            'user': user.to_dict(),
            'access_token': access_token,
            'refresh_token': refresh_token,
            'requires_verification': not is_verified,
        }
    }), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = login_schema.load(request.get_json() or {})
    except ValidationError as err:
        return jsonify({'success': False, 'error': 'Validation Error', 'details': err.messages}), 400

    user = User.query.filter_by(email=data['email'].lower()).first()
    if not user or not user.check_password(data['password']):
        return jsonify({'success': False, 'error': 'Unauthorized', 'message': 'Invalid email or password.'}), 401
    if not user.is_active:
        return jsonify({'success': False, 'error': 'Forbidden', 'message': 'User account is deactivated.'}), 403
    if user.role == UserRole.NGO and not user.is_verified:
        return jsonify({'success': False, 'error': 'Verification Required', 'message': 'Your NGO account is pending administrator verification.'}), 403

    access_token, refresh_token = _issue_tokens(user)
    return jsonify({
        'success': True,
        'message': 'Login successful.',
        'data': {'user': user.to_dict(), 'access_token': access_token, 'refresh_token': refresh_token}
    }), 200


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user or not user.is_active:
        return jsonify({'success': False, 'error': 'Unauthorized', 'message': 'Invalid refresh token user.'}), 401
    if user.role == UserRole.NGO and not user.is_verified:
        return jsonify({'success': False, 'error': 'Verification Required', 'message': 'Your NGO account is pending administrator verification.'}), 403

    return jsonify({'success': True, 'data': {'access_token': create_access_token(identity=user.id)}}), 200


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    user = User.query.get(get_jwt_identity())
    if not user or not user.is_active:
        return jsonify({'success': False, 'error': 'Not Found', 'message': 'User not found or inactive.'}), 404
    return jsonify({'success': True, 'data': {'user': user.to_dict()}}), 200


@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    RevokedToken.revoke_payload(get_jwt())
    refresh_token = (request.get_json(silent=True) or {}).get('refresh_token')
    if refresh_token:
        try:
            decoded = decode_token(refresh_token)
            if decoded.get('type') == 'refresh':
                RevokedToken.revoke_payload(decoded)
        except Exception:
            pass
    return jsonify({'success': True, 'message': 'Successfully logged out.'}), 200


@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    email = ((request.get_json() or {}).get('email') or '').strip().lower()
    if not email:
        return jsonify({'success': False, 'error': 'Validation Error', 'message': 'Email is required.'}), 400

    user = User.query.filter_by(email=email).first()
    response_data = {}
    if user and user.is_active:
        token = _make_reset_token(user)
        frontend = current_app.config.get('FRONTEND_URL', 'http://localhost').rstrip('/') + '/'
        reset_url = urljoin(frontend, f'reset-password?token={token}')
        sent = _send_reset_email(user.email, reset_url)
        # Development fallback lets a local project be fully testable without SMTP credentials.
        if not sent and (current_app.config.get('PASSWORD_RESET_RETURN_LINK') or current_app.config.get('ENV') != 'production'):
            response_data = {'reset_token': token, 'reset_url': reset_url, 'delivery': 'development-link'}

    return jsonify({
        'success': True,
        'message': 'If an account with that email exists, password reset instructions have been prepared.',
        'data': response_data,
    }), 200


@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    data = request.get_json() or {}
    token = data.get('token')
    password = data.get('password') or ''
    if not token:
        return jsonify({'success': False, 'error': 'Validation Error', 'message': 'Reset token is required.'}), 400
    if len(password) < 6:
        return jsonify({'success': False, 'error': 'Validation Error', 'message': 'Password must be at least 6 characters.'}), 400

    user, error = _load_reset_token(token)
    if error:
        return jsonify({'success': False, 'error': 'Invalid Token', 'message': error}), 400
    user.set_password(password)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Password updated successfully. Please sign in.'}), 200
