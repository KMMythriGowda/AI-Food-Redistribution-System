"""
Tests for FastAPI AI Endpoints
"""
import pytest
from fastapi.testclient import TestClient
from app.ai.main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/api/ai/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_model_metrics_endpoint():
    response = client.get("/api/ai/model-metrics")
    assert response.status_code == 200
    data = response.json()
    assert "Prophet" in data
    assert "LSTM" in data
    assert "XGBoost" in data
    assert data["Prophet"]["MAE"] == 934.0939777162048

def test_waste_risk_endpoint():
    payload = {
        "product_id": "P001",
        "current_stock": 50.0,
        "forecast_demand": 15.0,
        "days_to_expiry": 2,
        "waste_rate": 20.0,
        "storage_capacity": 100.0
    }
    response = client.post("/api/ai/waste-risk", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["product_id"] == "P001"
    assert data["risk_level"] == "CRITICAL"
    assert "explanation" in data

def test_reorder_recommendations_endpoint():
    payload = {
        "product_id": "P001",
        "current_stock": 10.0,
        "forecast_daily_demand": 20.0,
        "lead_time_days": 2,
        "safety_stock": 5.0,
        "storage_capacity": 100.0,
        "waste_risk_level": "LOW",
        "days_to_expiry": 30
    }
    response = client.post("/api/ai/reorder-recommendations", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["product_id"] == "P001"
    assert data["recommended_quantity"] > 0.0
    assert data["action"] == "REORDER"

def test_simulate_endpoint():
    payload = {
        "current_stock": 50.0,
        "days_to_expiry": 2,
        "forecast_demand": 15.0,
        "purchase_quantity": -20.0,  # simulate redistributing 20 units
        "storage_capacity": 100.0
    }
    response = client.post("/api/ai/simulate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "current" in data
    assert "simulated" in data
    assert data["current"]["risk_level"] == "CRITICAL"
