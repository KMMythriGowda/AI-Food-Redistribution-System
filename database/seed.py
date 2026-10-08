"""
Database Seed Script
Initializes default Admin, Business, and NGO test accounts.
"""
import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../backend')))

from app import create_app
from app.extensions import db
from app.models.user import User
from app.models.enums import UserRole, InventoryCategory, StorageType, InventoryStatus
from app.models.inventory import InventoryItem


def seed_database():
    app = create_app('development')
    with app.app_context():
        print("Creating database tables...")
        db.create_all()

        print("Seeding test accounts...")
        
        # 1. Admin Account
        if not User.query.filter_by(email='admin@foodredistribution.org').first():
            admin = User(
                email='admin@foodredistribution.org',
                full_name='System Administrator',
                organization_name='Food Redistribution Platform',
                role=UserRole.ADMIN,
                phone='+1234567890',
                is_verified=True,
                is_active=True
            )
            admin.set_password('AdminPass123!')
            db.session.add(admin)
            print(" -> Created Admin: admin@foodredistribution.org")

        # 2. Business Account
        if not User.query.filter_by(email='supermarket@freshmart.com').first():
            business = User(
                email='supermarket@freshmart.com',
                full_name='FreshMart Supermarket',
                organization_name='FreshMart Outlets',
                role=UserRole.BUSINESS,
                phone='+1987654321',
                address='123 Retail Ave, Cityville',
                is_verified=True,
                is_active=True
            )
            business.set_password('BusinessPass123!')
            db.session.add(business)
            print(" -> Created Business: supermarket@freshmart.com")

        # 3. NGO Account
        if not User.query.filter_by(email='foodbank@communitycare.org').first():
            ngo = User(
                email='foodbank@communitycare.org',
                full_name='Community Care Foodbank',
                organization_name='Community Care Foundation',
                role=UserRole.NGO,
                phone='+1555666777',
                address='456 Hope Street, Metrocity',
                is_verified=True,
                is_active=True
            )
            ngo.set_password('NgoPass123!')
            db.session.add(ngo)
            print(" -> Created NGO: foodbank@communitycare.org")

        db.session.commit()

        # Seed sample inventory items for FreshMart Business Account
        business_user = User.query.filter_by(email='supermarket@freshmart.com').first()
        if business_user and not InventoryItem.query.filter_by(user_id=business_user.id).first():
            from datetime import date, timedelta
            today = date.today()

            sample_items = [
                {
                    'user_id': business_user.id,
                    'product_name': 'Organic Whole Milk 1L',
                    'category': InventoryCategory.DAIRY,
                    'description': 'Pasteurized fresh organic milk',
                    'quantity': 35.0,
                    'unit': 'liters',
                    'purchase_date': today - timedelta(days=5),
                    'expiry_date': today + timedelta(days=2),  # Expiring soon
                    'storage_type': StorageType.REFRIGERATED,
                    'storage_temperature': 4.0,
                    'supplier': 'GreenValley Dairy',
                    'cost_price': 1.20,
                    'selling_price': 2.49,
                    'barcode': 'BAR-10029384',
                    'low_stock_threshold': 5.0,
                    'status': InventoryStatus.FRESH
                },
                {
                    'user_id': business_user.id,
                    'product_name': 'Artisanal Sliced Bread',
                    'category': InventoryCategory.BAKERY,
                    'description': 'Freshly baked whole wheat sliced loaf',
                    'quantity': 18.0,
                    'unit': 'packs',
                    'purchase_date': today - timedelta(days=2),
                    'expiry_date': today + timedelta(days=1),  # Expiring soon (Tomorrow)
                    'storage_type': StorageType.AMBIENT,
                    'supplier': 'Sunrise Bakery',
                    'cost_price': 0.80,
                    'selling_price': 1.99,
                    'barcode': 'BAR-20098471',
                    'low_stock_threshold': 5.0,
                    'status': InventoryStatus.FRESH
                },
                {
                    'user_id': business_user.id,
                    'product_name': 'Fresh Strawberries 500g',
                    'category': InventoryCategory.FRUITS,
                    'description': 'Sweet farm strawberries',
                    'quantity': 4.0,  # Low stock
                    'unit': 'boxes',
                    'purchase_date': today - timedelta(days=3),
                    'expiry_date': today + timedelta(days=5),
                    'storage_type': StorageType.REFRIGERATED,
                    'supplier': 'Berry Farm Products',
                    'cost_price': 2.00,
                    'selling_price': 3.99,
                    'barcode': 'BAR-30018472',
                    'low_stock_threshold': 10.0,
                    'status': InventoryStatus.FRESH
                },
                {
                    'user_id': business_user.id,
                    'product_name': 'Greek Yogurt Vanilla 200g',
                    'category': InventoryCategory.DAIRY,
                    'description': 'High-protein vanilla yogurt',
                    'quantity': 0.0,
                    'unit': 'cups',
                    'purchase_date': today - timedelta(days=15),
                    'expiry_date': today - timedelta(days=1),  # Expired yesterday
                    'storage_type': StorageType.REFRIGERATED,
                    'supplier': 'GreenValley Dairy',
                    'cost_price': 0.90,
                    'selling_price': 1.89,
                    'barcode': 'BAR-40082736',
                    'low_stock_threshold': 5.0,
                    'status': InventoryStatus.FRESH
                },
                {
                    'user_id': business_user.id,
                    'product_name': 'Frozen Mixed Vegetables 1kg',
                    'category': InventoryCategory.FROZEN_FOODS,
                    'description': 'Carrots, peas, corn & green beans mix',
                    'quantity': 50.0,
                    'unit': 'bags',
                    'purchase_date': today - timedelta(days=10),
                    'expiry_date': today + timedelta(days=180),
                    'storage_type': StorageType.FROZEN,
                    'storage_temperature': -18.0,
                    'supplier': 'Arctic Foods Co.',
                    'cost_price': 1.50,
                    'selling_price': 3.49,
                    'barcode': 'BAR-50091823',
                    'low_stock_threshold': 8.0,
                    'status': InventoryStatus.FRESH
                }
            ]

            for item_dict in sample_items:
                item = InventoryItem(**item_dict)
                db.session.add(item)

            db.session.commit()
            print(" -> Created 5 sample inventory items for FreshMart Supermarket.")

        print("Database seed completed successfully!")


if __name__ == '__main__':
    seed_database()
