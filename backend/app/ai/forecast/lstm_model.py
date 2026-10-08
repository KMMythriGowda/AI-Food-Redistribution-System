"""
LSTM PyTorch Demand Forecasting Model Wrapper
"""
import numpy as np
import pandas as pd

HAS_TORCH = False
try:
    import torch
    import torch.nn as nn
    HAS_TORCH = True
except ImportError:
    pass

class LSTMModelWrapper:
    def __init__(self):
        self.model = None
        self.model_name = "LSTM" if HAS_TORCH else "fallback_statistical"

    def fit_and_forecast(self, history_df: pd.DataFrame, horizon: int = 14, freq: str = 'D') -> dict:
        """
        Fits LSTM on historical demand data and forecasts future periods.
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

        # Format Columns
        if 'ds' not in history_df.columns or 'y' not in history_df.columns:
            date_col = history_df.select_dtypes(include=[np.datetime64]).columns
            if len(date_col) > 0:
                history_df = history_df.rename(columns={date_col[0]: 'ds'})
            num_cols = [col for col in history_df.columns if col != 'ds']
            if num_cols:
                history_df = history_df.rename(columns={num_cols[0]: 'y'})

        history_df = history_df[['ds', 'y']].dropna()
        history_df['ds'] = pd.to_datetime(history_df['ds'])
        history_df['y'] = pd.to_numeric(history_df['y'], errors='coerce').fillna(0.0)

        last_date = history_df['ds'].max()
        if pd.isnull(last_date):
            last_date = pd.Timestamp.now()

        # Future Dates
        future_dates = []
        for i in range(1, horizon + 1):
            if freq == 'W':
                future_dates.append(last_date + pd.Timedelta(weeks=i))
            elif freq == 'M':
                future_dates.append(last_date + pd.Timedelta(days=30 * i))
            else:
                future_dates.append(last_date + pd.Timedelta(days=i))

        if HAS_TORCH:
            try:
                # Define simple PyTorch LSTM Network
                class SimpleLSTM(nn.Module):
                    def __init__(self, input_dim=1, hidden_dim=32, num_layers=1, output_dim=1):
                        super(SimpleLSTM, self).__init__()
                        self.hidden_dim = hidden_dim
                        self.num_layers = num_layers
                        self.lstm = nn.LSTM(input_dim, hidden_dim, num_layers, batch_first=True)
                        self.linear = nn.Linear(hidden_dim, output_dim)

                    def forward(self, x):
                        h0 = torch.zeros(self.num_layers, x.size(0), self.hidden_dim)
                        c0 = torch.zeros(self.num_layers, x.size(0), self.hidden_dim)
                        out, _ = self.lstm(x, (h0, c0))
                        out = self.linear(out[:, -1, :])
                        return out

                # Format data for sequence training
                y = history_df['y'].values.astype(np.float32)
                if len(y) > 10:
                    seq_len = 5
                    X_seq, Y_seq = [], []
                    for i in range(len(y) - seq_len):
                        X_seq.append(y[i:i+seq_len])
                        Y_seq.append(y[i+seq_len])

                    X_tensor = torch.tensor(np.array(X_seq), dtype=torch.float32).unsqueeze(-1)
                    Y_tensor = torch.tensor(np.array(Y_seq), dtype=torch.float32).unsqueeze(-1)

                    model = SimpleLSTM()
                    criterion = nn.MSELoss()
                    optimizer = torch.optim.Adam(model.parameters(), lr=0.01)

                    # Quick train loop
                    model.train()
                    for epoch in range(20):
                        optimizer.zero_grad()
                        outputs = model(X_tensor)
                        loss = criterion(outputs, Y_tensor)
                        loss.backward()
                        optimizer.step()

                    # Generate forecast auto-regressively
                    model.eval()
                    last_seq = list(y[-seq_len:])
                    forecasts = []
                    with torch.no_grad():
                        for _ in range(horizon):
                            seq_tensor = torch.tensor(np.array([last_seq]), dtype=torch.float32).unsqueeze(-1)
                            pred = model(seq_tensor).item()
                            pred = max(0.0, pred)
                            forecasts.append(round(float(pred), 4))
                            last_seq.pop(0)
                            last_seq.append(pred)

                    return {
                        'model_name': 'LSTM',
                        'forecast': forecasts,
                        'dates': [d.strftime('%Y-%m-%d') for d in future_dates]
                    }
            except Exception as e:
                # Fall back if training fails
                pass

        # FALLBACK STATISTICAL MODEL
        # We'll use a double exponential smoothing (Holt-Linear) model approximation
        y = history_df['y'].tolist()
        if len(y) < 2:
            return {
                'model_name': 'fallback_statistical',
                'forecast': [float(y[0]) if y else 10.0] * horizon,
                'dates': [d.strftime('%Y-%m-%d') for d in future_dates]
            }

        # Double exponential smoothing algorithm
        alpha = 0.3
        beta = 0.1
        level = y[0]
        trend = y[1] - y[0]
        
        for i in range(1, len(y)):
            last_level = level
            level = alpha * y[i] + (1 - alpha) * (level + trend)
            trend = beta * (level - last_level) + (1 - beta) * trend

        forecasts = []
        for step in range(1, horizon + 1):
            pred = max(0.0, level + step * trend)
            forecasts.append(round(float(pred), 4))

        return {
            'model_name': 'fallback_statistical',
            'forecast': forecasts,
            'dates': [d.strftime('%Y-%m-%d') for d in future_dates]
        }
