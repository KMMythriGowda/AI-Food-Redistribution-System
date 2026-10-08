"""
AI Data Preprocessing Pipeline
"""
import pandas as pd
import numpy as np

def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    """
    Cleans raw inventory/sales history data.
    - Removes unwanted index columns
    - Removes duplicate rows
    - Handles missing values (forward fill / zero fill)
    - Validates numerical columns (non-negative)
    """
    if df is None or df.empty:
        return pd.DataFrame()

    df = df.copy()

    # 1. Remove unwanted index columns
    unwanted_cols = [col for col in df.columns if 'index' in col.lower() or col.startswith('Unnamed')]
    if unwanted_cols:
        df = df.drop(columns=unwanted_cols)

    # 2. Remove duplicates
    df = df.drop_duplicates()

    # 3. Date fields conversion
    date_cols = [col for col in df.columns if 'date' in col.lower() or col == 'ds']
    for col in date_cols:
        df[col] = pd.to_datetime(df[col], errors='coerce')

    # 4. Handle missing values
    # For numeric columns, fill NaN with 0 or forward fill
    num_cols = df.select_dtypes(include=[np.number]).columns
    for col in num_cols:
        df[col] = df[col].fillna(0.0)

    # For categorical/string columns, fill NaN with 'Unknown'
    cat_cols = df.select_dtypes(exclude=[np.number, np.datetime64]).columns
    for col in cat_cols:
        df[col] = df[col].fillna('Unknown')

    # 5. Numerical validation: ensure positive/non-negative quantities
    for col in num_cols:
        if 'quantity' in col or 'sold' in col or 'price' in col or 'cost' in col:
            df[col] = df[col].clip(lower=0.0)

    return df

def aggregate_demand(df: pd.DataFrame, time_col: str, group_by_cols: list, val_col: str, freq: str = 'D') -> pd.DataFrame:
    """
    Aggregates demand/sales history by a time frequency ('D', 'W', 'M')
    and group columns (e.g., product_name, category).
    """
    if df is None or df.empty:
        return pd.DataFrame()

    df = df.copy()
    if not pd.api.types.is_datetime64_any_dtype(df[time_col]):
        df[time_col] = pd.to_datetime(df[time_col], errors='coerce')

    # Group by resampled date and target columns
    grouper = [pd.Grouper(key=time_col, freq=freq)] + group_by_cols
    agg_df = df.groupby(grouper)[val_col].sum().reset_index()

    return agg_df

def compute_rolling_stats(df: pd.DataFrame, val_col: str, windows: list = [3, 7, 14]) -> pd.DataFrame:
    """
    Computes rolling mean and std dev features for time-series demand.
    """
    if df is None or df.empty:
        return df

    df = df.copy().sort_values(by=df.select_dtypes(include=[np.datetime64]).columns[0])

    for w in windows:
        df[f'rolling_mean_{w}'] = df[val_col].rolling(window=w, min_periods=1).mean()
        df[f'rolling_std_{w}'] = df[val_col].rolling(window=w, min_periods=1).std().fillna(0.0)

    return df

def generate_lags(df: pd.DataFrame, val_col: str, lags: list = [1, 2, 7]) -> pd.DataFrame:
    """
    Generates time-lagged demand features.
    """
    if df is None or df.empty:
        return df

    df = df.copy().sort_values(by=df.select_dtypes(include=[np.datetime64]).columns[0])

    for lag in lags:
        df[f'lag_{lag}'] = df[val_col].shift(lag).fillna(0.0)

    return df
