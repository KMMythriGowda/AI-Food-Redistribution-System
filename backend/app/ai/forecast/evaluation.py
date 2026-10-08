"""
Forecast Model Evaluation Metrics
"""
import numpy as np

def calculate_mae(y_true, y_pred) -> float:
    """Calculates Mean Absolute Error."""
    return float(np.mean(np.abs(np.array(y_true) - np.array(y_pred))))

def calculate_rmse(y_true, y_pred) -> float:
    """Calculates Root Mean Squared Error."""
    return float(np.sqrt(np.mean((np.array(y_true) - np.array(y_pred)) ** 2)))

def calculate_mape(y_true, y_pred) -> float:
    """Calculates Mean Absolute Percentage Error, handling zeros safely."""
    y_true = np.array(y_true)
    y_pred = np.array(y_pred)
    
    # Exclude elements where true value is 0 to avoid division by zero
    mask = y_true != 0
    if not np.any(mask):
        return 0.0
        
    return float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100.0)

def get_benchmark_metrics() -> dict:
    """
    Returns the previously evaluated experiment results.
    """
    return {
        'Prophet': {
            'MAE': 934.0939777162048,
            'RMSE': 1114.399012257946,
            'MAPE': 24.886014016964285
        },
        'XGBoost': {
            'MAE': 438.68707513020837,
            'RMSE': 542.0711678452843,
            'MAPE': 11.039917380106965
        },
        'LSTM': {
            'MAE': 446.05272860179224,
            'RMSE': 596.3687342746379,
            'MAPE': 10.881824480411613
        }
    }
