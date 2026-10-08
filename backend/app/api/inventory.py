"""
Inventory REST API Routes Blueprint
"""
import os
from flask import Blueprint, request, jsonify, Response
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename

from app.middleware.auth_middleware import role_required
from app.services.inventory_service import InventoryService
from app.models.enums import UserRole

inventory_bp = Blueprint('inventory', __name__)

ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}
MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_IMAGE_EXTENSIONS

@inventory_bp.route('', methods=['POST'])
@jwt_required()
@role_required(['BUSINESS'])
def create_inventory_item():
    """Creates a new inventory item for authenticated business user."""
    user_id = get_jwt_identity()
    data = request.get_json() or {}

    item, error = InventoryService.create_item(user_id, data)
    if error:
        return jsonify({'success': False, 'error': 'Validation Error', 'details': error}), 400

    return jsonify({
        'success': True,
        'message': 'Inventory item created successfully.',
        'data': item
    }), 201


@inventory_bp.route('', methods=['GET'])
@jwt_required()
@role_required(['BUSINESS'])
def list_inventory_items():
    """Retrieves paginated, filtered, and sorted inventory items."""
    user_id = get_jwt_identity()
    params = request.args.to_dict()

    result, error = InventoryService.list_items(user_id, params)
    if error:
        return jsonify({'success': False, 'error': 'Bad Request', 'message': error}), 400

    return jsonify({
        'success': True,
        'data': result['items'],
        'pagination': result['pagination']
    }), 200


@inventory_bp.route('/dashboard', methods=['GET'])
@jwt_required()
@role_required(['BUSINESS'])
def get_inventory_dashboard():
    """Fetches dashboard summary stats, health metrics, and expiry alerts."""
    user_id = get_jwt_identity()
    stats, error = InventoryService.get_dashboard_summary(user_id)
    if error:
        return jsonify({'success': False, 'error': 'Internal Server Error', 'message': error}), 500

    return jsonify({
        'success': True,
        'data': stats
    }), 200


@inventory_bp.route('/expiring', methods=['GET'])
@jwt_required()
@role_required(['BUSINESS'])
def get_expiring_items():
    """Fetches items expiring within N days (default 7)."""
    user_id = get_jwt_identity()
    days = request.args.get('days', 7, type=int)

    items, error = InventoryService.get_expiring_items(user_id, days=days)
    if error:
        return jsonify({'success': False, 'error': 'Internal Server Error', 'message': error}), 500

    return jsonify({
        'success': True,
        'data': items
    }), 200


@inventory_bp.route('/import', methods=['POST'])
@jwt_required()
@role_required(['BUSINESS'])
def import_inventory_csv():
    """Bulk imports inventory items from uploaded CSV file."""
    user_id = get_jwt_identity()
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': 'Bad Request', 'message': 'No CSV file uploaded.'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'error': 'Bad Request', 'message': 'No file selected.'}), 400

    if not file.filename.endswith('.csv'):
        return jsonify({'success': False, 'error': 'Bad Request', 'message': 'File must be a CSV format.'}), 400

    summary, error = InventoryService.import_csv(user_id, file.stream)
    if error:
        return jsonify({'success': False, 'error': 'CSV Import Error', 'message': error}), 400

    return jsonify({
        'success': True,
        'message': f"CSV import complete. {summary['imported_count']} items imported, {summary['failed_count']} failed.",
        'data': summary
    }), 200


@inventory_bp.route('/export', methods=['GET'])
@jwt_required()
@role_required(['BUSINESS'])
def export_inventory_csv():
    """Exports user inventory records as downloadable CSV file."""
    user_id = get_jwt_identity()
    csv_data, error = InventoryService.export_csv(user_id)
    if error:
        return jsonify({'success': False, 'error': 'Export Error', 'message': error}), 500

    return Response(
        csv_data,
        mimetype="text/csv",
        headers={"Content-disposition": "attachment; filename=inventory_export.csv"}
    )


@inventory_bp.route('/template', methods=['GET'])
def download_sample_csv_template():
    """Downloads sample template CSV for reference."""
    csv_data, _ = InventoryService.get_sample_csv_template()
    return Response(
        csv_data,
        mimetype="text/csv",
        headers={"Content-disposition": "attachment; filename=sample_inventory_template.csv"}
    )


@inventory_bp.route('/<item_id>', methods=['GET'])
@jwt_required()
@role_required(['BUSINESS'])
def get_inventory_item(item_id):
    """Fetches single inventory item details."""
    user_id = get_jwt_identity()
    item, error = InventoryService.get_item(item_id, user_id)
    if error:
        return jsonify({'success': False, 'error': 'Not Found', 'message': error}), 404

    return jsonify({
        'success': True,
        'data': item
    }), 200


@inventory_bp.route('/<item_id>', methods=['PUT'])
@jwt_required()
@role_required(['BUSINESS'])
def update_inventory_item(item_id):
    """Updates existing inventory item."""
    user_id = get_jwt_identity()
    data = request.get_json() or {}

    item, error = InventoryService.update_item(item_id, user_id, data)
    if error:
        status_code = 404 if isinstance(error, str) and "not found" in error.lower() else 400
        return jsonify({'success': False, 'error': 'Update Error', 'details': error}), status_code

    return jsonify({
        'success': True,
        'message': 'Inventory item updated successfully.',
        'data': item
    }), 200


@inventory_bp.route('/<item_id>', methods=['DELETE'])
@jwt_required()
@role_required(['BUSINESS'])
def delete_inventory_item(item_id):
    """Deletes inventory item."""
    user_id = get_jwt_identity()
    success, error = InventoryService.delete_item(item_id, user_id)
    if error:
        return jsonify({'success': False, 'error': 'Not Found', 'message': error}), 404

    return jsonify({
        'success': True,
        'message': 'Inventory item deleted successfully.'
    }), 200


@inventory_bp.route('/pos-sync', methods=['POST'])
@jwt_required()
@role_required(['BUSINESS'])
def pos_sync():
    """Syncs/imports inventory items from a POS source payload."""
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    items_list = data.get('items')

    if items_list is None:
        return jsonify({'success': False, 'error': 'Bad Request', 'message': 'items field is required.'}), 400

    summary, error = InventoryService.sync_pos_items(user_id, items_list)
    if error:
        return jsonify({'success': False, 'error': 'POS Sync Error', 'message': error}), 400

    return jsonify({
        'success': True,
        'message': f"POS inventory sync completed. {summary['imported_count']} items imported, {summary['updated_count']} updated, {summary['failed_count']} failed.",
        'data': summary
    }), 200
