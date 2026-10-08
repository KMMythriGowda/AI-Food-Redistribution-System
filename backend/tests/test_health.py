"""
Backend Health Check Unit Tests
"""
import pytest
from app import create_app

@pytest.fixture
def client():
    app = create_app('testing')
    with app.test_client() as test_client:
        yield test_client

def test_health_endpoint(client):
    """Test /api/health endpoint returns 200 and healthy status."""
    response = client.get('/api/health')
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'healthy'
