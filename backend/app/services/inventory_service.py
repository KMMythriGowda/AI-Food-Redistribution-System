"""
Inventory Service Business Logic Layer
"""
import csv
import io
from datetime import datetime, date
from marshmallow import ValidationError
from app.extensions import db
from app.models.enums import InventoryCategory, StorageType, InventoryStatus
from app.models.inventory import InventoryItem
from app.repositories.inventory_repository import InventoryRepository
from app.schemas.inventory_schema import (
    inventory_create_schema,
    inventory_update_schema,
    inventory_item_schema,
    inventory_items_schema
)

class InventoryService:

    @staticmethod
    def get_item(item_id: str, user_id: str):
        """Fetches item by ID for current user."""
        item = InventoryRepository.get_by_id(item_id, user_id=user_id)
        if not item:
            return None, "Inventory item not found."
        return item.to_dict(), None

    @staticmethod
    def list_items(user_id: str, params: dict):
        """Fetches paginated list of inventory items."""
        search_query = params.get('search')
        category = params.get('category')
        status = params.get('status')
        storage_type = params.get('storage_type')
        supplier = params.get('supplier')
        sort_by = params.get('sort_by', 'expiry_date')
        order = params.get('order', 'asc')
        page = int(params.get('page', 1))
        per_page = int(params.get('per_page', 20))

        items, total, pages = InventoryRepository.list(
            user_id=user_id,
            search_query=search_query,
            category=category,
            status=status,
            storage_type=storage_type,
            supplier=supplier,
            sort_by=sort_by,
            order=order,
            page=page,
            per_page=per_page
        )

        serialized_items = [item.to_dict() for item in items]

        return {
            'items': serialized_items,
            'pagination': {
                'total': total,
                'page': page,
                'per_page': per_page,
                'pages': pages
            }
        }, None

    @staticmethod
    def create_item(user_id: str, payload: dict):
        """Creates a new inventory item."""
        try:
            validated_data = inventory_create_schema.load(payload)
        except ValidationError as err:
            return None, err.messages

        validated_data['user_id'] = user_id
        item = InventoryRepository.create(validated_data)
        return item.to_dict(), None

    @staticmethod
    def update_item(item_id: str, user_id: str, payload: dict):
        """Updates an existing inventory item."""
        item = InventoryRepository.get_by_id(item_id, user_id=user_id)
        if not item:
            return None, "Inventory item not found."

        try:
            validated_data = inventory_update_schema.load(payload)
        except ValidationError as err:
            return None, err.messages

        updated_item = InventoryRepository.update(item, validated_data)
        return updated_item.to_dict(), None

    @staticmethod
    def delete_item(item_id: str, user_id: str):
        """Deletes an inventory item."""
        item = InventoryRepository.get_by_id(item_id, user_id=user_id)
        if not item:
            return False, "Inventory item not found."

        InventoryRepository.delete(item)
        return True, None

    @staticmethod
    def get_dashboard_summary(user_id: str):
        """Returns dashboard summary stats for business user."""
        return InventoryRepository.get_dashboard_stats(user_id), None

    @staticmethod
    def get_expiring_items(user_id: str, days: int = 7):
        """Returns list of items expiring within N days."""
        return InventoryRepository.get_expiring(user_id, days=days), None

    @staticmethod
    def import_csv(user_id: str, file_stream):
        """Parse and bulk import CSV rows while reporting invalid rows safely."""
        try:
            raw = file_stream.read().decode("UTF-8-sig")
        except UnicodeDecodeError:
            return None, "CSV must be UTF-8 encoded."

        stream = io.StringIO(raw, newline=None)
        csv_reader = csv.DictReader(stream)
        required_headers = {'product_name', 'category', 'quantity', 'expiry_date'}
        headers = set(csv_reader.fieldnames or [])
        missing = sorted(required_headers - headers)
        if missing:
            return None, f"CSV is missing required header(s): {', '.join(missing)}"

        successful_items = []
        failed_rows = []
        total_rows = 0
        valid_categories = [c.value.lower() for c in InventoryCategory]
        category_map = {c.value.lower(): c for c in InventoryCategory}
        storage_map = {s.value.lower(): s for s in StorageType}

        def parse_optional_float(row, field, default, errors):
            raw_value = (row.get(field) or '').strip()
            if raw_value == '':
                return float(default)
            try:
                value = float(raw_value)
            except ValueError:
                errors.append(f"Invalid {field} '{raw_value}'. Must be numeric.")
                return float(default)
            if value < 0:
                errors.append(f"{field} must be non-negative.")
            return value

        try:
            for row_index, row in enumerate(csv_reader, start=2):
                total_rows += 1
                product_name = (row.get('product_name') or '').strip()
                category_raw = (row.get('category') or '').strip()
                quantity_raw = (row.get('quantity') or '').strip()
                unit_raw = (row.get('unit') or 'units').strip()
                expiry_raw = (row.get('expiry_date') or '').strip()
                errors = []

                if not product_name:
                    errors.append("Product name is required.")
                if not category_raw:
                    errors.append("Category is required.")
                elif category_raw.lower() not in valid_categories:
                    errors.append(f"Invalid category '{category_raw}'. Valid options: {', '.join([c.value for c in InventoryCategory])}")
                if not expiry_raw:
                    errors.append("Expiry date is required.")

                try:
                    quantity = float(quantity_raw) if quantity_raw else 0.0
                    if quantity < 0:
                        errors.append("Quantity must be non-negative.")
                except ValueError:
                    errors.append(f"Invalid quantity '{quantity_raw}'. Must be a number.")
                    quantity = 0.0

                expiry_date = None
                if expiry_raw:
                    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d"):
                        try:
                            expiry_date = datetime.strptime(expiry_raw, fmt).date()
                            break
                        except ValueError:
                            pass
                    if not expiry_date:
                        errors.append(f"Invalid expiry date '{expiry_raw}'. Format should be YYYY-MM-DD.")

                cost_price = parse_optional_float(row, 'cost_price', 0.0, errors)
                selling_price = parse_optional_float(row, 'selling_price', 0.0, errors)
                low_stock_threshold = parse_optional_float(row, 'low_stock_threshold', 5.0, errors)

                purchase_date = None
                purchase_raw = (row.get('purchase_date') or '').strip()
                if purchase_raw:
                    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
                        try:
                            purchase_date = datetime.strptime(purchase_raw, fmt).date()
                            break
                        except ValueError:
                            pass
                    if purchase_date is None:
                        errors.append(f"Invalid purchase date '{purchase_raw}'. Format should be YYYY-MM-DD.")

                if errors:
                    failed_rows.append({'row': row_index, 'product_name': product_name or 'N/A', 'errors': errors})
                    continue

                item = InventoryItem(
                    user_id=user_id,
                    product_name=product_name,
                    category=category_map.get(category_raw.lower(), InventoryCategory.OTHERS),
                    description=(row.get('description') or '').strip() or None,
                    quantity=quantity,
                    unit=unit_raw or 'units',
                    purchase_date=purchase_date,
                    expiry_date=expiry_date,
                    storage_type=storage_map.get((row.get('storage_type') or '').strip().lower(), StorageType.AMBIENT),
                    supplier=(row.get('supplier') or '').strip() or None,
                    cost_price=cost_price,
                    selling_price=selling_price,
                    barcode=(row.get('barcode') or '').strip() or None,
                    low_stock_threshold=low_stock_threshold,
                )
                db.session.add(item)
                db.session.flush()
                successful_items.append(item.to_dict())

            db.session.commit()
        except Exception as exc:
            db.session.rollback()
            return None, f"CSV import failed: {exc}"

        return {
            'total_rows': total_rows,
            'imported_count': len(successful_items),
            'failed_count': len(failed_rows),
            'failed_rows': failed_rows,
            'successful_items': successful_items
        }, None


    @staticmethod
    def export_csv(user_id: str):
        """Generates downloadable CSV file string containing all user inventory records."""
        items = InventoryItem.query.filter_by(user_id=user_id).order_by(InventoryItem.expiry_date.asc()).all()

        output = io.StringIO()
        writer = csv.writer(output)

        # CSV Header
        writer.writerow([
            'id', 'product_name', 'category', 'description', 'quantity', 'unit',
            'expiry_date', 'purchase_date', 'storage_type', 'supplier',
            'cost_price', 'selling_price', 'barcode', 'status', 'days_remaining', 'risk_level'
        ])

        for item in items:
            d = item.to_dict()
            writer.writerow([
                d['id'],
                d['product_name'],
                d['category'],
                d['description'] or '',
                d['quantity'],
                d['unit'],
                d['expiry_date'],
                d['purchase_date'] or '',
                d['storage_type'],
                d['supplier'] or '',
                d['cost_price'],
                d['selling_price'],
                d['barcode'] or '',
                d['status'],
                d['days_remaining'],
                d['risk_level']
            ])

        return output.getvalue(), None

    @staticmethod
    def get_sample_csv_template():
        """Generates sample template CSV string for users to reference when uploading."""
        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow([
            'product_name', 'category', 'description', 'quantity', 'unit',
            'purchase_date', 'expiry_date', 'storage_type', 'supplier',
            'cost_price', 'selling_price', 'barcode', 'low_stock_threshold'
        ])

        writer.writerow([
            'Organic Milk 1L', 'Dairy', 'Fresh whole milk', '25', 'liters',
            '2026-08-01', '2026-08-10', 'Refrigerated', 'Dairy Farm LLC',
            '1.50', '2.99', 'BAR-88214', '5'
        ])

        writer.writerow([
            'Whole Wheat Bread', 'Bakery', 'Artisanal sliced loaf', '15', 'packs',
            '2026-07-30', '2026-08-05', 'Ambient', 'City Bakery',
            '0.80', '1.99', 'BAR-99312', '4'
        ])

        return output.getvalue(), None

    @staticmethod
    def sync_pos_items(user_id: str, items_list: list):
        """Synchronize external POS items safely and tenant-locally."""
        if not isinstance(items_list, list):
            return None, "Payload must be a list of inventory items."

        imported_count = 0
        updated_count = 0
        errors = []
        valid_categories = [c.value.lower() for c in InventoryCategory]
        category_map = {c.value.lower(): c for c in InventoryCategory}
        storage_map = {s.value.lower(): s for s in StorageType}

        def optional_number(data, field, default, row_errors):
            raw = data.get(field, default)
            if raw in (None, ''):
                return float(default)
            try:
                value = float(raw)
                if value < 0:
                    row_errors.append(f"{field} must be non-negative.")
                return value
            except (ValueError, TypeError):
                row_errors.append(f"{field} must be a valid number.")
                return float(default)

        try:
            for idx, item_data in enumerate(items_list):
                if not isinstance(item_data, dict):
                    errors.append({"index": idx, "product_name": "N/A", "errors": ["Item must be an object."]})
                    continue

                product_name = str(item_data.get('product_name') or '').strip()
                category_raw = str(item_data.get('category') or '').strip()
                expiry_raw = str(item_data.get('expiry_date') or '').strip()
                row_errors = []

                if not product_name:
                    row_errors.append("product_name is required.")
                if not category_raw:
                    row_errors.append("category is required.")
                elif category_raw.lower() not in valid_categories:
                    row_errors.append(f"Invalid category '{category_raw}'.")
                if not expiry_raw:
                    row_errors.append("expiry_date is required.")

                quantity = optional_number(item_data, 'quantity', -1.0, row_errors)
                if quantity < 0 and "quantity must be non-negative." not in row_errors:
                    row_errors.append("quantity must be non-negative.")
                cost_price = optional_number(item_data, 'cost_price', 0.0, row_errors)
                selling_price = optional_number(item_data, 'selling_price', 0.0, row_errors)
                low_stock_threshold = optional_number(item_data, 'low_stock_threshold', 5.0, row_errors)

                expiry_date = None
                if expiry_raw:
                    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d"):
                        try:
                            expiry_date = datetime.strptime(expiry_raw, fmt).date()
                            break
                        except ValueError:
                            pass
                    if not expiry_date:
                        row_errors.append(f"Invalid expiry_date '{expiry_raw}'. Format should be YYYY-MM-DD.")

                if row_errors:
                    errors.append({"index": idx, "product_name": product_name or "N/A", "errors": row_errors})
                    continue

                category = category_map.get(category_raw.lower(), InventoryCategory.OTHERS)
                barcode = str(item_data.get('barcode') or '').strip() or None
                storage_type = storage_map.get(str(item_data.get('storage_type') or '').strip().lower(), StorageType.AMBIENT)
                query = InventoryItem.query.filter_by(user_id=user_id, product_name=product_name, expiry_date=expiry_date)
                if barcode:
                    query = query.filter_by(barcode=barcode)
                existing_item = query.first()

                if existing_item:
                    existing_item.quantity += quantity
                    existing_item.selling_price = selling_price if item_data.get('selling_price') is not None else existing_item.selling_price
                    existing_item.cost_price = cost_price if item_data.get('cost_price') is not None else existing_item.cost_price
                    existing_item.low_stock_threshold = low_stock_threshold if item_data.get('low_stock_threshold') is not None else existing_item.low_stock_threshold
                    updated_count += 1
                else:
                    db.session.add(InventoryItem(
                        user_id=user_id, product_name=product_name, category=category,
                        description=str(item_data.get('description') or '').strip() or None,
                        quantity=quantity, unit=str(item_data.get('unit') or 'units').strip() or 'units',
                        purchase_date=date.today(), expiry_date=expiry_date, storage_type=storage_type,
                        cost_price=cost_price, selling_price=selling_price, barcode=barcode,
                        low_stock_threshold=low_stock_threshold,
                    ))
                    imported_count += 1

            db.session.commit()
        except Exception as exc:
            db.session.rollback()
            return None, f"POS sync failed: {exc}"

        return {
            "total_processed": len(items_list),
            "imported_count": imported_count,
            "updated_count": updated_count,
            "failed_count": len(errors),
            "errors": errors
        }, None

