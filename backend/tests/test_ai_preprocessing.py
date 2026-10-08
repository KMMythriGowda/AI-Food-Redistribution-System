"""
Tests for AI Data Preprocessing & Feature Engineering
"""
import pandas as pd
import numpy as np
from app.ai.data.preprocessing import clean_data, aggregate_demand, compute_rolling_stats, generate_lags
from app.ai.data.feature_engineering import compute_days_to_expiry, compute_operational_pressures

def test_clean_data():
    raw_data = pd.DataFrame({
        'Unnamed: 0': [0, 1, 2],
        'date': ['2026-08-01', '2026-08-01', '2026-08-03'],
        'product_name': ['Milk', 'Milk', 'Bread'],
        'quantity': [10.0, 10.0, -5.0],
        'cost_price': [1.5, 1.5, np.nan]
    })
    
    cleaned = clean_data(raw_data)
    
    # Assert Unnamed column removed
    assert 'Unnamed: 0' not in cleaned.columns
    # Assert duplicate removed
    assert len(cleaned) == 2
    # Assert negative quantity handled
    assert cleaned.loc[cleaned['product_name'] == 'Bread', 'quantity'].values[0] == 0.0
    # Assert missing values handled
    assert cleaned.loc[cleaned['product_name'] == 'Bread', 'cost_price'].values[0] == 0.0

def test_aggregate_demand():
    df = pd.DataFrame({
        'date': pd.to_datetime(['2026-08-01', '2026-08-01', '2026-08-02']),
        'product_name': ['Milk', 'Milk', 'Milk'],
        'category': ['Dairy', 'Dairy', 'Dairy'],
        'sold': [5.0, 3.0, 10.0]
    })
    
    agg = aggregate_demand(df, 'date', ['product_name', 'category'], 'sold', freq='D')
    assert len(agg) == 2
    assert agg.loc[agg['date'] == '2026-08-01', 'sold'].values[0] == 8.0

def test_rolling_and_lags():
    df = pd.DataFrame({
        'ds': pd.date_range(start='2026-08-01', periods=5),
        'y': [10.0, 20.0, 30.0, 40.0, 50.0]
    })
    
    rolled = compute_rolling_stats(df, 'y', windows=[2])
    assert 'rolling_mean_2' in rolled.columns
    assert rolled['rolling_mean_2'].iloc[1] == 15.0  # mean of 10 and 20
    
    lagged = generate_lags(df, 'y', lags=[1])
    assert 'lag_1' in lagged.columns
    assert lagged['lag_1'].iloc[1] == 10.0

def test_feature_pressures():
    pressures = compute_operational_pressures(
        current_stock=50.0,
        forecast_demand=5.0,
        days_to_expiry=3,
        storage_capacity=100.0
    )
    
    assert pressures['expiry_pressure'] == 0.7
    assert pressures['stock_pressure'] == 0.5
    assert pressures['stock_days'] == 10.0
    assert pressures['excess_stock'] == 35.0  # 50 - (5 * 3) = 35
