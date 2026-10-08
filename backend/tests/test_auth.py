"""
Backend Authentication & RBAC Unit Tests
"""
import pytest
from app import create_app
from app.extensions import db
from app.models.user import User
from app.models.enums import UserRole

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

def test_user_registration(client):
    """Test user registration endpoint for Business role."""
    payload = {
        'email': 'newbusiness@test.com',
        'password': 'Password123!',
        'full_name': 'Test Store Owner',
        'organization_name': 'Test Store Inc',
        'role': 'BUSINESS'
    }
    response = client.post('/api/auth/register', json=payload)
    assert response.status_code == 201
    data = response.get_json()
    assert data['success'] is True
    assert 'access_token' in data['data']
    assert 'refresh_token' in data['data']
    assert data['data']['user']['email'] == 'newbusiness@test.com'

def test_user_login(client):
    """Test user login endpoint."""
    # Register first
    client.post('/api/auth/register', json={
        'email': 'logintest@test.com',
        'password': 'Password123!',
        'full_name': 'Login User',
        'role': 'BUSINESS'
    })

    # Login
    response = client.post('/api/auth/login', json={
        'email': 'logintest@test.com',
        'password': 'Password123!'
    })
    assert response.status_code == 200
    data = response.get_json()
    assert data['success'] is True
    assert 'access_token' in data['data']

def test_user_login_invalid_password(client):
    """Test login rejection on wrong password."""
    client.post('/api/auth/register', json={
        'email': 'wrongpass@test.com',
        'password': 'Password123!',
        'full_name': 'Wrong Pass User',
        'role': 'BUSINESS'
    })

    response = client.post('/api/auth/login', json={
        'email': 'wrongpass@test.com',
        'password': 'WrongPassword!'
    })
    assert response.status_code == 401

def test_refresh_token(client):
    """Test access token refresh using valid refresh token."""
    reg_res = client.post('/api/auth/register', json={
        'email': 'refreshtest@test.com',
        'password': 'Password123!',
        'full_name': 'Refresh User',
        'role': 'NGO'
    })
    refresh_token = reg_res.get_json()['data']['refresh_token']

    response = client.post('/api/auth/refresh', headers={
        'Authorization': f'Bearer {refresh_token}'
    })
    assert response.status_code == 200
    data = response.get_json()
    assert 'access_token' in data['data']

def test_get_current_user_profile(client):
    """Test fetching current authenticated user profile."""
    reg_res = client.post('/api/auth/register', json={
        'email': 'profiletest@test.com',
        'password': 'Password123!',
        'full_name': 'Profile User',
        'role': 'BUSINESS'
    })
    access_token = reg_res.get_json()['data']['access_token']

    # Authorized request
    res = client.get('/api/auth/me', headers={'Authorization': f'Bearer {access_token}'})
    assert res.status_code == 200
    data = res.get_json()
    assert data['data']['user']['email'] == 'profiletest@test.com'

    # Unauthorized request (no token)
    unauth_res = client.get('/api/auth/me')
    assert unauth_res.status_code == 401

def test_duplicate_email_registration(client):
    """Test rejection of duplicate email registration."""
    payload = {
        'email': 'duplicate@test.com',
        'password': 'Password123!',
        'full_name': 'First User',
        'role': 'BUSINESS'
    }
    client.post('/api/auth/register', json=payload)
    dup_res = client.post('/api/auth/register', json=payload)
    assert dup_res.status_code == 409

def test_logout(client):
    """Test logout endpoint."""
    reg_res = client.post('/api/auth/register', json={
        'email': 'logouttest@test.com',
        'password': 'Password123!',
        'full_name': 'Logout User',
        'role': 'NGO'
    })
    access_token = reg_res.get_json()['data']['access_token']

    res = client.post('/api/auth/logout', headers={'Authorization': f'Bearer {access_token}'})
    assert res.status_code == 200
    assert res.get_json()['success'] is True


def test_public_registration_cannot_create_admin(client):
    """ADMIN accounts must never be creatable through public registration."""
    response = client.post('/api/auth/register', json={
        'email': 'fakeadmin@test.com',
        'password': 'Password123!',
        'full_name': 'Fake Admin',
        'role': 'ADMIN'
    })
    assert response.status_code == 400


def test_logout_revokes_access_token(client):
    """A logged-out access token must not be reusable."""
    reg_res = client.post('/api/auth/register', json={
        'email': 'revoketest@test.com',
        'password': 'Password123!',
        'full_name': 'Revoke User',
        'role': 'BUSINESS'
    })
    access_token = reg_res.get_json()['data']['access_token']
    headers = {'Authorization': f'Bearer {access_token}'}

    assert client.post('/api/auth/logout', headers=headers).status_code == 200
    assert client.get('/api/auth/me', headers=headers).status_code == 401


def test_password_reset_changes_password(client):
    """The development reset link should update the stored password."""
    client.post('/api/auth/register', json={
        'email': 'resettest@test.com',
        'password': 'Password123!',
        'full_name': 'Reset User',
        'role': 'BUSINESS'
    })
    forgot = client.post('/api/auth/forgot-password', json={'email': 'resettest@test.com'})
    assert forgot.status_code == 200
    token = forgot.get_json()['data']['reset_token']

    reset = client.post('/api/auth/reset-password', json={
        'token': token,
        'password': 'NewPassword123!'
    })
    assert reset.status_code == 200

    old_login = client.post('/api/auth/login', json={
        'email': 'resettest@test.com',
        'password': 'Password123!'
    })
    assert old_login.status_code == 401
    new_login = client.post('/api/auth/login', json={
        'email': 'resettest@test.com',
        'password': 'NewPassword123!'
    })
    assert new_login.status_code == 200
