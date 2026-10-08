"""
AI Feature Engineering Engine
"""
from datetime import date, datetime

def compute_days_to_expiry(expiry_date) -> int:
    """Calculates days remaining until expiry."""
    if not expiry_date:
        return 9999
    
    today = date.today()
    if isinstance(expiry_date, str):
        try:
            exp = datetime.strptime(expiry_date.split('T')[0], "%Y-%m-%d").date()
        except ValueError:
            return 9999
    elif isinstance(expiry_date, datetime):
        exp = expiry_date.date()
    else:
        exp = expiry_date

    return (exp - today).days

def compute_operational_pressures(current_stock: float, forecast_demand: float, days_to_expiry: int, storage_capacity: float = 100.0) -> dict:
    """
    Computes explainable operational risk pressure factors.
    - expiry_pressure: High when days to expiry is low.
    - stock_pressure: High when stock is high relative to storage capacity.
    - demand_pressure: High when forecasted demand is low relative to current stock.
    - demand_to_stock_ratio: Ratio of forecast demand to current stock.
    - stock_days: Estimated days of stock remaining based on forecast demand.
    - excess_stock: Excess stock relative to forecast demand over the shelf life.
    """
    # 1. Expiry Pressure (exp decays to 1.0 as expiry approaches)
    if days_to_expiry <= 0:
        expiry_pressure = 1.0
    elif days_to_expiry <= 2:
        expiry_pressure = 0.95
    elif days_to_expiry <= 5:
        expiry_pressure = 0.70
    elif days_to_expiry <= 10:
        expiry_pressure = 0.40
    else:
        expiry_pressure = max(0.0, 1.0 - (days_to_expiry / 30.0))

    # 2. Stock Pressure (how full is the storage capacity)
    safe_capacity = max(1.0, storage_capacity)
    stock_pressure = min(1.0, max(0.0, current_stock / safe_capacity))

    # 3. Demand Pressure
    # If daily demand * remaining days is less than current stock, we have leftover waste risk
    # Higher pressure if remaining shelf life demand is low compared to current stock.
    projected_sales_during_lifetime = forecast_demand * max(0, days_to_expiry)
    if current_stock <= 0:
        demand_pressure = 0.0
    else:
        leftover = current_stock - projected_sales_during_lifetime
        demand_pressure = min(1.0, max(0.0, leftover / current_stock))

    # 4. Basic Metrics
    stock_days = current_stock / (forecast_demand + 1e-5)
    demand_to_stock_ratio = forecast_demand / (current_stock + 1e-5)
    excess_stock = max(0.0, current_stock - (forecast_demand * max(1, days_to_expiry)))

    return {
        'expiry_pressure': round(expiry_pressure, 4),
        'stock_pressure': round(stock_pressure, 4),
        'demand_pressure': round(demand_pressure, 4),
        'stock_days': round(stock_days, 2),
        'demand_to_stock_ratio': round(demand_to_stock_ratio, 4),
        'excess_stock': round(excess_stock, 2)
    }
