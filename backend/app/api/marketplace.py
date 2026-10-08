"""
Marketplace REST API Routes Blueprint
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.middleware.auth_middleware import role_required
from app.services.marketplace_service import MarketplaceService

marketplace_bp = Blueprint('marketplace', __name__)

@marketplace_bp.route('/listings', methods=['POST'])
@jwt_required()
@role_required(['BUSINESS'])
def create_listing():
    """Creates a new surplus food listing."""
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    
    listing, error = MarketplaceService.create_listing(user_id, data)
    if error:
        return jsonify({'success': False, 'error': 'Bad Request', 'message': error}), 400
    
    return jsonify({
        'success': True,
        'message': 'Surplus food listed on marketplace successfully.',
        'data': listing
    }), 201

@marketplace_bp.route('/listings', methods=['GET'])
@jwt_required()
@role_required(['NGO'])
def list_listings():
    """Retrieves all active surplus food listings."""
    user_id = get_jwt_identity()
    params = request.args.to_dict()
    
    listings, error = MarketplaceService.list_listings(user_id, params)
    if error:
        return jsonify({'success': False, 'error': 'Internal Server Error', 'message': error}), 500
    
    return jsonify({
        'success': True,
        'data': listings
    }), 200

@marketplace_bp.route('/listings/business', methods=['GET'])
@jwt_required()
@role_required(['BUSINESS'])
def get_business_listings():
    """Retrieves listings owned by authenticated business."""
    user_id = get_jwt_identity()
    listings, error = MarketplaceService.get_business_listings(user_id)
    if error:
        return jsonify({'success': False, 'error': 'Internal Server Error', 'message': error}), 500
    
    return jsonify({
        'success': True,
        'data': listings
    }), 200

@marketplace_bp.route('/orders/checkout', methods=['POST'])
@jwt_required()
@role_required(['NGO'])
def initiate_checkout():
    """Initiates checkout and creates a pending order."""
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    
    order, error = MarketplaceService.initiate_checkout(user_id, data)
    if error:
        return jsonify({'success': False, 'error': 'Checkout Failed', 'message': error}), 400
    
    return jsonify({
        'success': True,
        'message': 'Checkout initiated.',
        'data': order
    }), 200

@marketplace_bp.route('/orders/verify-payment', methods=['POST'])
@jwt_required()
@role_required(['NGO'])
def verify_payment():
    """Verifies sandbox payment details and confirms order."""
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    order_id = data.get('order_id')
    success = data.get('success', True) # Simulate payment status

    if not order_id:
        return jsonify({'success': False, 'error': 'Bad Request', 'message': 'order_id is required.'}), 400

    order, error = MarketplaceService.verify_payment(user_id, order_id, success)
    if error:
        return jsonify({'success': False, 'error': 'Payment Verification Failed', 'message': error}), 400

    return jsonify({
        'success': True,
        'message': 'Payment verified and order confirmed.',
        'data': order
    }), 200

@marketplace_bp.route('/orders/my-orders', methods=['GET'])
@jwt_required()
@role_required(['NGO'])
def get_my_orders():
    """Retrieves claims/order history of authenticated NGO."""
    user_id = get_jwt_identity()
    orders, error = MarketplaceService.get_my_orders(user_id)
    if error:
        return jsonify({'success': False, 'error': 'Internal Server Error', 'message': error}), 500
    
    return jsonify({
        'success': True,
        'data': orders
    }), 200

@marketplace_bp.route('/orders/<order_id>/schedule-pickup', methods=['POST'])
@jwt_required()
def schedule_pickup(order_id):
    """Schedules pickup for an order."""
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    pickup_date = data.get('pickup_date')

    if not pickup_date:
        return jsonify({'success': False, 'error': 'Bad Request', 'message': 'pickup_date is required.'}), 400

    order, error = MarketplaceService.schedule_pickup(user_id, order_id, pickup_date)
    if error:
        return jsonify({'success': False, 'error': 'Action Failed', 'message': error}), 400

    return jsonify({
        'success': True,
        'message': 'Pickup scheduled successfully.',
        'data': order
    }), 200

@marketplace_bp.route('/orders/<order_id>/complete-pickup', methods=['POST'])
@jwt_required()
def complete_pickup(order_id):
    """Completes the pickup process."""
    user_id = get_jwt_identity()
    order, error = MarketplaceService.complete_pickup(user_id, order_id)
    if error:
        return jsonify({'success': False, 'error': 'Action Failed', 'message': error}), 400

    return jsonify({
        'success': True,
        'message': 'Order marked completed and food items claimed.',
        'data': order
    }), 200

@marketplace_bp.route('/orders/<order_id>/cancel', methods=['POST'])
@jwt_required()
def cancel_order(order_id):
    """Cancels order and triggers refund where applicable."""
    user_id = get_jwt_identity()
    order, error = MarketplaceService.cancel_order(user_id, order_id)
    if error:
        return jsonify({'success': False, 'error': 'Action Failed', 'message': error}), 400

    return jsonify({
        'success': True,
        'message': 'Order cancelled and refund processed.',
        'data': order
    }), 200

@marketplace_bp.route('/donors/<business_id>', methods=['GET'])
@jwt_required()
def get_donor_profile(business_id):
    """Retrieves dynamic metrics and public listing history of a donor business."""
    profile, error = MarketplaceService.get_donor_profile(business_id)
    if error:
        return jsonify({'success': False, 'error': 'Not Found', 'message': error}), 404
    
    return jsonify({
        'success': True,
        'data': profile
    }), 200

@marketplace_bp.route('/donors/profile', methods=['PUT'])
@jwt_required()
@role_required(['BUSINESS'])
def update_donor_profile():
    """Allows business owners to update public profile details."""
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    
    profile, error = MarketplaceService.update_donor_profile(user_id, data)
    if error:
        return jsonify({'success': False, 'error': 'Update Failed', 'message': error}), 400
    
    return jsonify({
        'success': True,
        'message': 'Public donor profile updated successfully.',
        'data': profile
    }), 200

@marketplace_bp.route('/business/transactions', methods=['GET'])
@jwt_required()
@role_required(['BUSINESS'])
def get_business_transactions():
    """Retrieves business orders/transactions."""
    user_id = get_jwt_identity()
    transactions, error = MarketplaceService.get_business_transactions(user_id)
    if error:
        return jsonify({'success': False, 'error': 'Internal Server Error', 'message': error}), 500
    
    return jsonify({
        'success': True,
        'data': transactions
    }), 200

@marketplace_bp.route('/business/stats', methods=['GET'])
@jwt_required()
@role_required(['BUSINESS'])
def get_business_stats():
    """Retrieves sales and payment stats for business dashboard."""
    user_id = get_jwt_identity()
    stats, error = MarketplaceService.get_business_stats(user_id)
    if error:
        return jsonify({'success': False, 'error': 'Internal Server Error', 'message': error}), 500
    
    return jsonify({
        'success': True,
        'data': stats
    }), 200

@marketplace_bp.route('/analytics', methods=['GET'])
@jwt_required()
def get_marketplace_analytics():
    """Aggregates global platform analytics for dashboards."""
    analytics, error = MarketplaceService.get_marketplace_analytics()
    if error:
        return jsonify({'success': False, 'error': 'Internal Server Error', 'message': error}), 500
    
    return jsonify({
        'success': True,
        'data': analytics
    }), 200

@marketplace_bp.route('/requirements', methods=['GET'])
@jwt_required()
@role_required(['NGO'])
def get_requirements():
    user_id = get_jwt_identity()
    reqs, error = MarketplaceService.list_requirements(user_id)
    if error:
        return jsonify({'success': False, 'error': 'Internal Server Error', 'message': error}), 500
    return jsonify({'success': True, 'data': reqs}), 200

@marketplace_bp.route('/requirements', methods=['POST'])
@jwt_required()
@role_required(['NGO'])
def create_requirement():
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    req, error = MarketplaceService.create_requirement(user_id, data)
    if error:
        return jsonify({'success': False, 'error': 'Bad Request', 'message': error}), 400
    return jsonify({'success': True, 'message': 'NGO requirement created.', 'data': req}), 201

@marketplace_bp.route('/requirements/<id>', methods=['DELETE'])
@jwt_required()
@role_required(['NGO'])
def delete_requirement(id):
    user_id = get_jwt_identity()
    success, error = MarketplaceService.delete_requirement(user_id, id)
    if error:
        return jsonify({'success': False, 'error': 'Action Failed', 'message': error}), 400
    return jsonify({'success': True, 'message': 'NGO requirement deleted.'}), 200

@marketplace_bp.route('/recommendations', methods=['GET'])
@jwt_required()
@role_required(['NGO'])
def get_recommendations():
    user_id = get_jwt_identity()
    recs, error = MarketplaceService.get_recommendations(user_id)
    if error:
        return jsonify({'success': False, 'error': 'Internal Server Error', 'message': error}), 500
    return jsonify({'success': True, 'data': recs}), 200

@marketplace_bp.route('/notifications', methods=['GET'])
@jwt_required()
def get_notifications():
    user_id = get_jwt_identity()
    notifs, error = MarketplaceService.list_notifications(user_id)
    if error:
        return jsonify({'success': False, 'error': 'Internal Server Error', 'message': error}), 500
    return jsonify({'success': True, 'data': notifs}), 200

@marketplace_bp.route('/notifications/read', methods=['POST'])
@jwt_required()
def mark_notifications_read():
    user_id = get_jwt_identity()
    success, error = MarketplaceService.mark_all_notifications_read(user_id)
    if error:
        return jsonify({'success': False, 'error': 'Internal Server Error', 'message': error}), 500
    return jsonify({'success': True, 'message': 'All notifications marked read.'}), 200

@marketplace_bp.route('/ngo/impact', methods=['GET'])
@jwt_required()
@role_required(['NGO'])
def get_ngo_impact():
    user_id = get_jwt_identity()
    impact, error = MarketplaceService.get_ngo_impact(user_id)
    if error:
        return jsonify({'success': False, 'error': 'Internal Server Error', 'message': error}), 500
    return jsonify({'success': True, 'data': impact}), 200
