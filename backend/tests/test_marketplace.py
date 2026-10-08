"""
Marketplace & Payment Flow Integration Test Suite
Implements TC-01 through TC-36
"""
import pytest
import time
from datetime import date, datetime, timedelta
from app import create_app
from app.extensions import db
from app.models.user import User
from app.models.enums import UserRole, InventoryCategory, InventoryStatus
from app.models.inventory import InventoryItem
from app.models.marketplace import SurplusListing, MarketplaceOrder
from app.models.ngo_requirement import NgoRequirement
from app.models.notification import Notification

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
        'email': 'supermarket@freshmart.com',
        'password': 'BusinessPass123!',
        'full_name': 'FreshMart Supermarket',
        'organization_name': 'FreshMart Outlets',
        'role': 'BUSINESS',
        'phone': '+1987654321',
        'address': '123 Retail Ave, Cityville',
        'business_type': 'Supermarket'
    })
    token = reg_res.get_json()['data']['access_token']
    return {'Authorization': f'Bearer {token}'}

@pytest.fixture
def ngo_auth_headers(client):
    """Fixture creating an NGO user and returning Authorization header."""
    reg_res = client.post('/api/auth/register', json={
        'email': 'foodbank@communitycare.org',
        'password': 'NgoPass123!',
        'full_name': 'Community Care Foodbank',
        'organization_name': 'Community Care Foundation',
        'role': 'NGO',
        'phone': '+1555666777',
        'address': '456 Hope Street, Metrocity'
    })
    token = reg_res.get_json()['data']['access_token']
    return {'Authorization': f'Bearer {token}'}

# =====================================================================
# AUTHENTICATION (TC-01 - TC-04)
# =====================================================================

def test_tc01_business_login_valid_credentials(client):
    """TC-01 – Business Login with Valid Credentials"""
    client.post('/api/auth/register', json={
        'email': 'biz_login@test.com',
        'password': 'Password123!',
        'full_name': 'Business Login User',
        'role': 'BUSINESS'
    })
    res = client.post('/api/auth/login', json={
        'email': 'biz_login@test.com',
        'password': 'Password123!'
    })
    assert res.status_code == 200
    data = res.get_json()
    assert data['success'] is True
    assert 'access_token' in data['data']
    assert data['data']['user']['role'] == 'BUSINESS'

def test_tc02_ngo_login_valid_credentials(client):
    """TC-02 – NGO Login with Valid Credentials"""
    client.post('/api/auth/register', json={
        'email': 'ngo_login@test.com',
        'password': 'Password123!',
        'full_name': 'NGO Login User',
        'role': 'NGO'
    })
    res = client.post('/api/auth/login', json={
        'email': 'ngo_login@test.com',
        'password': 'Password123!'
    })
    assert res.status_code == 200
    data = res.get_json()
    assert data['success'] is True
    assert 'access_token' in data['data']
    assert data['data']['user']['role'] == 'NGO'

def test_tc03_invalid_login(client):
    """TC-03 – Invalid Login"""
    client.post('/api/auth/register', json={
        'email': 'invalid_login@test.com',
        'password': 'Password123!',
        'full_name': 'Invalid Login User',
        'role': 'BUSINESS'
    })
    res = client.post('/api/auth/login', json={
        'email': 'invalid_login@test.com',
        'password': 'WrongPassword!'
    })
    assert res.status_code == 401
    data = res.get_json()
    assert data['success'] is False

def test_tc04_role_isolation(client, business_auth_headers, ngo_auth_headers):
    """TC-04 – Role Isolation"""
    # NGO trying to create a listing (Business-only endpoint)
    payload = {
        'product_name': 'Surplus Tomatoes',
        'category': 'Vegetables',
        'listing_type': 'DONATION',
        'quantity_available': 20.0,
        'unit': 'kg',
        'expiry_date': (date.today() + timedelta(days=3)).isoformat(),
        'pickup_location': '123 Retail Ave, Cityville',
        'availability_window': '9 AM - 1 PM',
        'description': 'Fresh organic ripe tomatoes.'
    }
    res = client.post('/api/marketplace/listings', json=payload, headers=ngo_auth_headers)
    assert res.status_code == 403
    assert res.get_json()['error'] == 'Forbidden'

    # Business trying to view active listings (NGO-only endpoint)
    res = client.get('/api/marketplace/listings', headers=business_auth_headers)
    assert res.status_code == 403
    assert res.get_json()['error'] == 'Forbidden'


# =====================================================================
# INVENTORY (TC-05 - TC-10)
# =====================================================================

def test_tc05_add_inventory_item(client, business_auth_headers):
    """TC-05 – Add Inventory Item"""
    exp_date = (date.today() + timedelta(days=10)).isoformat()
    payload = {
        'product_name': 'Apples',
        'category': 'Fruits',
        'quantity': 50.0,
        'unit': 'kg',
        'expiry_date': exp_date,
        'storage_type': 'Ambient'
    }
    res = client.post('/api/inventory', json=payload, headers=business_auth_headers)
    assert res.status_code == 201
    data = res.get_json()
    assert data['success'] is True
    assert data['data']['product_name'] == 'Apples'
    assert data['data']['quantity'] == 50.0

def test_tc06_required_field_validation(client, business_auth_headers):
    """TC-06 – Required Field Validation"""
    payload = {
        'category': 'Fruits',
        'quantity': 50.0,
        'unit': 'kg',
        'expiry_date': (date.today() + timedelta(days=10)).isoformat(),
        'storage_type': 'Ambient'
    }  # missing product_name
    res = client.post('/api/inventory', json=payload, headers=business_auth_headers)
    assert res.status_code == 400
    data = res.get_json()
    assert data['success'] is False
    assert 'product_name' in data['details']

def test_tc07_expiry_tracking(client, business_auth_headers):
    """TC-07 – Expiry Tracking"""
    past_date = (date.today() - timedelta(days=1)).isoformat()
    payload = {
        'product_name': 'Expired Item',
        'category': 'Dairy',
        'quantity': 10.0,
        'unit': 'units',
        'expiry_date': past_date,
        'storage_type': 'Ambient'
    }
    res = client.post('/api/inventory', json=payload, headers=business_auth_headers)
    assert res.status_code == 201
    data = res.get_json()
    assert data['data']['days_remaining'] < 0
    assert data['data']['risk_level'] == 'Expired'
    assert data['data']['status'] == 'Expired'

def test_tc08_low_stock_threshold(client, business_auth_headers):
    """TC-08 – Low Stock Threshold"""
    payload = {
        'product_name': 'Low Stock Item',
        'category': 'Bakery',
        'quantity': 2.0,
        'unit': 'units',
        'low_stock_threshold': 5.0,
        'expiry_date': (date.today() + timedelta(days=10)).isoformat(),
        'storage_type': 'Ambient'
    }
    res = client.post('/api/inventory', json=payload, headers=business_auth_headers)
    assert res.status_code == 201
    data = res.get_json()
    assert data['data']['status'] == 'Low Stock'

def test_tc09_inventory_search(client, business_auth_headers):
    """TC-09 – Inventory Search"""
    client.post('/api/inventory', json={
        'product_name': 'UniqueOrangeJuice',
        'category': 'Beverages',
        'quantity': 10.0,
        'unit': 'bottles',
        'expiry_date': (date.today() + timedelta(days=10)).isoformat()
    }, headers=business_auth_headers)

    res = client.get('/api/inventory?search=UniqueOrange', headers=business_auth_headers)
    assert res.status_code == 200
    data = res.get_json()
    assert len(data['data']) > 0
    assert any(x['product_name'] == 'UniqueOrangeJuice' for x in data['data'])

def test_tc10_inventory_filters(client, business_auth_headers):
    """TC-10 – Inventory Filters"""
    # Create bread (Bakery)
    client.post('/api/inventory', json={
        'product_name': 'Rye Bread',
        'category': 'Bakery',
        'quantity': 10.0,
        'unit': 'loaves',
        'expiry_date': (date.today() + timedelta(days=5)).isoformat()
    }, headers=business_auth_headers)
    
    # Create milk (Dairy)
    client.post('/api/inventory', json={
        'product_name': 'Whole Milk',
        'category': 'Dairy',
        'quantity': 5.0,
        'unit': 'liters',
        'expiry_date': (date.today() + timedelta(days=5)).isoformat()
    }, headers=business_auth_headers)

    res = client.get('/api/inventory?category=Bakery', headers=business_auth_headers)
    assert res.status_code == 200
    data = res.get_json()
    assert len(data['data']) > 0
    assert all(x['category'] == 'Bakery' for x in data['data'])


# =====================================================================
# MARKETPLACE (TC-11 - TC-15)
# =====================================================================

def test_tc11_create_free_donation_listing(client, business_auth_headers, ngo_auth_headers):
    """TC-11 – Create Free Donation Listing"""
    payload = {
        'product_name': 'Free Apples',
        'category': 'Fruits',
        'listing_type': 'DONATION',
        'quantity_available': 10.0,
        'unit': 'kg',
        'expiry_date': (date.today() + timedelta(days=5)).isoformat(),
        'pickup_location': '123 Store St',
        'availability_window': '9 AM - 5 PM',
        'description': 'Free apples for donation.'
    }
    res = client.post('/api/marketplace/listings', json=payload, headers=business_auth_headers)
    assert res.status_code == 201
    data = res.get_json()
    assert data['data']['listing_type'] == 'DONATION'
    assert data['data']['payment_required'] is False
    assert data['data']['price_per_unit'] == 0.0

    # Verify it is available to NGOs
    listings_res = client.get('/api/marketplace/listings', headers=ngo_auth_headers)
    assert listings_res.status_code == 200
    listings = listings_res.get_json()['data']
    assert any(l['id'] == data['data']['id'] for l in listings)

def test_tc12_create_paid_surplus_listing(client, business_auth_headers):
    """TC-12 – Create Paid Surplus Listing"""
    # Select or create an existing inventory item
    inv_res = client.post('/api/inventory', json={
        'product_name': 'Organic Milk 1L',
        'category': 'Dairy',
        'quantity': 15.0,
        'unit': 'units',
        'expiry_date': (date.today() + timedelta(days=5)).isoformat(),
        'storage_type': 'Refrigerated',
        'cost_price': 20.0,
        'selling_price': 40.0
    }, headers=business_auth_headers)
    inv_id = inv_res.get_json()['data']['id']

    # Create listing
    listing_payload = {
        'inventory_item_id': inv_id,
        'product_name': 'Organic Milk 1L',
        'category': 'Dairy',
        'listing_type': 'PAID_SURPLUS',
        'quantity_available': 10.0,
        'unit': 'units',
        'price_per_unit': 40.0,
        'expiry_date': (date.today() + timedelta(days=5)).isoformat(),
        'pickup_location': '123 Retail Ave, Cityville',
        'availability_window': '9 AM - 5 PM',
        'description': 'Fresh organic milk.'
    }
    res = client.post('/api/marketplace/listings', json=listing_payload, headers=business_auth_headers)
    assert res.status_code == 201
    data = res.get_json()
    assert data['success'] is True
    listing_id = data['data']['id']

    # Verify SurplusListing record is created in DB
    listing_db = SurplusListing.query.filter_by(id=listing_id).first()
    assert listing_db is not None
    assert listing_db.listing_type == 'PAID_SURPLUS'
    assert listing_db.quantity_available == 10.0
    assert listing_db.price_per_unit == 40.0
    assert listing_db.payment_required is True
    assert listing_db.status == 'AVAILABLE'

def test_tc13_excess_listing_validation(client, business_auth_headers):
    """TC-13 – Excess Listing Validation"""
    # Create inventory item with 5 units
    inv_res = client.post('/api/inventory', json={
        'product_name': 'Organic Strawberries',
        'category': 'Fruits',
        'quantity': 5.0,
        'unit': 'packs',
        'expiry_date': (date.today() + timedelta(days=5)).isoformat(),
        'storage_type': 'Ambient'
    }, headers=business_auth_headers)
    inv_id = inv_res.get_json()['data']['id']

    # Try listing 10 units (excess)
    listing_payload = {
        'inventory_item_id': inv_id,
        'product_name': 'Organic Strawberries',
        'category': 'Fruits',
        'listing_type': 'PAID_SURPLUS',
        'quantity_available': 10.0,
        'unit': 'packs',
        'price_per_unit': 20.0,
        'expiry_date': (date.today() + timedelta(days=5)).isoformat(),
        'pickup_location': '123 Store St',
        'availability_window': '9 AM - 5 PM'
    }
    res = client.post('/api/marketplace/listings', json=listing_payload, headers=business_auth_headers)
    assert res.status_code == 400
    assert "Insufficient inventory quantity" in res.get_json()['message']

def test_tc14_ngo_views_active_listings(client, business_auth_headers, ngo_auth_headers):
    """TC-14 – NGO Views Active Listings"""
    # Create listing
    client.post('/api/marketplace/listings', json={
        'product_name': 'Fresh Pears',
        'category': 'Fruits',
        'listing_type': 'DONATION',
        'quantity_available': 8.0,
        'unit': 'kg',
        'expiry_date': (date.today() + timedelta(days=5)).isoformat(),
        'pickup_location': '123 Store St',
        'availability_window': '9 AM - 5 PM'
    }, headers=business_auth_headers)

    res = client.get('/api/marketplace/listings', headers=ngo_auth_headers)
    assert res.status_code == 200
    data = res.get_json()
    assert len(data['data']) > 0
    first_listing = data['data'][0]
    assert 'product_name' in first_listing
    assert 'quantity_available' in first_listing
    assert 'expiry_date' in first_listing
    assert 'price_per_unit' in first_listing
    assert 'pickup_location' in first_listing

def test_tc15_marketplace_search_and_filters(client, business_auth_headers, ngo_auth_headers):
    """TC-15 – Marketplace Search and Filters"""
    # Create Apple Listing
    client.post('/api/marketplace/listings', json={
        'product_name': 'Red Gala Pears',
        'category': 'Fruits',
        'listing_type': 'DONATION',
        'quantity_available': 10.0,
        'unit': 'kg',
        'expiry_date': (date.today() + timedelta(days=5)).isoformat(),
        'pickup_location': '123 Store St',
        'availability_window': '9 AM - 5 PM'
    }, headers=business_auth_headers)

    # Create Cheese Listing
    client.post('/api/marketplace/listings', json={
        'product_name': 'Gouda Cheese Block',
        'category': 'Dairy',
        'listing_type': 'PAID_SURPLUS',
        'quantity_available': 5.0,
        'unit': 'units',
        'price_per_unit': 50.0,
        'expiry_date': (date.today() + timedelta(days=5)).isoformat(),
        'pickup_location': '123 Store St',
        'availability_window': '9 AM - 5 PM'
    }, headers=business_auth_headers)

    # Search search=Gouda
    res = client.get('/api/marketplace/listings?search=Gouda', headers=ngo_auth_headers)
    assert res.status_code == 200
    data = res.get_json()
    assert len(data['data']) > 0
    assert any('Gouda' in item['product_name'] for item in data['data'])

    # Filter category=Fruits
    res_cat = client.get('/api/marketplace/listings?category=Fruits', headers=ngo_auth_headers)
    assert res_cat.status_code == 200
    data_cat = res_cat.get_json()
    assert len(data_cat['data']) > 0
    assert all(item['category'] == 'Fruits' for item in data_cat['data'])


# =====================================================================
# DONOR TRANSPARENCY (TC-16)
# =====================================================================

def test_tc16_donor_transparency(client, business_auth_headers, ngo_auth_headers):
    """TC-16 – Donor Transparency"""
    users = User.query.filter_by(role=UserRole.BUSINESS).all()
    biz_id = users[0].id

    res = client.get(f'/api/marketplace/donors/{biz_id}', headers=ngo_auth_headers)
    assert res.status_code == 200
    data = res.get_json()['data']
    assert 'organization_name' in data
    assert 'business_type' in data
    assert 'trust_indicators' in data
    assert 'password_hash' not in data
    assert 'password' not in data


# =====================================================================
# NGO REQUIREMENTS (TC-17)
# =====================================================================

def test_tc17_create_ngo_requirement(client, ngo_auth_headers):
    """TC-17 – Create NGO Requirement"""
    payload = {
        'category': 'Vegetables',
        'quantity': 15.0,
        'unit': 'kg',
        'urgency': 'HIGH',
        'location': 'NGO Center Town'
    }
    res = client.post('/api/marketplace/requirements', json=payload, headers=ngo_auth_headers)
    assert res.status_code == 201
    data = res.get_json()
    assert data['success'] is True
    assert data['data']['category'] == 'Vegetables'
    assert data['data']['urgency'] == 'HIGH'
    
    ngo_user = User.query.filter_by(email='foodbank@communitycare.org').first()
    requirement_db = NgoRequirement.query.filter_by(id=data['data']['id']).first()
    assert requirement_db is not None
    assert requirement_db.user_id == ngo_user.id


# =====================================================================
# SMART MATCHING (TC-18 - TC-19)
# =====================================================================

def test_tc18_compatible_smart_recommendation(client, business_auth_headers, ngo_auth_headers):
    """TC-18 – Compatible Smart Recommendation"""
    biz_user = User.query.filter_by(email='supermarket@freshmart.com').first()
    assert biz_user is not None
    biz_user.latitude = 13.1008
    biz_user.longitude = 77.5963

    listing_payload = {
        'product_name': 'Fresh Organic Milk',
        'category': 'Dairy',
        'listing_type': 'DONATION',
        'quantity_available': 15.0,
        'unit': 'liters',
        'price_per_unit': 0.0,
        'expiry_date': (date.today() + timedelta(days=5)).isoformat(),
        'pickup_location': 'Yelahanka',
        'availability_window': '9 AM - 5 PM',
        'description': 'Fresh dairy milk.'
    }
    listing_res = client.post('/api/marketplace/listings', json=listing_payload, headers=business_auth_headers)
    assert listing_res.status_code == 201
    listing_id = listing_res.get_json()['data']['id']

    ngo_user = User.query.filter_by(email='foodbank@communitycare.org').first()
    assert ngo_user is not None
    ngo_user.latitude = 13.1008
    ngo_user.longitude = 77.5963
    db.session.commit()

    req_payload = {
        'category': 'Dairy',
        'quantity': 10.0,
        'unit': 'liters',
        'urgency': 'HIGH',
        'location': 'Yelahanka'
    }
    req_res = client.post('/api/marketplace/requirements', json=req_payload, headers=ngo_auth_headers)
    assert req_res.status_code == 201

    recs_res = client.get('/api/marketplace/recommendations', headers=ngo_auth_headers)
    assert recs_res.status_code == 200
    recs_data = recs_res.get_json()['data']

    matching_listings = [item for item in recs_data if item['id'] == listing_id]
    assert len(matching_listings) > 0
    match = matching_listings[0]
    assert 'smart_match_score' in match
    assert match['smart_match_score'] > 0
    assert any("category matches" in r or "Category" in r for r in match['smart_match_reasons'])

def test_tc19_poor_match(client, business_auth_headers, ngo_auth_headers):
    """TC-19 – Poor Match"""
    # Create listing for MEAT with small quantity and long shelf life to keep score low
    listing_payload = {
        'product_name': 'Beef Patties',
        'category': 'Meat',
        'listing_type': 'DONATION',
        'quantity_available': 1.0,
        'unit': 'packs',
        'price_per_unit': 0.0,
        'expiry_date': (date.today() + timedelta(days=20)).isoformat(),
        'pickup_location': 'Some Location',
        'availability_window': '9 AM - 5 PM'
    }
    listing_res = client.post('/api/marketplace/listings', json=listing_payload, headers=business_auth_headers)
    assert listing_res.status_code == 201
    listing_id = listing_res.get_json()['data']['id']

    # Create NGO Requirement for DAIRY with large quantity to ensure low matching ratio
    req_payload = {
        'category': 'Dairy',
        'quantity': 100.0,
        'unit': 'liters',
        'urgency': 'LOW',
        'location': 'NGO Location'
    }
    req_res = client.post('/api/marketplace/requirements', json=req_payload, headers=ngo_auth_headers)
    assert req_res.status_code == 201

    # Check recommendations (recs filter out matches below score 40)
    recs_res = client.get('/api/marketplace/recommendations', headers=ngo_auth_headers)
    assert recs_res.status_code == 200
    recs_data = recs_res.get_json()['data']

    matching_listings = [item for item in recs_data if item['id'] == listing_id]
    assert len(matching_listings) == 0



# =====================================================================
# PAYMENT (TC-20 - TC-22)
# =====================================================================

def test_tc20_checkout_calculation(client, business_auth_headers, ngo_auth_headers):
    """TC-20 – Checkout Calculation"""
    listing_res = client.post('/api/marketplace/listings', json={
        'product_name': 'Juice packs',
        'category': 'Beverages',
        'listing_type': 'PAID_SURPLUS',
        'quantity_available': 10.0,
        'unit': 'packs',
        'price_per_unit': 40.0,
        'expiry_date': (date.today() + timedelta(days=5)).isoformat(),
        'pickup_location': '123 Retail Ave, Cityville',
        'availability_window': '9 AM - 5 PM'
    }, headers=business_auth_headers)
    listing_id = listing_res.get_json()['data']['id']

    checkout_res = client.post('/api/marketplace/orders/checkout', json={
        'listing_id': listing_id,
        'quantity': 5.0
    }, headers=ngo_auth_headers)
    
    assert checkout_res.status_code == 200
    data = checkout_res.get_json()['data']
    assert data['unit_price'] == 40.0
    assert data['quantity'] == 5.0
    assert data['subtotal'] == 200.0
    assert data['platform_fee'] == 0.0
    assert data['total_amount'] == 200.0

def test_tc21_sandbox_payment_success(client, business_auth_headers, ngo_auth_headers):
    """TC-21 – Sandbox Payment Success"""
    inv_res = client.post('/api/inventory', json={
        'product_name': 'Yogurt cups',
        'category': 'Dairy',
        'quantity': 50.0,
        'unit': 'units',
        'expiry_date': (date.today() + timedelta(days=4)).isoformat()
    }, headers=business_auth_headers)
    inv_id = inv_res.get_json()['data']['id']

    listing_res = client.post('/api/marketplace/listings', json={
        'inventory_item_id': inv_id,
        'product_name': 'Yogurt cups',
        'category': 'Dairy',
        'listing_type': 'PAID_SURPLUS',
        'quantity_available': 30.0,
        'unit': 'units',
        'price_per_unit': 10.0,
        'expiry_date': (date.today() + timedelta(days=4)).isoformat(),
        'pickup_location': 'Store Location',
        'availability_window': '9 AM - 5 PM'
    }, headers=business_auth_headers)
    listing_id = listing_res.get_json()['data']['id']

    checkout_res = client.post('/api/marketplace/orders/checkout', json={
        'listing_id': listing_id,
        'quantity': 10.0
    }, headers=ngo_auth_headers)
    order_id = checkout_res.get_json()['data']['id']

    # Verify Payment (Success)
    verify_res = client.post('/api/marketplace/orders/verify-payment', json={
        'order_id': order_id,
        'success': True
    }, headers=ngo_auth_headers)
    assert verify_res.status_code == 200
    
    order_data = verify_res.get_json()['data']
    assert order_data['order_status'] == 'ORDER_CONFIRMED'
    assert order_data['payment_status'] == 'PAYMENT_SUCCESS'
    assert order_data['payment_id'] is not None

    # Check inventory is reduced
    check_inv = client.get(f'/api/inventory/{inv_id}', headers=business_auth_headers)
    assert check_inv.get_json()['data']['quantity'] == 40.0

def test_tc22_sandbox_payment_failure(client, business_auth_headers, ngo_auth_headers):
    """TC-22 – Sandbox Payment Failure"""
    listing_res = client.post('/api/marketplace/listings', json={
        'product_name': 'Melons',
        'category': 'Fruits',
        'listing_type': 'PAID_SURPLUS',
        'quantity_available': 20.0,
        'unit': 'kg',
        'price_per_unit': 15.0,
        'expiry_date': (date.today() + timedelta(days=4)).isoformat(),
        'pickup_location': 'Store Location',
        'availability_window': '9 AM - 5 PM'
    }, headers=business_auth_headers)
    listing_id = listing_res.get_json()['data']['id']

    checkout_res = client.post('/api/marketplace/orders/checkout', json={
        'listing_id': listing_id,
        'quantity': 5.0
    }, headers=ngo_auth_headers)
    order_id = checkout_res.get_json()['data']['id']

    # Verify Payment (Failed)
    verify_res = client.post('/api/marketplace/orders/verify-payment', json={
        'order_id': order_id,
        'success': False
    }, headers=ngo_auth_headers)
    assert verify_res.status_code == 400
    assert "Payment failed" in verify_res.get_json()['message']

    order_db = MarketplaceOrder.query.filter_by(id=order_id).first()
    assert order_db.order_status == 'PENDING'
    assert order_db.payment_status == 'PAYMENT_FAILED'


# =====================================================================
# FREE CLAIM (TC-23)
# =====================================================================

def test_tc23_claim_free_donation(client, business_auth_headers, ngo_auth_headers):
    """TC-23 – Claim Free Donation"""
    listing_res = client.post('/api/marketplace/listings', json={
        'product_name': 'Canned Corn',
        'category': 'Others',
        'listing_type': 'DONATION',
        'quantity_available': 100.0,
        'unit': 'cans',
        'expiry_date': (date.today() + timedelta(days=10)).isoformat(),
        'pickup_location': 'Store Location',
        'availability_window': '9 AM - 5 PM'
    }, headers=business_auth_headers)
    listing_id = listing_res.get_json()['data']['id']

    checkout_res = client.post('/api/marketplace/orders/checkout', json={
        'listing_id': listing_id,
        'quantity': 50.0
    }, headers=ngo_auth_headers)
    assert checkout_res.status_code == 200
    data = checkout_res.get_json()['data']
    assert data['payment_required'] is False
    assert data['payment_status'] == 'NOT_REQUIRED'
    assert data['order_status'] == 'PENDING'
    order_id = data['id']

    verify_res = client.post('/api/marketplace/orders/verify-payment', json={
        'order_id': order_id,
        'success': True
    }, headers=ngo_auth_headers)
    assert verify_res.status_code == 200
    assert verify_res.get_json()['data']['order_status'] == 'ORDER_CONFIRMED'


# =====================================================================
# PICKUP (TC-24 - TC-25)
# =====================================================================

def test_tc24_schedule_pickup(client, business_auth_headers, ngo_auth_headers):
    """TC-24 – Schedule Pickup"""
    listing_res = client.post('/api/marketplace/listings', json={
        'product_name': 'Bananas',
        'category': 'Fruits',
        'listing_type': 'DONATION',
        'quantity_available': 10.0,
        'unit': 'bunches',
        'expiry_date': (date.today() + timedelta(days=3)).isoformat(),
        'pickup_location': 'Yelahanka',
        'availability_window': '9 AM - 5 PM'
    }, headers=business_auth_headers)
    listing_id = listing_res.get_json()['data']['id']

    checkout_res = client.post('/api/marketplace/orders/checkout', json={
        'listing_id': listing_id,
        'quantity': 5.0
    }, headers=ngo_auth_headers)
    order_id = checkout_res.get_json()['data']['id']

    client.post('/api/marketplace/orders/verify-payment', json={
        'order_id': order_id,
        'success': True
    }, headers=ngo_auth_headers)

    pickup_date = (datetime.utcnow() + timedelta(days=1)).isoformat()
    schedule_res = client.post(f'/api/marketplace/orders/{order_id}/schedule-pickup', json={
        'pickup_date': pickup_date
    }, headers=ngo_auth_headers)
    assert schedule_res.status_code == 200
    
    order_data = schedule_res.get_json()['data']
    assert order_data['order_status'] == 'PICKUP_SCHEDULED'
    assert order_data['pickup_date'] is not None

def test_tc25_complete_pickup(client, business_auth_headers, ngo_auth_headers):
    """TC-25 – Complete Pickup"""
    listing_res = client.post('/api/marketplace/listings', json={
        'product_name': 'Bananas',
        'category': 'Fruits',
        'listing_type': 'DONATION',
        'quantity_available': 10.0,
        'unit': 'bunches',
        'expiry_date': (date.today() + timedelta(days=3)).isoformat(),
        'pickup_location': 'Yelahanka',
        'availability_window': '9 AM - 5 PM'
    }, headers=business_auth_headers)
    listing_id = listing_res.get_json()['data']['id']

    checkout_res = client.post('/api/marketplace/orders/checkout', json={
        'listing_id': listing_id,
        'quantity': 5.0
    }, headers=ngo_auth_headers)
    order_id = checkout_res.get_json()['data']['id']

    client.post('/api/marketplace/orders/verify-payment', json={
        'order_id': order_id,
        'success': True
    }, headers=ngo_auth_headers)

    pickup_date = (datetime.utcnow() + timedelta(days=1)).isoformat()
    client.post(f'/api/marketplace/orders/{order_id}/schedule-pickup', json={
        'pickup_date': pickup_date
    }, headers=ngo_auth_headers)

    complete_res = client.post(f'/api/marketplace/orders/{order_id}/complete-pickup', headers=ngo_auth_headers)
    assert complete_res.status_code == 200
    assert complete_res.get_json()['data']['order_status'] == 'COMPLETED'


# =====================================================================
# NOTIFICATIONS (TC-26 - TC-28)
# =====================================================================

def test_tc26_transaction_notification(client, business_auth_headers, ngo_auth_headers):
    """TC-26 – Transaction Notification"""
    listing_res = client.post('/api/marketplace/listings', json={
        'product_name': 'Lettuce',
        'category': 'Vegetables',
        'listing_type': 'DONATION',
        'quantity_available': 10.0,
        'unit': 'heads',
        'expiry_date': (date.today() + timedelta(days=3)).isoformat(),
        'pickup_location': 'Yelahanka',
        'availability_window': '9 AM - 5 PM'
    }, headers=business_auth_headers)
    listing_id = listing_res.get_json()['data']['id']

    checkout_res = client.post('/api/marketplace/orders/checkout', json={
        'listing_id': listing_id,
        'quantity': 2.0
    }, headers=ngo_auth_headers)
    order_id = checkout_res.get_json()['data']['id']

    client.post('/api/marketplace/orders/verify-payment', json={
        'order_id': order_id,
        'success': True
    }, headers=ngo_auth_headers)

    notif_res = client.get('/api/marketplace/notifications', headers=business_auth_headers)
    assert notif_res.status_code == 200
    business_notifs = notif_res.get_json()['data']
    assert len(business_notifs) > 0
    assert any("Claimed" in n['title'] for n in business_notifs)

def test_tc27_pickup_notifications(client, business_auth_headers, ngo_auth_headers):
    """TC-27 – Pickup Notifications"""
    listing_res = client.post('/api/marketplace/listings', json={
        'product_name': 'Cabbage',
        'category': 'Vegetables',
        'listing_type': 'DONATION',
        'quantity_available': 10.0,
        'unit': 'heads',
        'expiry_date': (date.today() + timedelta(days=3)).isoformat(),
        'pickup_location': 'Yelahanka',
        'availability_window': '9 AM - 5 PM'
    }, headers=business_auth_headers)
    listing_id = listing_res.get_json()['data']['id']

    checkout_res = client.post('/api/marketplace/orders/checkout', json={
        'listing_id': listing_id,
        'quantity': 2.0
    }, headers=ngo_auth_headers)
    order_id = checkout_res.get_json()['data']['id']

    client.post('/api/marketplace/orders/verify-payment', json={
        'order_id': order_id,
        'success': True
    }, headers=ngo_auth_headers)

    pickup_date = (datetime.utcnow() + timedelta(days=1)).isoformat()
    client.post(f'/api/marketplace/orders/{order_id}/schedule-pickup', json={
        'pickup_date': pickup_date
    }, headers=ngo_auth_headers)

    client.post(f'/api/marketplace/orders/{order_id}/complete-pickup', headers=ngo_auth_headers)

    notif_res = client.get('/api/marketplace/notifications', headers=ngo_auth_headers)
    ngo_notifs = notif_res.get_json()['data']
    assert any("Pickup Scheduled" in n['title'] for n in ngo_notifs)
    assert any("Order Completed" in n['title'] for n in ngo_notifs)

def test_tc28_mark_notifications_read(client, business_auth_headers, ngo_auth_headers):
    """TC-28 – Mark Notifications Read"""
    listing_res = client.post('/api/marketplace/listings', json={
        'product_name': 'Spinach',
        'category': 'Vegetables',
        'listing_type': 'DONATION',
        'quantity_available': 10.0,
        'unit': 'bags',
        'expiry_date': (date.today() + timedelta(days=3)).isoformat(),
        'pickup_location': 'Yelahanka',
        'availability_window': '9 AM - 5 PM'
    }, headers=business_auth_headers)
    listing_id = listing_res.get_json()['data']['id']

    checkout_res = client.post('/api/marketplace/orders/checkout', json={
        'listing_id': listing_id,
        'quantity': 1.0
    }, headers=ngo_auth_headers)
    order_id = checkout_res.get_json()['data']['id']

    client.post('/api/marketplace/orders/verify-payment', json={
        'order_id': order_id,
        'success': True
    }, headers=ngo_auth_headers)

    read_res = client.post('/api/marketplace/notifications/read', headers=ngo_auth_headers)
    assert read_res.status_code == 200

    notif_res = client.get('/api/marketplace/notifications', headers=ngo_auth_headers)
    all_notifs = notif_res.get_json()['data']
    assert all(n['is_read'] is True for n in all_notifs)


# =====================================================================
# ANALYTICS (TC-29 - TC-31)
# =====================================================================

def test_tc29_paid_surplus_analytics(client, business_auth_headers, ngo_auth_headers):
    """TC-29 – Paid Surplus Analytics"""
    initial_res = client.get('/api/marketplace/business/stats', headers=business_auth_headers)
    initial_revenue = initial_res.get_json()['data']['total_sales_revenue']
    initial_tx = initial_res.get_json()['data']['successful_transactions']

    listing_res = client.post('/api/marketplace/listings', json={
        'product_name': 'Expensive Truffles',
        'category': 'Others',
        'listing_type': 'PAID_SURPLUS',
        'quantity_available': 5.0,
        'unit': 'packs',
        'price_per_unit': 100.0,
        'expiry_date': (date.today() + timedelta(days=5)).isoformat(),
        'pickup_location': 'Store Location',
        'availability_window': '9 AM - 5 PM'
    }, headers=business_auth_headers)
    listing_id = listing_res.get_json()['data']['id']

    checkout_res = client.post('/api/marketplace/orders/checkout', json={
        'listing_id': listing_id,
        'quantity': 2.0
    }, headers=ngo_auth_headers)
    order_id = checkout_res.get_json()['data']['id']

    client.post('/api/marketplace/orders/verify-payment', json={
        'order_id': order_id,
        'success': True
    }, headers=ngo_auth_headers)

    client.post(f'/api/marketplace/orders/{order_id}/complete-pickup', headers=ngo_auth_headers)

    new_res = client.get('/api/marketplace/business/stats', headers=business_auth_headers)
    new_data = new_res.get_json()['data']
    assert new_data['total_sales_revenue'] == initial_revenue + 200.0
    assert new_data['successful_transactions'] == initial_tx + 1
    assert new_data['quantity_redistributed'] >= 2.0

def test_tc30_co2_and_meals_analytics(client, business_auth_headers, ngo_auth_headers):
    """TC-30 – CO2 and Meals Analytics"""
    stats_res = client.get('/api/marketplace/business/stats', headers=business_auth_headers)
    stats_data = stats_res.get_json()['data']
    co2_factor = stats_data['co2_per_unit_factor']
    meals_factor = stats_data['meals_per_unit_factor']

    listing_res = client.post('/api/marketplace/listings', json={
        'product_name': 'Melons',
        'category': 'Fruits',
        'listing_type': 'DONATION',
        'quantity_available': 10.0,
        'unit': 'kg',
        'expiry_date': (date.today() + timedelta(days=3)).isoformat(),
        'pickup_location': 'Yelahanka',
        'availability_window': '9 AM - 5 PM'
    }, headers=business_auth_headers)
    listing_id = listing_res.get_json()['data']['id']

    checkout_res = client.post('/api/marketplace/orders/checkout', json={
        'listing_id': listing_id,
        'quantity': 4.0
    }, headers=ngo_auth_headers)
    order_id = checkout_res.get_json()['data']['id']

    client.post('/api/marketplace/orders/verify-payment', json={
        'order_id': order_id,
        'success': True
    }, headers=ngo_auth_headers)

    new_stats_res = client.get('/api/marketplace/business/stats', headers=business_auth_headers)
    new_stats = new_stats_res.get_json()['data']
    
    expected_co2 = round(new_stats['quantity_redistributed'] * co2_factor, 2)
    expected_meals = round(new_stats['quantity_redistributed'] * meals_factor, 2)
    
    assert new_stats['estimated_co2_savings'] == expected_co2
    assert new_stats['estimated_meals_redistributed'] == expected_meals

def test_tc31_beneficiary_impact(client, business_auth_headers, ngo_auth_headers):
    """TC-31 – Beneficiary Impact"""
    initial_res = client.get('/api/marketplace/ngo/impact', headers=ngo_auth_headers)
    initial_data = initial_res.get_json()['data']

    listing_res = client.post('/api/marketplace/listings', json={
        'product_name': 'Pasta boxes',
        'category': 'Others',
        'listing_type': 'DONATION',
        'quantity_available': 10.0,
        'unit': 'boxes',
        'expiry_date': (date.today() + timedelta(days=5)).isoformat(),
        'pickup_location': 'Yelahanka',
        'availability_window': '9 AM - 5 PM'
    }, headers=business_auth_headers)
    listing_id = listing_res.get_json()['data']['id']

    checkout_res = client.post('/api/marketplace/orders/checkout', json={
        'listing_id': listing_id,
        'quantity': 3.0
    }, headers=ngo_auth_headers)
    order_id = checkout_res.get_json()['data']['id']

    client.post('/api/marketplace/orders/verify-payment', json={
        'order_id': order_id,
        'success': True
    }, headers=ngo_auth_headers)

    client.post(f'/api/marketplace/orders/{order_id}/complete-pickup', headers=ngo_auth_headers)

    impact_res = client.get('/api/marketplace/ngo/impact', headers=ngo_auth_headers)
    new_data = impact_res.get_json()['data']
    assert new_data['completed_pickups'] == initial_data['completed_pickups'] + 1
    assert new_data['total_units_received'] == initial_data['total_units_received'] + 3.0


# =====================================================================
# DATA INTEGRITY (TC-32 - TC-33)
# =====================================================================

def test_tc32_inventory_synchronization(client, business_auth_headers, ngo_auth_headers):
    """TC-32 – Inventory Synchronization"""
    inv_res = client.post('/api/inventory', json={
        'product_name': 'Inventory Sync Milk',
        'category': 'Dairy',
        'quantity': 20.0,
        'unit': 'units',
        'expiry_date': (date.today() + timedelta(days=5)).isoformat()
    }, headers=business_auth_headers)
    inv_id = inv_res.get_json()['data']['id']

    listing_res = client.post('/api/marketplace/listings', json={
        'inventory_item_id': inv_id,
        'product_name': 'Inventory Sync Milk',
        'category': 'Dairy',
        'listing_type': 'PAID_SURPLUS',
        'quantity_available': 10.0,
        'unit': 'units',
        'price_per_unit': 10.0,
        'expiry_date': (date.today() + timedelta(days=5)).isoformat(),
        'pickup_location': 'Store Location',
        'availability_window': '9 AM - 5 PM'
    }, headers=business_auth_headers)
    listing_id = listing_res.get_json()['data']['id']

    checkout_res = client.post('/api/marketplace/orders/checkout', json={
        'listing_id': listing_id,
        'quantity': 5.0
    }, headers=ngo_auth_headers)
    order_id = checkout_res.get_json()['data']['id']

    client.post('/api/marketplace/orders/verify-payment', json={
        'order_id': order_id,
        'success': True
    }, headers=ngo_auth_headers)

    check_inv = client.get(f'/api/inventory/{inv_id}', headers=business_auth_headers)
    assert check_inv.get_json()['data']['quantity'] == 15.0 # 20 - 5

def test_tc33_expired_listing_protection(client, business_auth_headers, ngo_auth_headers):
    """TC-33 – Expired Listing Protection"""
    past_date = (date.today() - timedelta(days=1)).isoformat()
    listing_res = client.post('/api/marketplace/listings', json={
        'product_name': 'Expired Milk',
        'category': 'Dairy',
        'listing_type': 'DONATION',
        'quantity_available': 10.0,
        'unit': 'liters',
        'expiry_date': past_date,
        'pickup_location': 'Yelahanka',
        'availability_window': '9 AM - 5 PM'
    }, headers=business_auth_headers)
    listing_id = listing_res.get_json()['data']['id']

    checkout_res = client.post('/api/marketplace/orders/checkout', json={
        'listing_id': listing_id,
        'quantity': 2.0
    }, headers=ngo_auth_headers)
    
    assert checkout_res.status_code == 400
    assert "expired" in checkout_res.get_json()['message'].lower()


# =====================================================================
# BUSINESS TRANSACTIONS (TC-34)
# =====================================================================

def test_tc34_business_transaction_history(client, business_auth_headers, ngo_auth_headers):
    """TC-34 – Business Transaction History"""
    listing_res = client.post('/api/marketplace/listings', json={
        'product_name': 'Fancy Cake',
        'category': 'Bakery',
        'listing_type': 'PAID_SURPLUS',
        'quantity_available': 5.0,
        'unit': 'units',
        'price_per_unit': 20.0,
        'expiry_date': (date.today() + timedelta(days=5)).isoformat(),
        'pickup_location': 'Store Location',
        'availability_window': '9 AM - 5 PM'
    }, headers=business_auth_headers)
    listing_id = listing_res.get_json()['data']['id']

    checkout_res = client.post('/api/marketplace/orders/checkout', json={
        'listing_id': listing_id,
        'quantity': 1.0
    }, headers=ngo_auth_headers)
    order_id = checkout_res.get_json()['data']['id']

    client.post('/api/marketplace/orders/verify-payment', json={
        'order_id': order_id,
        'success': True
    }, headers=ngo_auth_headers)

    tx_res = client.get('/api/marketplace/business/transactions', headers=business_auth_headers)
    assert tx_res.status_code == 200
    transactions = tx_res.get_json()['data']
    assert len(transactions) > 0
    assert any(t['id'] == order_id for t in transactions)
    
    tx = [t for t in transactions if t['id'] == order_id][0]
    assert tx['total_amount'] == 20.0
    assert tx['order_status'] == 'ORDER_CONFIRMED'


# =====================================================================
# SYSTEM/API (TC-35 - TC-36)
# =====================================================================

def test_tc35_backend_health_check(client):
    """TC-35 – Backend Health Check"""
    res = client.get('/api/health')
    assert res.status_code == 200
    assert res.get_json()['status'] == 'healthy'

def test_tc36_marketplace_integration_performance(client, business_auth_headers, ngo_auth_headers):
    """TC-36 – Marketplace Integration / Performance"""
    for i in range(5):
        client.post('/api/marketplace/listings', json={
            'product_name': f'Bulk Item {i}',
            'category': 'Others',
            'listing_type': 'DONATION',
            'quantity_available': 10.0,
            'unit': 'units',
            'expiry_date': (date.today() + timedelta(days=5)).isoformat(),
            'pickup_location': 'Store Location',
            'availability_window': '9 AM - 5 PM'
        }, headers=business_auth_headers)

    start_time = time.time()
    for _ in range(10):
        res = client.get('/api/marketplace/listings', headers=ngo_auth_headers)
        assert res.status_code == 200
        assert len(res.get_json()['data']) >= 5
    end_time = time.time()
    
    elapsed_time = end_time - start_time
    assert elapsed_time < 2.0, f"Retrieval time too slow: {elapsed_time}s"
