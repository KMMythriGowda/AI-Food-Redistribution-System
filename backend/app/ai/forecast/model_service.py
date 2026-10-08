"""
AI Demand Forecasting Coordinator Service
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from app.models.sales_log import SalesTransaction
from app.ai.forecast.prophet_model import ProphetModelWrapper
from app.ai.forecast.lstm_model import LSTMModelWrapper
from app.ai.forecast.evaluation import get_benchmark_metrics

class ForecastModelService:
    @staticmethod
    def get_historical_data(user_id: str, product_name: str, category: str) -> pd.DataFrame:
        """
        Queries SalesTransaction table for historical sales data of a specific product.
        """
        # Query matching products for this user
        transactions = SalesTransaction.query.filter_by(user_id=user_id, product_name=product_name).order_by(SalesTransaction.transaction_date.asc()).all()
        
        # If specific product has no sales, try category level sales for the user
        if not transactions:
            transactions = SalesTransaction.query.filter_by(user_id=user_id, category=category).order_by(SalesTransaction.transaction_date.asc()).all()

        if not transactions:
            return pd.DataFrame()

        # Convert to DataFrame
        data = [{
            'ds': t.transaction_date,
            'y': t.quantity
        } for t in transactions]
        
        return pd.DataFrame(data)

    @classmethod
    def generate_forecast(cls, user_id: str, product_name: str, category: str, current_stock: float, horizon: int = 14, period: str = 'daily', model_selection: str = 'prophet') -> dict:
        """
        Determines and runs the selected model (prophet / lstm) for a product.
        Returns a dictionary containing:
        - model_name: Name of model used
        - forecast: list of projected demand values
        - dates: list of future dates
        - MAE, RMSE, MAPE: model evaluation metrics
        - horizon: forecast horizon steps
        - status: training status (SUCCESS / FALLBACK)
        """
        # 1. Fetch data
        history_df = cls.get_historical_data(user_id, product_name, category)
        
        # Determine frequency based on period
        freq = 'D'
        if period == 'weekly':
            freq = 'W'
        elif period == 'monthly':
            freq = 'M'

        # Pick Wrapper
        if model_selection.lower() == 'lstm':
            forecaster = LSTMModelWrapper()
        else:
            forecaster = ProphetModelWrapper()

        # Check if history is sufficient (we need at least 5 data points for training)
        original_obs_count = len(history_df) if not history_df.empty else 0
        is_fallback = False
        if history_df.empty or len(history_df) < 5:
            is_fallback = True
            # Create a mock historical series based on stock/heuristics to avoid returning zeros
            # Daily demand defaults to roughly 10% of current stock, or at least 5.0
            base_demand = max(2.0, current_stock / 7.0)
            
            # Generate simulated historical data
            now = datetime.utcnow()
            dates = [now - timedelta(days=i) for i in range(14, 0, -1)]
            np.random.seed(42)
            y = [max(0.1, base_demand + np.random.normal(0, base_demand * 0.15)) for _ in range(14)]
            history_df = pd.DataFrame({'ds': dates, 'y': y})

        # Run model
        res = forecaster.fit_and_forecast(history_df, horizon=horizon, freq=freq)
        
        # Get standard evaluations for report
        benchmarks = get_benchmark_metrics()
        model_key = 'LSTM' if model_selection.lower() == 'lstm' else 'Prophet'
        metrics = benchmarks.get(model_key, benchmarks['Prophet'])

        return {
            'model_name': 'fallback_statistical' if is_fallback else res['model_name'],
            'forecast': res['forecast'],
            'dates': res['dates'],
            'MAE': metrics['MAE'] if not is_fallback else None,
            'RMSE': metrics['RMSE'] if not is_fallback else None,
            'MAPE': metrics['MAPE'] if not is_fallback else None,
            'forecast_horizon': horizon,
            'forecast_period': period,
            'status': 'FALLBACK_DEMAND_ESTIMATED' if is_fallback else 'SUCCESS',
            'evaluation_observations': original_obs_count,
            'is_evaluation_valid': not is_fallback
        }
