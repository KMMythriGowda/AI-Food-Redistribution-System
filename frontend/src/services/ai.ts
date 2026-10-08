import apiClient from './api';
import { ApiResponse } from '@/types';

const normalizeAiResponse = <T>(payload: any): ApiResponse<T> => {
  if (payload && typeof payload === 'object' && 'success' in payload) {
    if ('data' in payload) {
      return payload as ApiResponse<T>;
    } else {
      const { success, message, ...rest } = payload;
      return {
        success: !!success,
        data: rest as T,
        message: message ? String(message) : undefined,
      };
    }
  }

  return {
    success: true,
    data: payload as T,
    message: payload && typeof payload === 'object' && 'message' in payload ? String(payload.message) : undefined,
  };
};

export interface ForecastRequest {
  category: string;
  product_name?: string;
  granularity?: 'daily' | 'weekly' | 'monthly';
  horizon?: number;
  current_stock?: number;
}

export interface ForecastResponse {
  model_name: string;
  forecast: number[];
  dates: string[];
  MAE?: number | null;
  RMSE?: number | null;
  MAPE?: number | null;
  forecast_horizon: number;
  forecast_period: string;
  status: string;
  historical_dates?: string[];
  historical_values?: number[];
  trend_direction?: string;
  evaluation_observations?: number;
  is_evaluation_valid?: boolean;
}

export interface WasteRiskResponse {
  product_id?: string;
  risk_score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  expiry_pressure: number;
  excess_stock_pressure: number;
  demand_mismatch: number;
  waste_pressure: number;
  demand_trend_pressure: number;
  recommended_action: string;
  explanation: string;
  risk_contributors?: Record<string, number>;
  primary_reason?: string;
  future_risks?: Array<{ day: string; risk_score: number; risk_level: string }>;
  redistribution_recommendation?: {
    action: 'NORMAL SALE' | 'DISCOUNT' | 'REDISTRIBUTE' | 'DONATE' | 'EMERGENCY CONSUMPTION';
    quantity: number;
    surplus: number;
    days_to_expiry: number;
  };
  confidence_score?: number;
  confidence_level?: string;
  historical_observations?: number;
  potential_waste_value?: number | null;
  potential_avoidable_loss?: number | null;
  estimated_recovery?: number | null;
  financial_text?: string;
}

export interface ReorderResponse {
  product_id?: string;
  reorder_point: number;
  target_stock: number;
  recommended_quantity: number;
  available_storage_capacity: number;
  action: string;
  reason: string;
  is_suppressed: boolean;
  forecast_daily_demand: number;
  current_stock: number;
  storage_capacity: number;
  reorder_explanation?: {
    forecast_daily_demand: number;
    lead_time_days: number;
    safety_stock: number;
    current_stock: number;
    storage_capacity: number;
    expected_stock_after_reorder: number;
    reorder_point: number;
    target_stock: number;
  };
}

export interface BatchPredictItem {
  product_id: string;
  product_name: string;
  current_stock: number;
  forecast_demand: number;
  forecast_daily_demand?: number;
  days_to_expiry: number;
  risk_score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommended_action: string;
  recommended_reorder: number;
  explanation: string;
  reorder_reason: string;
  risk_contributors?: Record<string, number>;
  primary_reason?: string;
  future_risks?: Array<{ day: string; risk_score: number; risk_level: string }>;
  redistribution_recommendation?: {
    action: 'NORMAL SALE' | 'DISCOUNT' | 'REDISTRIBUTE' | 'DONATE' | 'EMERGENCY CONSUMPTION';
    quantity: number;
    surplus: number;
    days_to_expiry: number;
  };
  confidence_score?: number;
  confidence_level?: string;
  historical_observations?: number;
  potential_waste_value?: number | null;
  potential_avoidable_loss?: number | null;
  estimated_recovery?: number | null;
  financial_text?: string;
  data_quality?: string;
  drift_warning?: string | null;
  reorder_explanation?: {
    forecast_daily_demand: number;
    lead_time_days: number;
    safety_stock: number;
    current_stock: number;
    storage_capacity: number;
    expected_stock_after_reorder: number;
    reorder_point: number;
    target_stock: number;
  };
}

export interface BatchPredictResponse {
  message: string;
  products_processed: number;
  period: string;
  results: BatchPredictItem[];
}

export interface SimulationRequest {
  current_stock: number;
  days_to_expiry: number;
  forecast_demand: number;
  purchase_quantity?: number;
  storage_capacity?: number;
  lead_time_days?: number;
  safety_stock?: number;
  waste_rate?: number;
  cost_price?: number;
}

export interface SimulationResponse {
  current: {
    risk_score: number;
    risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    recommended_action: string;
    explanation: string;
    recommended_reorder: number;
    reorder_reason: string;
  };
  simulated: {
    risk_score: number;
    risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    recommended_action: string;
    explanation: string;
    recommended_reorder: number;
    reorder_reason: string;
  };
  scenarios?: Array<{
    scenario_name: string;
    stock: number;
    demand: number;
    risk_score: number;
    risk_level: string;
    recommended_reorder: number;
    action: string;
    explanation: string;
    expected_waste?: number;
    financial_impact?: number;
    is_recommended?: boolean;
  }>;
  recommended_scenario?: string;
  recommendation_reason?: string;
}

export interface ModelMetricsResponse {
  Prophet: { MAE: number; RMSE: number; MAPE: number };
  XGBoost: { MAE: number; RMSE: number; MAPE: number };
  LSTM: { MAE: number; RMSE: number; MAPE: number };
  notes: string;
  best_mae_model?: string;
  best_rmse_model?: string;
  best_mape_model?: string;
  selected_model?: string;
  selection_reason?: string;
  insufficient_data?: boolean;
}

export interface SchedulerLog {
  id: string;
  job_name: string;
  status: 'STARTED' | 'COMPLETED' | 'PARTIAL' | 'FAILED';
  start_time: string;
  end_time?: string;
  products_processed: number;
  products_failed: number;
  critical_products?: number;
  error_message?: string;
  created_at: string;
}

export const aiService = {
  async getForecast(data: ForecastRequest): Promise<ApiResponse<ForecastResponse>> {
    const response = await apiClient.post<any>('/ai/forecast', data);
    return normalizeAiResponse<ForecastResponse>(response.data);
  },

  async getModelMetrics(): Promise<ApiResponse<ModelMetricsResponse>> {
    const response = await apiClient.get<any>('/ai/model-metrics');
    return normalizeAiResponse<ModelMetricsResponse>(response.data);
  },

  async runBatchPredict(period: 'daily' | 'weekly' | 'monthly' = 'daily'): Promise<ApiResponse<BatchPredictResponse>> {
    const response = await apiClient.post<any>('/ai/batch-predict', { period });
    return normalizeAiResponse<BatchPredictResponse>(response.data);
  },

  async getRiskSummary(): Promise<ApiResponse<{ total_analyzed: number; summary: Record<string, number> }>> {
    const response = await apiClient.get<any>('/ai/risk-summary');
    return normalizeAiResponse<{ total_analyzed: number; summary: Record<string, number> }>(response.data);
  },

  async getRiskTrends(): Promise<ApiResponse<{ total_items: number; trends: any[] }>> {
    const response = await apiClient.get<any>('/ai/risk-trends');
    return normalizeAiResponse<{ total_items: number; trends: any[] }>(response.data);
  },

  async getReorderSummary(): Promise<ApiResponse<{ 
    total_reorder_candidates: number; 
    total_reorder_quantity: number; 
    suppressed_candidates: number; 
    candidates: any[];
    total_potential_waste_value?: number;
    total_avoidable_loss?: number;
    total_estimated_recovery_value?: number;
    total_redistribute_quantity?: number;
    total_redistribution_value?: number;
    total_potential_savings?: number;
    redistribution_actions_count?: number;
    orders_suppressed_count?: number;
    waste_prevention_score?: number;
    limited_historical_data?: boolean;
    waste_prevented_units?: number;
    financial_savings_value?: number;
    redistribution_rate_pct?: number;
    hist_preds_exist?: boolean;
  }>> {
    const response = await apiClient.get<any>('/ai/reorder-summary');
    return normalizeAiResponse<{ 
      total_reorder_candidates: number; 
      total_reorder_quantity: number; 
      suppressed_candidates: number; 
      candidates: any[];
      total_potential_waste_value?: number;
      total_avoidable_loss?: number;
      total_estimated_recovery_value?: number;
      total_redistribute_quantity?: number;
      total_redistribution_value?: number;
      total_potential_savings?: number;
      redistribution_actions_count?: number;
      orders_suppressed_count?: number;
      waste_prevention_score?: number;
      limited_historical_data?: boolean;
      waste_prevented_units?: number;
      financial_savings_value?: number;
      redistribution_rate_pct?: number;
      hist_preds_exist?: boolean;
    }>(response.data);
  },

  async simulate(data: SimulationRequest): Promise<ApiResponse<SimulationResponse>> {
    const response = await apiClient.post<any>('/ai/simulate', data);
    return normalizeAiResponse<SimulationResponse>(response.data);
  },

  async getSchedulerStatus(): Promise<ApiResponse<{ logs: SchedulerLog[]; scheduler_status: string; daily_schedule: string; weekly_schedule: string; next_daily_run: string | null; next_weekly_run: string | null; last_run: string | null; last_run_status: string | null; last_run_items: number; active_jobs: any[]; scheduler_error?: string }>> {
    const response = await apiClient.get<any>('/ai/scheduler-status');
    return normalizeAiResponse<any>(response.data);
  },

  async getSystemHealth(): Promise<ApiResponse<SystemHealthResponse>> {
    const response = await apiClient.get<any>('/ai/system-health');
    return normalizeAiResponse<SystemHealthResponse>(response.data);
  },
};

export interface SystemHealthResponse {
  success: boolean;
  health: {
    forecast_engine: 'READY' | 'ACTIVE' | 'WARNING' | 'ERROR';
    risk_engine: 'READY' | 'ACTIVE' | 'WARNING' | 'ERROR';
    batch_predictor: 'READY' | 'ACTIVE' | 'WARNING' | 'ERROR';
    scheduler: 'READY' | 'ACTIVE' | 'WARNING' | 'ERROR';
    database: 'READY' | 'ACTIVE' | 'WARNING' | 'ERROR';
    ai_microservice: 'READY' | 'ACTIVE' | 'WARNING' | 'ERROR';
  };
  details: {
    last_successful_prediction?: string | null;
    last_forecast_update?: string | null;
    last_scheduler_run?: string | null;
    products_processed?: string;
    categories_forecasted?: string;
  };
}

export default aiService;
