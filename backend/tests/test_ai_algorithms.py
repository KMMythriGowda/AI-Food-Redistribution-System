"""
Tests for Waste-Risk Scorer and Reorder Engine Algorithms
"""
from app.ai.algorithms.waste_risk_scorer import WasteRiskScorer
from app.ai.reorder.reorder_engine import ReorderEngine

def test_waste_risk_scorer():
    scorer = WasteRiskScorer()
    
    # 1. Test Expiry override/critical condition (2 days to expiry)
    res_critical = scorer.calculate_risk(
        current_stock=50,
        forecast_demand=15,
        days_to_expiry=2,
        storage_capacity=100
    )
    assert res_critical['risk_level'] == "CRITICAL"
    assert res_critical['risk_score'] >= 75.0
    
    # 2. Test Low risk condition (long expiry, matches demand)
    res_low = scorer.calculate_risk(
        current_stock=5,
        forecast_demand=10,
        days_to_expiry=30,
        storage_capacity=100
    )
    assert res_low['risk_level'] == "LOW"
    assert res_low['risk_score'] < 25.0

    # 3. Test explanation content
    assert "Critical risk" in res_critical['explanation']

def test_risk_trends():
    trend_res = WasteRiskScorer.determine_trend(50.0, 75.0)
    assert trend_res['risk_trend'] == "RISING"
    assert trend_res['risk_change'] == 25.0
    
    trend_res_stable = WasteRiskScorer.determine_trend(50.0, 51.0)
    assert trend_res_stable['risk_trend'] == "STABLE"

def test_reorder_engine_normal():
    # LOW risk, stock is low (10 units), target is high (reorder should be suggested)
    reorder_res = ReorderEngine.calculate_reorder(
        current_stock=10.0,
        forecast_daily_demand=5.0,
        lead_time_days=3,
        safety_stock=5.0,
        storage_capacity=100.0,
        waste_risk_level="LOW"
    )
    
    # ROP = 5*3 + 5 = 20. Current stock is 10 (below ROP)
    # Target = ROP + 5*7 = 20 + 35 = 55. Q = 55 - 10 = 45.
    assert reorder_res['reorder_point'] == 20.0
    assert reorder_res['recommended_quantity'] == 45.0
    assert reorder_res['action'] == "REORDER"
    assert not reorder_res['is_suppressed']

def test_reorder_engine_suppressed():
    # HIGH / CRITICAL risk, reorder recommended should be 0.0
    reorder_res_critical = ReorderEngine.calculate_reorder(
        current_stock=10.0,
        forecast_daily_demand=5.0,
        lead_time_days=3,
        safety_stock=5.0,
        storage_capacity=100.0,
        waste_risk_level="CRITICAL",
        days_to_expiry=2
    )
    
    assert reorder_res_critical['recommended_quantity'] == 0.0
    assert reorder_res_critical['action'] == "DONATE"
    assert reorder_res_critical['is_suppressed']

def test_reorder_capacity_constrained():
    # Reorder qty should never exceed maximum capacity
    reorder_res = ReorderEngine.calculate_reorder(
        current_stock=95.0,
        forecast_daily_demand=10.0,
        lead_time_days=3,
        safety_stock=5.0,
        storage_capacity=100.0,  # Max capacity 100
        waste_risk_level="LOW"
    )
    
    assert reorder_res['recommended_quantity'] <= 5.0
