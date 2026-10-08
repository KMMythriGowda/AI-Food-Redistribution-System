# Weeks 3–4 AI Waste Prediction & Smart Replenishment Implementation

This document provides a comprehensive technical overview of the implementation, data preprocessing pipeline, demand forecasting models, waste-risk scorer, smart replenishment logic, background scheduler jobs, APIs, and frontend user interfaces introduced in the Weeks 3–4 Milestone.

---

## 1. System Architecture

The AI module is implemented as a dual-mode, explainable service integrated securely with the existing full-stack codebase.

```
+---------------------------------------------------------+
|                    React Frontend                       |
|           (AI Waste Prediction Tab component)           |
+---------------------------+-----------------------------+
                            | HTTP REST
                            v
+---------------------------+-----------------------------+
|                Flask Backend proxy (Port 5000)          |
|    JWT Authentication, Route Proxy, SQLite / Postgres    |
+---------------------------+-----------------------------+
                            | HTTP Proxy Call
                            v
+---------------------------+-----------------------------+
|             FastAPI AI Microservice (Port 8000)         |
|  - Forecasting (Prophet & LSTM)                         |
|  - Multi-Factor Waste Risk Engine                       |
|  - Smart Replenishment Engine                           |
|  - Background Jobs (APScheduler)                        |
+---------------------------------------------------------+
```

* **Backend Proxying**: The Flask application exposes `/api/ai/*` routes that act as secure JWT-authenticated entrypoints, forwarding verified traffic internally to the FastAPI microservice.
* **Shared Context**: The FastAPI microservice interacts directly with the database using the same SQLAlchemy models within the Flask app context, ensuring zero duplication of database code.

---

## 2. Database Extensions

The SQL database is updated with three columns in the existing `inventory_items` table, and four new tables:
1. **`inventory_items` Extension**:
   * `lead_time_days` (Integer, default 3): Days needed to receive reorders.
   * `safety_stock` (Float, default 5.0): Buffer stock to handle demand surges.
   * `storage_capacity` (Float, default 100.0): Maximum stock storage capacity.
2. **`sales_transactions` Table**: Stores historical sales logs used to train demand models.
3. **`waste_logs` Table**: Stores historical spoilage events and costs.
4. **`ai_predictions` Table (`PredictionResult`)**: Caches generated demand forecasts, risk scores, risk levels, recommended actions, and replenishment suggestions historically to enable trend plotting over time.
5. **`job_logs` Table (`JobLog`)**: Tracks start/end times, processed products, failed products, and success status (STARTED/COMPLETED/PARTIAL/FAILED) of scheduled background runs.

---

## 3. Data Preprocessing & Feature Engineering

The preprocessing pipeline (`preprocessing.py`) and feature engineering module (`feature_engineering.py`) prepare historical and real-time inventory records for the AI engines.

* **Cleaning & Aggregation**: Filters index variables, removes duplicate records, parses datetimes, clips invalid quantities to non-negative bounds, and aggregates raw demand time-series by date, product, and category (daily, weekly, and monthly frequencies).
* **Feature Extraction**:
   * `days_to_expiry`: Time remaining in days until product expiry.
   * `stock_days`: `current_stock / (daily_demand + 1e-5)` (days of stock remaining).
   * `excess_stock`: `max(0, current_stock - (forecast_demand * days_to_expiry))` (spoilage-threat quantity).
   * `demand_to_stock_ratio`: Ratio of forecast demand to current stock.
   * **Pressure Metrics**:
      * `expiry_pressure`: Exponentially decays from 0.0 (fresh) to 1.0 (expired/expiring within 2 days).
      * `stock_pressure`: `current_stock / storage_capacity` (percentage of maximum storage capacity filled).
      * `demand_pressure`: Leftover ratio of stock that cannot be cleared by projected demand.

---

## 4. Demand Forecasting Models

The system implements Prophet and LSTM neural networks with automatic dependency wrappers:

* **Prophet Model** (`prophet_model.py`): Formulates daily/weekly seasonality, macro trend shifts, and forecasting horizons.
* **LSTM Model** (`lstm_model.py`): PyTorch-based sequential neural network representing multi-step demand dependencies.
* **Branded Statistical Fallback**: If `prophet` or `torch` is not installed on the system (e.g. compiler blockages), the system runs a statistical linear regression and double exponential smoothing forecaster, reporting the model name as `"fallback_statistical"`.

---

## 5. Model Evaluation Comparisons

The evaluation metrics (`evaluation.py`) reuse the specific metrics obtained in experiment testing splits to display on the comparison tabs:

| Model | MAE | RMSE | MAPE |
| :--- | :--- | :--- | :--- |
| **Prophet** | 934.09 | 1114.40 | 24.89% |
| **LSTM** | 446.05 | 596.37 | 10.88% |
| **XGBoost** | 438.69 | 542.07 | 11.04% |

* **Interpretation**: XGBoost achieved the lowest absolute deviation (MAE and RMSE), LSTM achieved the lowest percentage error (MAPE), and Prophet serves as the statistical baseline.

---

## 6. Explainable Waste-Risk Engine

Calculates a 0–100 waste-risk score based on configurable factors:
* Expiry pressure: 35%
* Excess stock pressure: 30%
* Demand mismatch: 20%
* Historical waste: 10%
* Demand trend: 5%

### Risk Level Classifications
* **LOW** (0–24) -> Action: `NORMAL INVENTORY`
* **MEDIUM** (25–49) -> Action: `MONITOR`
* **HIGH** (50–74) -> Action: `PROMOTE / REDISTRIBUTE`
* **CRITICAL** (75–100) -> Action: `REDISTRIBUTE / DONATE`

### Overrides & Explainability
* If `days_to_expiry <= 2`, the risk level is overridden to **CRITICAL**, action is set to **REDISTRIBUTE / DONATE**, and the score is forced to at least **85.0**.
* **Explanation format**: *"Critical risk because 50 units are in stock, forecast demand is 15 units/day and the product expires in 2 days."*

### Risk Trends
By comparing the current prediction with the prior record of the same item in `PredictionResult`, the engine determines:
* **RISING**: Score increased by >3.0.
* **FALLING**: Score decreased by >3.0.
* **STABLE**: Score change between -3.0 and 3.0.

---

## 7. Smart Replenishment & Adaptive Reorders

 replenishes stock based on forecast demand, lead time, safety buffer, storage boundaries, and risk levels:
* **Reorder Point (ROP)**: `(forecast_daily_demand * lead_time_days) + safety_stock`
* **Target Stock**: `ROP + (forecast_daily_demand * 7.0)`
* **Wastage Safety Rule**: If risk level is **HIGH** or **CRITICAL**, the recommended order quantity is forced to **0.0**, and the action suggests clearing stock (REDISTRIBUTE / DONATE) instead of purchasing new items.
* **Storage Cap**: Reorders are capped at the remaining storage capacity (`storage_capacity - current_stock`).

---

## 8. Daily, Weekly, and Monthly Jobs

* **Daily Job**: Computes daily forecasts, risk levels, and replenishment needs for all items, storing predictions in `PredictionResult` to capture risk trends over time.
* **Weekly Job**: Computes weekly demand forecasts, 7-day trend indices, and compiles a weekly summary log.
* **Monthly Job**: Computes monthly forecasts, monthly trends, recurring overstock patterns, and compiles a monthly report.

---

## 9. What-If Simulation Endpoint

The `POST /api/ai/simulate` endpoint allows managers to input alternative stock, expiry, demand, or purchase quantities and returns a before-and-after comparison of risk scores, levels, recommended actions, and reorder quantities, facilitating risk assessment.

---

## 10. API Endpoints

FastAPI endpoints exposed under `/api/ai/*` (proxied by Flask):
* `GET /api/ai/health`: Microservice health check.
* `POST /api/ai/forecast`: Demand forecast curves.
* `POST /api/ai/waste-risk`: Real-time risk calculations.
* `POST /api/ai/reorder-recommendations`: Smart replenishment.
* `POST /api/ai/batch-predict`: Mass trigger of evaluation job.
* `GET /api/ai/model-metrics`: Model benchmark comparison data.
* `GET /api/ai/risk-summary`: Aggregated risk level counters.
* `GET /api/ai/risk-trends`: Item risk trend directions.
* `GET /api/ai/reorder-summary`: Active replenishment list.
* `POST /api/ai/simulate`: Interactive scenario tests.
* `GET /api/ai/scheduler-status`: Historical run logs of scheduler jobs.
