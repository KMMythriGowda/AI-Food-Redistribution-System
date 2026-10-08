"""
Inventory Repository Layer
"""
from datetime import date, datetime, timedelta
from sqlalchemy import or_, func, asc, desc
from app.extensions import db
from app.models.inventory import InventoryItem
from app.models.enums import InventoryCategory, InventoryStatus, StorageType, RiskLevel

class InventoryRepository:

    @staticmethod
    def get_by_id(item_id: str, user_id: str = None) -> InventoryItem:
        """Finds an inventory item by ID, optionally scoped to a user."""
        query = InventoryItem.query.filter_by(id=item_id)
        if user_id:
            query = query.filter_by(user_id=user_id)
        return query.first()

    @staticmethod
    def list(
        user_id: str,
        search_query: str = None,
        category: str = None,
        status: str = None,
        storage_type: str = None,
        supplier: str = None,
        sort_by: str = 'expiry_date',
        order: str = 'asc',
        page: int = 1,
        per_page: int = 20
    ):
        """Fetches paginated, filtered, and sorted inventory items for a user."""
        query = InventoryItem.query.filter_by(user_id=user_id)

        # Search by Product Name, Category, Supplier, or Barcode
        if search_query and search_query.strip():
            term = f"%{search_query.strip()}%"
            query = query.filter(
                or_(
                    InventoryItem.product_name.ilike(term),
                    InventoryItem.supplier.ilike(term),
                    InventoryItem.barcode.ilike(term),
                    InventoryItem.description.ilike(term)
                )
            )

        # Filters
        if category and category.strip():
            query = query.filter(InventoryItem.category == category)

        if storage_type and storage_type.strip():
            query = query.filter(InventoryItem.storage_type == storage_type)

        if supplier and supplier.strip():
            query = query.filter(InventoryItem.supplier.ilike(f"%{supplier.strip()}%"))

        # Calculated-status filtering must happen before pagination so totals/pages are correct.
        if status and status.strip():
            wanted = status.strip().lower()
            today = date.today()
            soon = today + timedelta(days=3)
            not_donated = InventoryItem.status != InventoryStatus.DONATED
            if wanted == InventoryStatus.DONATED.value.lower():
                query = query.filter(InventoryItem.status == InventoryStatus.DONATED)
            elif wanted == InventoryStatus.EXPIRED.value.lower():
                query = query.filter(not_donated, InventoryItem.expiry_date < today)
            elif wanted == InventoryStatus.EXPIRING_SOON.value.lower():
                query = query.filter(not_donated, InventoryItem.expiry_date >= today, InventoryItem.expiry_date <= soon)
            elif wanted == InventoryStatus.LOW_STOCK.value.lower():
                query = query.filter(not_donated, InventoryItem.expiry_date > soon, InventoryItem.quantity <= InventoryItem.low_stock_threshold)
            elif wanted == InventoryStatus.FRESH.value.lower():
                query = query.filter(not_donated, InventoryItem.expiry_date > soon, InventoryItem.quantity > InventoryItem.low_stock_threshold)

        # Sorting
        sort_column = InventoryItem.expiry_date
        if sort_by == 'product_name':
            sort_column = InventoryItem.product_name
        elif sort_by == 'quantity':
            sort_column = InventoryItem.quantity
        elif sort_by == 'created_at' or sort_by == 'newest':
            sort_column = InventoryItem.created_at
            order = 'desc'
        elif sort_by == 'oldest':
            sort_column = InventoryItem.created_at
            order = 'asc'

        if order.lower() == 'desc':
            query = query.order_by(desc(sort_column))
        else:
            query = query.order_by(asc(sort_column))

        # Execute pagination after every filter has been applied.
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        return pagination.items, pagination.total, pagination.pages

    @staticmethod
    def create(item_data: dict) -> InventoryItem:
        """Creates and persists a new inventory item."""
        item = InventoryItem(**item_data)
        db.session.add(item)
        db.session.commit()
        return item

    @staticmethod
    def update(item: InventoryItem, update_data: dict) -> InventoryItem:
        """Updates an existing inventory item."""
        for key, value in update_data.items():
            if hasattr(item, key):
                setattr(item, key, value)
        db.session.commit()
        return item

    @staticmethod
    def delete(item: InventoryItem) -> bool:
        """Deletes an inventory item."""
        db.session.delete(item)
        db.session.commit()
        return True

    @staticmethod
    def get_dashboard_stats(user_id: str) -> dict:
        """Computes comprehensive inventory health & dashboard metrics."""
        all_items = InventoryItem.query.filter_by(user_id=user_id).all()
        today = date.today()

        total_products = len(all_items)
        total_inventory_value = sum(item.quantity * item.selling_price for item in all_items)
        
        fresh_count = 0
        expiring_soon_count = 0
        expired_count = 0
        low_stock_count = 0
        todays_expiry_count = 0
        total_shelf_days = 0
        valid_shelf_items = 0

        category_dist = {}
        storage_dist = {}

        timeline_today = 0
        timeline_tomorrow = 0
        timeline_next_7_days = 0
        timeline_next_30_days = 0

        expiry_calendar = {}  # { 'YYYY-MM-DD': count }

        for item in all_items:
            # Distribution counts
            cat_name = item.category.value if isinstance(item.category, InventoryCategory) else str(item.category)
            category_dist[cat_name] = category_dist.get(cat_name, 0) + 1

            st_name = item.storage_type.value if isinstance(item.storage_type, StorageType) else str(item.storage_type)
            storage_dist[st_name] = storage_dist.get(st_name, 0) + 1

            # Shelf life calculation
            if item.purchase_date and item.expiry_date:
                p_date = item.purchase_date if isinstance(item.purchase_date, date) else item.purchase_date.date()
                e_date = item.expiry_date if isinstance(item.expiry_date, date) else item.expiry_date.date()
                shelf_days = (e_date - p_date).days
                if shelf_days > 0:
                    total_shelf_days += shelf_days
                    valid_shelf_items += 1

            # Status classification
            comp_status = item.computed_status
            if comp_status == InventoryStatus.EXPIRED.value:
                expired_count += 1
            elif comp_status == InventoryStatus.EXPIRING_SOON.value:
                expiring_soon_count += 1
            elif comp_status == InventoryStatus.LOW_STOCK.value:
                low_stock_count += 1
            else:
                fresh_count += 1

            # Expiry timeline
            days = item.days_remaining
            if days == 0:
                todays_expiry_count += 1
                timeline_today += 1
            elif days == 1:
                timeline_tomorrow += 1
            if 0 <= days <= 7:
                timeline_next_7_days += 1
            if 0 <= days <= 30:
                timeline_next_30_days += 1

            # Expiry calendar aggregation
            if item.expiry_date:
                e_str = item.expiry_date.isoformat()
                expiry_calendar[e_str] = expiry_calendar.get(e_str, 0) + 1

        # Inventory Health Score Calculation (0 - 100)
        if total_products > 0:
            penalty = (expired_count * 25) + (expiring_soon_count * 10) + (low_stock_count * 5)
            raw_score = max(0, 100 - (penalty / total_products * 10))
            health_score = round(min(100, raw_score), 1)
        else:
            health_score = 100.0

        if health_score >= 85:
            health_status = "Excellent"
        elif health_score >= 70:
            health_status = "Good"
        elif health_score >= 50:
            health_status = "Warning"
        else:
            health_status = "Critical"

        avg_shelf_life = round(total_shelf_days / valid_shelf_items, 1) if valid_shelf_items > 0 else 0

        # Recent Inventory items (last 5 created)
        recent_items = [
            item.to_dict() for item in sorted(all_items, key=lambda x: x.created_at or datetime.min, reverse=True)[:5]
        ]

        # Todays Expiry Alert list
        todays_alerts = [
            item.to_dict() for item in all_items if item.days_remaining <= 3 and item.days_remaining >= 0
        ]

        return {
            'total_products': total_products,
            'total_inventory_value': round(total_inventory_value, 2),
            'fresh_count': fresh_count,
            'expiring_soon_count': expiring_soon_count,
            'expired_count': expired_count,
            'low_stock_count': low_stock_count,
            'todays_expiry_count': todays_expiry_count,
            'health_score': health_score,
            'health_status': health_status,
            'avg_shelf_life_days': avg_shelf_life,
            'category_distribution': category_dist,
            'storage_distribution': storage_dist,
            'expiry_timeline': {
                'today': timeline_today,
                'tomorrow': timeline_tomorrow,
                'next_7_days': timeline_next_7_days,
                'next_30_days': timeline_next_30_days,
            },
            'expiry_calendar': expiry_calendar,
            'todays_alerts': todays_alerts,
            'recent_inventory': recent_items
        }

    @staticmethod
    def get_expiring(user_id: str, days: int = 7) -> list:
        """Fetches items expiring within N days."""
        today = date.today()
        target_date = today + timedelta(days=days)
        items = InventoryItem.query.filter(
            InventoryItem.user_id == user_id,
            InventoryItem.expiry_date >= today,
            InventoryItem.expiry_date <= target_date
        ).order_by(asc(InventoryItem.expiry_date)).all()

        return [item.to_dict() for item in items]
