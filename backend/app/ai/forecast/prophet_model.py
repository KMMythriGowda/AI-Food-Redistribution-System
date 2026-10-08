"""
Prophet Demand Forecasting Model Wrapper
"""
import numpy as np
import pandas as pd

HAS_PROPHET = False
try:
    from prophet import Prophet
    HAS_PROPHET = True
except ImportError:
    pass

class ProphetModelWrapper:
    def __init__(self):
        self.model = None
        self.model_name = "Prophet" if HAS_PROPHET else "fallback_statistical"

    def fit_and_forecast(self, history_df: pd.DataFrame, horizon: int = 14, freq: str = 'D') -> dict:
        """
        Fits Prophet on historical demand data and forecasts future periods.
        - history_df: DataFrame containing 'ds' (datetime) and 'y' (float demand)
        - horizon: Number of steps to forecast
        - freq: 'D' for daily, 'W' for weekly, 'M' for monthly
        """
        if history_df is None or history_df.empty:
            return {
                'model_name': 'fallback_statistical',
                'forecast': [0.0] * horizon,
                'dates': [str(pd.Timestamp.now().date() + pd.Timedelta(days=i)) for i in range(1, horizon + 1)]
            }

        # Check column names: must have ds and y
        if 'ds' not in history_df.columns or 'y' not in history_df.columns:
            # Try to map date column
            date_col = history_df.select_dtypes(include=[np.datetime64]).columns
            if len(date_col) > 0:
                history_df = history_df.rename(columns={date_col[0]: 'ds'})
            # Try to map target column
            num_cols = [col for col in history_df.columns if col != 'ds']
            if num_cols:
                history_df = history_df.rename(columns={num_cols[0]: 'y'})

        # Clean/Format
        history_df = history_df[['ds', 'y']].dropna()
        history_df['ds'] = pd.to_datetime(history_df['ds'])
        history_df['y'] = pd.to_numeric(history_df['y'], errors='coerce').fillna(0.0)

        if HAS_PROPHET:
            try:
                # Fit actual Prophet model
                m = Prophet(daily_seasonality=False, weekly_seasonality=True, yearly_seasonality=False)
                m.fit(history_df)
                future = m.make_future_dataframe(periods=horizon, freq=freq, include_history=False)
                forecast = m.predict(future)
                
                # Prevent negative forecasts
                forecast['yhat'] = forecast['yhat'].clip(lower=0.0)
                
                return {
                    'model_name': 'Prophet',
                    'forecast': forecast['yhat'].tolist(),
                    'dates': forecast['ds'].dt.strftime('%Y-%m-%d').tolist()
                }
            except Exception as e:
                # Fall back to statistical if Prophet errors out
                pass

        # FALLBACK STATISTICAL MODEL
        # We calculate the average demand and apply trend/seasonality using linear regression/moving averages
        history_df = history_df.sort_values(by='ds')
        n_samples = len(history_df)
        
        last_date = history_df['ds'].max()
        if pd.isnull(last_date):
            last_date = pd.Timestamp.now()

        # Generate future dates
        future_dates = []
        for i in range(1, horizon + 1):
            if freq == 'W':
                future_dates.append(last_date + pd.Timedelta(weeks=i))
            elif freq == 'M':
                # rough approximation of month
                future_dates.append(last_date + pd.Timedelta(days=30 * i))
            else:
                future_dates.append(last_date + pd.Timedelta(days=i))

        if n_samples < 2:
            avg_y = history_df['y'].mean() if n_samples == 1 else 10.0
            return {
                'model_name': 'fallback_statistical',
                'forecast': [float(avg_y)] * horizon,
                'dates': [d.strftime('%Y-%m-%d') for d in future_dates]
            }

        # Simple linear projection + weekday seasonality
        y = history_df['y'].values
        x = np.arange(n_samples)
        
        # Fit simple linear regression using numpy polyfit
        slope, intercept = np.polyfit(x, y, 1)
        
        # Calculate weekly seasonality coefficients
        history_df['weekday'] = history_df['ds'].dt.weekday
        weekday_means = history_df.groupby('weekday')['y'].mean()
        overall_mean = history_df['y'].mean()
        
        seasonal_factors = {}
        for day in range(7):
            mean_val = weekday_means.get(day, overall_mean)
            seasonal_factors[day] = mean_val / (overall_mean + 1e-5)

        forecasts = []
        for i, f_date in enumerate(future_dates):
            pred_idx = n_samples + i
            base_pred = slope * pred_idx + intercept
            
            # Apply seasonality
            day_of_week = f_date.weekday()
            factor = seasonal_factors.get(day_of_week, 1.0)
            
            final_pred = max(0.0, base_pred * factor)
            forecasts.append(round(float(final_pred), 4))

        return {
            'model_name': 'fallback_statistical',
            'forecast': forecasts,
            'dates': [d.strftime('%Y-%m-%d') for d in future_dates]
        }
