"""
Inventory REST APIs & Expiry Tracking Unit Test Suite
"""
import io
import pytest
from datetime import date, timedelta
from app import create_app
from app.extensions import db
from app.models.user import User
from app.models.enums import UserRole, InventoryCategory, StorageType, InventoryStatus

@pytest.fixture
def app_instance():
    app = create_app('testing')
    with app.app_context():
        db.create_all()
        yield app
        db.drop_all()

@pytest.fixture
def client(app_instance):
    return app_instance.test_client()

@pytest.fixture
def business_auth_headers(client):
    """Fixture creating a Business user and returning Authorization header."""
    reg_res = client.post('/api/auth/register', json={
        'email': 'biztester@test.com',
        'password': 'Password123!',
        'full_name': 'Biz Owner',
        'role': 'BUSINESS'
    })
    token = reg_res.get_json()['data']['access_token']
    return {'Authorization': f'Bearer {token}'}

@pytest.fixture
def ngo_auth_headers(client):
    """Fixture creating an NGO user and returning Authorization header."""
    reg_res = client.post('/api/auth/register', json={
        'email': 'ngotester@test.com',
        'password': 'Password123!',
        'full_name': 'NGO User',
        'role': 'NGO'
    })
    token = reg_res.get_json()['data']['access_token']
    return {'Authorization': f'Bearer {token}'}


def test_create_inventory_item(client, business_auth_headers):
    """Test creating a new inventory item."""
    today = date.today()
    exp_date = (today + timedelta(days=10)).isoformat()

    payload = {
        'product_name': 'Organic Apples',
        'category': 'Fruits',
        'description': 'Crisp red apples',
        'quantity': 50.0,
        'unit': 'kg',
        'expiry_date': exp_date,
        'storage_type': 'Ambient',
        'supplier': 'Fresh Orchard',
        'cost_price': 1.50,
        'selling_price': 2.99,
        'barcode': 'BAR-99001'
    }

    res = client.post('/api/inventory', json=payload, headers=business_auth_headers)
    assert res.status_code == 201
    data = res.get_json()
    assert data['success'] is True
    assert data['data']['product_name'] == 'Organic Apples'
    assert data['data']['days_remaining'] == 10
    assert data['data']['risk_level'] == 'Low'


def test_get_inventory_item_details(client, business_auth_headers):
    """Test fetching details of a created inventory item."""
    exp_date = (date.today() + timedelta(days=2)).isoformat()
    item_res = client.post('/api/inventory', json={
        'product_name': 'Fresh Salmon',
        'category': 'Seafood',
        'quantity': 10.0,
        'unit': 'kg',
        'expiry_date': exp_date,
        'storage_type': 'Refrigerated'
    }, headers=business_auth_headers)

    item_id = item_res.get_json()['data']['id']

    res = client.get(f'/api/inventory/{item_id}', headers=business_auth_headers)
    assert res.status_code == 200
    data = res.get_json()
    assert data['data']['product_name'] == 'Fresh Salmon'
    assert data['data']['days_remaining'] == 2
    assert data['data']['risk_level'] == 'High'
    assert data['data']['status'] == 'Expiring Soon'


def test_update_inventory_item(client, business_auth_headers):
    """Test updating quantity and details of an inventory item."""
    item_res = client.post('/api/inventory', json={
        'product_name': 'Cheddar Cheese',
        'category': 'Dairy',
        'quantity': 20.0,
        'unit': 'blocks',
        'expiry_date': (date.today() + timedelta(days=15)).isoformat()
    }, headers=business_auth_headers)

    item_id = item_res.get_json()['data']['id']

    update_res = client.put(f'/api/inventory/{item_id}', json={
        'quantity': 3.0,  # Low stock threshold trigger
        'low_stock_threshold': 5.0
    }, headers=business_auth_headers)

    assert update_res.status_code == 200
    data = update_res.get_json()
    assert data['data']['quantity'] == 3.0
    assert data['data']['status'] == 'Low Stock'


def test_delete_inventory_item(client, business_auth_headers):
    """Test deleting an inventory item."""
    item_res = client.post('/api/inventory', json={
        'product_name': 'Orange Juice',
        'category': 'Beverages',
        'quantity': 12.0,
        'unit': 'bottles',
        'expiry_date': (date.today() + timedelta(days=20)).isoformat()
    }, headers=business_auth_headers)

    item_id = item_res.get_json()['data']['id']

    del_res = client.delete(f'/api/inventory/{item_id}', headers=business_auth_headers)
    assert del_res.status_code == 200

    # Verify 404 on fetch
    get_res = client.get(f'/api/inventory/{item_id}', headers=business_auth_headers)
    assert get_res.status_code == 404


def test_search_and_filter_inventory(client, business_auth_headers):
    """Test multi-field search and category filtering."""
    today = date.today()
    client.post('/api/inventory', json={
        'product_name': 'Greek Yogurt',
        'category': 'Dairy',
        'quantity': 15.0,
        'expiry_date': (today + timedelta(days=10)).isoformat(),
        'supplier': 'DairyCo'
    }, headers=business_auth_headers)

    client.post('/api/inventory', json={
        'product_name': 'Whole Wheat Loaf',
        'category': 'Bakery',
        'quantity': 8.0,
        'expiry_date': (today + timedelta(days=5)).isoformat(),
        'supplier': 'CityBakery'
    }, headers=business_auth_headers)

    # Search by product name
    search_res = client.get('/api/inventory?search=Yogurt', headers=business_auth_headers)
    assert search_res.status_code == 200
    assert len(search_res.get_json()['data']) == 1
    assert search_res.get_json()['data'][0]['product_name'] == 'Greek Yogurt'

    # Filter by category
    filter_res = client.get('/api/inventory?category=Bakery', headers=business_auth_headers)
    assert filter_res.status_code == 200
    assert len(filter_res.get_json()['data']) == 1
    assert filter_res.get_json()['data'][0]['category'] == 'Bakery'


def test_inventory_dashboard_stats(client, business_auth_headers):
    """Test retrieving dashboard metrics and health score."""
    today = date.today()
    # 1 Fresh
    client.post('/api/inventory', json={
        'product_name': 'Item Fresh',
        'category': 'Grains',
        'quantity': 100.0,
        'selling_price': 2.0,
        'expiry_date': (today + timedelta(days=30)).isoformat()
    }, headers=business_auth_headers)

    # 1 Expiring Soon
    client.post('/api/inventory', json={
        'product_name': 'Item Soon',
        'category': 'Dairy',
        'quantity': 10.0,
        'selling_price': 3.0,
        'expiry_date': (today + timedelta(days=1)).isoformat()
    }, headers=business_auth_headers)

    res = client.get('/api/inventory/dashboard', headers=business_auth_headers)
    assert res.status_code == 200
    data = res.get_json()['data']
    assert data['total_products'] == 2
    assert data['total_inventory_value'] == 230.0
    assert data['fresh_count'] == 1
    assert data['expiring_soon_count'] == 1
    assert 'health_score' in data


def test_csv_export_and_import(client, business_auth_headers):
    """Test CSV export and CSV bulk import functionality."""
    today = date.today()
    client.post('/api/inventory', json={
        'product_name': 'Export Apple',
        'category': 'Fruits',
        'quantity': 30.0,
        'expiry_date': (today + timedelta(days=15)).isoformat()
    }, headers=business_auth_headers)

    # Test export
    export_res = client.get('/api/inventory/export', headers=business_auth_headers)
    assert export_res.status_code == 200
    csv_text = export_res.data.decode('utf-8')
    assert 'Export Apple' in csv_text

    # Test import
    csv_content = f"product_name,category,quantity,unit,expiry_date\nImported Milk,Dairy,12,liters,{(today + timedelta(days=10)).isoformat()}\n"
    file_data = (io.BytesIO(csv_content.encode('utf-8')), 'test_import.csv')

    import_res = client.post(
        '/api/inventory/import',
        data={'file': file_data},
        content_type='multipart/form-data',
        headers=business_auth_headers
    )
    assert import_res.status_code == 200
    data = import_res.get_json()['data']
    assert data['imported_count'] == 1
    assert data['failed_count'] == 0


def test_rbac_inventory_protection(client, ngo_auth_headers):
    """Test that non-Business users (NGO role) are forbidden from managing inventory."""
    res = client.get('/api/inventory', headers=ngo_auth_headers)
    assert res.status_code == 403
    assert res.get_json()['error'] == 'Forbidden'


# =====================================================================
# POS SYNC INTEGRATION TESTS
# =====================================================================

def test_pos_sync_success(client, business_auth_headers):
    """Test successful inventory sync via POS API."""
    today = date.today()
    payload = {
        "items": [
            {
                "product_name": "POS Organic Milk",
                "category": "Dairy",
                "quantity": 10.0,
                "unit": "liters",
                "expiry_date": (today + timedelta(days=10)).isoformat(),
                "barcode": "BAR-POS-001",
                "cost_price": 1.20,
                "selling_price": 2.50
            },
            {
                "product_name": "POS Artisanal Bread",
                "category": "Bakery",
                "quantity": 5.0,
                "unit": "loaves",
                "expiry_date": (today + timedelta(days=2)).isoformat(),
                "barcode": "BAR-POS-002",
                "cost_price": 0.80,
                "selling_price": 1.99
            }
        ]
    }

    res = client.post('/api/inventory/pos-sync', json=payload, headers=business_auth_headers)
    assert res.status_code == 200
    data = res.get_json()
    assert data['success'] is True
    assert data['data']['imported_count'] == 2
    assert data['data']['updated_count'] == 0
    assert data['data']['failed_count'] == 0


def test_pos_sync_duplicate_handling(client, business_auth_headers):
    """Test POS sync handles duplicates by updating quantity instead of duplicate rows."""
    today = date.today()
    # First Sync
    payload1 = {
        "items": [
            {
                "product_name": "POS Milk Duplicate Check",
                "category": "Dairy",
                "quantity": 10.0,
                "expiry_date": (today + timedelta(days=10)).isoformat(),
                "barcode": "BAR-POS-DUP"
            }
        ]
    }
    res1 = client.post('/api/inventory/pos-sync', json=payload1, headers=business_auth_headers)
    assert res1.status_code == 200
    assert res1.get_json()['data']['imported_count'] == 1

    # Second Sync (Duplicate)
    payload2 = {
        "items": [
            {
                "product_name": "POS Milk Duplicate Check",
                "category": "Dairy",
                "quantity": 5.0,
                "expiry_date": (today + timedelta(days=10)).isoformat(),
                "barcode": "BAR-POS-DUP"
            }
        ]
    }
    res2 = client.post('/api/inventory/pos-sync', json=payload2, headers=business_auth_headers)
    assert res2.status_code == 200
    data2 = res2.get_json()
    assert data2['data']['imported_count'] == 0
    assert data2['data']['updated_count'] == 1

    # Verify final quantity is 15.0
    items_res = client.get('/api/inventory?search=POS Milk Duplicate Check', headers=business_auth_headers)
    assert items_res.status_code == 200
    items = items_res.get_json()['data']
    assert len(items) == 1
    assert items[0]['quantity'] == 15.0


def test_pos_sync_invalid_payload(client, business_auth_headers):
    """Test POS sync validation and error handling."""
    payload = {
        "items": [
            {
                "product_name": "",  # missing name
                "category": "Dairy",
                "quantity": 10.0,
                "expiry_date": "2026-09-10"
            },
            {
                "product_name": "Invalid Category Milk",
                "category": "WrongCategoryName",  # invalid category
                "quantity": 10.0,
                "expiry_date": "2026-09-10"
            },
            {
                "product_name": "Invalid Qty Milk",
                "category": "Dairy",
                "quantity": -5.0,  # negative qty
                "expiry_date": "2026-09-10"
            },
            {
                "product_name": "Invalid Date Milk",
                "category": "Dairy",
                "quantity": 10.0,
                "expiry_date": "not-a-date"  # invalid date
            }
        ]
    }

    res = client.post('/api/inventory/pos-sync', json=payload, headers=business_auth_headers)
    assert res.status_code == 200
    data = res.get_json()
    assert data['data']['failed_count'] == 4
    assert len(data['data']['errors']) == 4


# =====================================================================
# AUTOMATED EXPIRY ALERTS TESTS
# =====================================================================

def test_expiry_alerts_jobs(app_instance, client, business_auth_headers):
    """Test automated background notifications generation for approaching/expired items."""
    from app.ai.jobs.scheduler import run_daily_prediction_job
    from app.models.notification import Notification

    # Clear previous notifications
    with app_instance.app_context():
        Notification.query.delete()
        db.session.commit()

    today = date.today()

    # 1. Product approaching expiry (1 day)
    client.post('/api/inventory', json={
        'product_name': 'Approaching Expiry Milk',
        'category': 'Dairy',
        'quantity': 10.0,
        'expiry_date': (today + timedelta(days=1)).isoformat()
    }, headers=business_auth_headers)

    # 2. Product expired (-2 days)
    client.post('/api/inventory', json={
        'product_name': 'Expired Milk Test',
        'category': 'Dairy',
        'quantity': 20.0,
        'expiry_date': (today - timedelta(days=2)).isoformat()
    }, headers=business_auth_headers)

    # 3. Product outside threshold (15 days)
    client.post('/api/inventory', json={
        'product_name': 'Fresh Milk Outside threshold',
        'category': 'Dairy',
        'quantity': 30.0,
        'expiry_date': (today + timedelta(days=15)).isoformat()
    }, headers=business_auth_headers)

    # Execute daily job which runs the alert checks
    run_daily_prediction_job()

    # Verify notifications created in database
    with app_instance.app_context():
        notifs = Notification.query.all()
        # Should create notifications for item 1 (approaching) and item 2 (expired), but not item 3 (fresh)
        titles = [n.title for n in notifs]
        assert len(notifs) == 2
        assert any("Expiry Warning" in t and "Approaching Expiry Milk" in t for t in titles)
        assert any("Expired Product Alert" in t and "Expired Milk Test" in t for t in titles)
        assert not any("Fresh Milk Outside threshold" in t for t in titles)
