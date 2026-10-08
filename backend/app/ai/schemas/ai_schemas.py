"""
FastAPI Request/Response Validation Schemas
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict

# 1. Health Schema
class HealthResponse(BaseModel):
    status: str
    timestamp: str

# 2. Demand Forecast Schemas
class ForecastRequest(BaseModel):
    user_id: Optional[str] = None
    category: str
    product_name: Optional[str] = None
    granularity: str = "daily"  # daily, weekly, monthly
    horizon: int = 14
    current_stock: float = 0.0

class ForecastResponse(BaseModel):
    model_name: str
    forecast: List[float]
    dates: List[str]
    MAE: Optional[float] = None
    RMSE: Optional[float] = None
    MAPE: Optional[float] = None
    forecast_horizon: int
    forecast_period: str
    status: str
    # Enhanced fields
    historical_values: Optional[List[float]] = None
    historical_dates: Optional[List[str]] = None
    trend_direction: Optional[str] = "STABLE"
    evaluation_observations: Optional[int] = 0
    is_evaluation_valid: Optional[bool] = False

# 3. Waste Risk Schemas
class WasteRiskRequest(BaseModel):
    user_id: Optional[str] = None
    product_id: Optional[str] = "P001"
    current_stock: float
    forecast_demand: float
    days_to_expiry: int
    waste_rate: Optional[float] = None
    stock_age_days: Optional[float] = None
    historical_demand_trend: float = 0.0
    storage_capacity: float = 100.0

class WasteRiskResponse(BaseModel):
    product_id: Optional[str] = "P001"
    risk_score: float
    risk_level: str
    expiry_pressure: float
    excess_stock_pressure: float
    demand_mismatch: float
    waste_pressure: float
    demand_trend_pressure: float
    recommended_action: str
    explanation: str
    # Enhanced Explainable and Trend fields (Optional for backward compatibility)
    risk_contributors: Optional[Dict[str, float]] = None
    primary_reason: Optional[str] = None
    future_risks: Optional[List[Dict]] = None
    redistribution_recommendation: Optional[Dict] = None
    confidence_score: Optional[float] = None
    confidence_level: Optional[str] = None
    historical_observations: Optional[int] = None
    potential_waste_value: Optional[float] = None
    potential_avoidable_loss: Optional[float] = None
    estimated_recovery: Optional[float] = None
    financial_text: Optional[str] = None

# 4. Smart Reorder Schemas
class ReorderRequest(BaseModel):
    product_id: Optional[str] = "P001"
    current_stock: float
    forecast_daily_demand: float
    lead_time_days: int = 3
    safety_stock: float = 5.0
    storage_capacity: float = 100.0
    waste_risk_level: str = "LOW"
    days_to_expiry: int = 30

class ReorderResponse(BaseModel):
    product_id: Optional[str] = "P001"
    reorder_point: float
    target_stock: float
    recommended_quantity: float
    available_storage_capacity: float
    action: str
    reason: str
    is_suppressed: bool
    forecast_daily_demand: Optional[float] = None
    current_stock: float
    storage_capacity: float
    reorder_explanation: Optional[Dict] = None

# 5. Batch Predict Schemas
class BatchPredictRequest(BaseModel):
    period: str = "daily"
    user_id: Optional[str] = None

class BatchPredictItem(BaseModel):
    product_id: str
    product_name: str
    current_stock: float
    forecast_demand: Optional[float] = None
    forecast_daily_demand: Optional[float] = None
    days_to_expiry: int
    risk_score: float
    risk_level: str
    recommended_action: str
    recommended_reorder: float
    explanation: str
    reorder_reason: str
    # Enhanced Explainable and Trend fields
    risk_contributors: Optional[Dict[str, float]] = None
    primary_reason: Optional[str] = None
    future_risks: Optional[List[Dict]] = None
    redistribution_recommendation: Optional[Dict] = None
    confidence_score: Optional[float] = None
    confidence_level: Optional[str] = None
    historical_observations: Optional[int] = None
    potential_waste_value: Optional[float] = None
    potential_avoidable_loss: Optional[float] = None
    estimated_recovery: Optional[float] = None
    financial_text: Optional[str] = None
    priority_score: Optional[float] = None
    cost_price: Optional[float] = None
    selling_price: Optional[float] = None

class BatchPredictResponse(BaseModel):
    message: str
    products_processed: int
    period: str
    results: List[BatchPredictItem]

# 6. What-If Simulation Schemas
class SimulationRequest(BaseModel):
    current_stock: float
    days_to_expiry: int
    forecast_demand: float
    purchase_quantity: float = 0.0
    storage_capacity: float = 100.0
    lead_time_days: int = 3
    safety_stock: float = 5.0
    waste_rate: Optional[float] = None
    cost_price: Optional[float] = None

class SimulationResponse(BaseModel):
    current: Dict
    simulated: Dict
    scenarios: Optional[List[Dict]] = None

# 7. Metrics response schema
class ModelMetricsItem(BaseModel):
    MAE: float
    RMSE: float
    MAPE: float

class ModelMetricsResponse(BaseModel):
    Prophet: ModelMetricsItem
    XGBoost: ModelMetricsItem
    LSTM: ModelMetricsItem
    notes: str
    best_mae_model: Optional[str] = None
    best_rmse_model: Optional[str] = None
    best_mape_model: Optional[str] = None
    selected_model: Optional[str] = None
    selection_reason: Optional[str] = None
    insufficient_data: Optional[bool] = False

# 8. System Health Response Schema
class SystemHealthResponse(BaseModel):
    success: bool
    health: Dict[str, str]
    details: Dict
    overall_status: Optional[str] = "READY"
    forecast_engine: Optional[str] = "READY"
    risk_engine: Optional[str] = "READY"
    batch_predictor: Optional[str] = "READY"
    scheduler: Optional[str] = "READY"
    database: Optional[str] = "READY"
    ai_microservice: Optional[str] = "READY"
    timestamp: Optional[str] = None
    message: Optional[str] = None
