# Weeks 3–4 Architecture & Implementation Plan: AI Waste Prediction Engine & Smart Reorder Microservice

## Executive Overview

This document defines the complete technical architecture and implementation strategy for the **Weeks 3–4 Milestone** of the *AI-Based Food Redistribution System*. 

The objective of Weeks 3–4 is to empower food businesses to proactively reduce food waste and optimize stock replenishment through machine learning demand forecasting, multi-factor waste-risk scoring, and intelligent reorder recommendations.

### Core Architectural Directives
1. **Zero Disturbance to Weeks 1–2**: Existing Flask backend, JWT authentication, user roles (`BUSINESS`, `NGO`, `ADMIN`), PostgreSQL schema, SQLAlchemy models, inventory management CRUD, CSV import/export, barcode/QR features, and React frontend remain 100% intact and operational.
2. **Modular & Isolated FastAPI Microservice**: The AI functionality (Prophet, LSTM, Risk Scorer, Reorder Engine) is architected as an isolated FastAPI microservice contained within `backend/app/ai/`, ensuring clean separation of concerns and high scalability.
3. **Strict Waste Risk Suppression**: Reorder recommendation engine strictly suppresses purchase recommendations when item waste-risk is `HIGH` or `CRITICAL`, preventing unnecessary financial loss and surplus food accumulation.

---

## 1. Existing Weeks 1–2 Architecture

The existing solution is structured as a full-stack monorepo:

```
AI-Food-Redistribution-System/
├── backend/
│   ├── app/
│   │   ├── api/             # Flask Blueprints (auth, health, inventory)
│   │   ├── config/          # Dev, Prod, Test config
│   │   ├── middleware/      # Error handlers & JWT RBAC middleware
│   │   ├── models/          # SQLAlchemy ORM models (User, InventoryItem, Enums)
│   │   ├── repositories/    # Inventory repository layer
│   │   ├── schemas/         # Marshmallow serialization schemas
│   │   ├── services/        # Core inventory & auth business logic
│   │   ├── extensions.py    # SQLAlchemy, JWT, CORS, Migrate instances
│   │   └── __init__.py      # Flask app factory create_app()
│   ├── run.py               # Flask backend entrypoint (Port 5000)
│   └── requirements.txt
├── database/
│   ├── schema.sql           # DDL SQL scaffold
│   ├── seed.py              # Python database seed script for admin, business, NGO, and sample inventory
│   └── app.db               # SQLite local development database
└── frontend/                # React 18 + Vite + TypeScript + Tailwind CSS
```

### Key Architectural Characteristics
* **Backend Framework**: Python 3.11 with Flask using the Application Factory pattern (`create_app()`).
* **Database & ORM**: PostgreSQL / SQLite fallback with SQLAlchemy ORM and Alembic migrations.
* **Authentication**: `Flask-JWT-Extended` with custom role-based access control (`@role_required(['BUSINESS'])`).
* **Existing APIs**: `/api/auth/*` (Login, Register, Profile), `/api/inventory/*` (CRUD, Dashboard summary, Expiring alerts, CSV import/export), `/api/health`.

---

## 2. Existing Reusable Data & Models

The Weeks 3–4 AI milestone directly reuses and builds upon the existing database models and repositories:

### Reusable Models (`backend/app/models/`)
* **`User`** (`user.py`): Authenticated business owners who own inventory records and view AI analytics.
* **`InventoryItem`** (`inventory.py`): Provides real-time stock levels (`quantity`), product category, unit, cost price (`cost_price`), selling price (`selling_price`), purchase date (`purchase_date`), and expiry date (`expiry_date`).
* **`InventoryCategory`** (`enums.py`): Time-series category grouping (`Fruits`, `Vegetables`, `Dairy`, `Bakery`, `Beverages`, `Frozen Foods`, `Grains`, `Meat`, `Seafood`, `Ready To Eat`, `Others`).
* **`StorageType`** (`enums.py`): Storage conditions (`Ambient`, `Refrigerated`, `Frozen`, `Dry Storage`).
* **`RiskLevel`** (`enums.py`): Base risk levels (`Low`, `Medium`, `High`, `Expired`), which will be extended to support `CRITICAL`.

### Reusable Repositories & Services
* **`InventoryRepository`** (`inventory_repository.py`): Provides optimized queries for active inventory items by user, category, and expiry window.
* **`InventoryService`** (`inventory_service.py`): Formats inventory data and will serve as the bridge between Flask routes and the FastAPI AI microservice.

---

## 3. Dataset Location and Actual Columns

### Repo Search Audit
A search across the entire workspace confirmed that **no pre-existing `.csv` dataset file** currently exists in the repository.

### Dataset Strategy
To train, evaluate, and test the time-series forecasting models (Prophet and LSTM), a structured historical dataset generator script (`database/generate_dataset.py`) will create a synthetic time-series dataset located at:

$$\text{Dataset Path: } \texttt{database/data/smart\_waste\_inventory\_dataset.csv}$$

### Actual & Target Dataset Schema

| Column Name | Data Type | Description / Usage in AI Models |
| :--- | :--- | :--- |
| `date` | `YYYY-MM-DD` | Timestamp for time-series aggregation & Prophet `ds` input |
| `category` | `String` | Product category for category-level demand grouping |
| `product_name` | `String` | Product identifier for item-level granularity |
| `units_sold` | `Float` | Target variable ($y$) for sales/demand forecasting |
| `units_purchased` | `Float` | Restocking history for lead-time analysis |
| `units_wasted` | `Float` | Historical spoilage/waste quantity for risk indicator computation |
| `closing_stock` | `Float` | Inventory level at end of day |
| `cost_price` | `Float` | Unit purchase cost |
| `selling_price` | `Float` | Unit retail price |
| `shelf_life_days` | `Integer` | Standard shelf life duration |
| `average_temperature` | `Float` | Storage environment temperature |
| `spoilage_rate` | `Float` | Historical spoilage percentage indicator (0.0 to 1.0) |
| `day_of_week` | `Integer` | Day of week index (0=Monday, 6=Sunday) for LSTM feature extraction |
| `is_weekend` | `Boolean` | Weekend indicator flag (0 or 1) |

---

## 4. Missing Data Required for Weeks 3–4

To satisfy all requirements of Weeks 3–4, the following data entities—currently missing from the database—will be added via new database models:

1. **Historical Sales & Demand Time-Series Data (`sales_transactions` table)**:
   * Records historical daily/weekly consumption and sales quantity per product category to train Prophet & LSTM models.
2. **Waste & Spoilage Logs (`waste_logs` table)**:
   * Records past waste events, reasons for spoilage, and discarded quantities to compute empirical spoilage indicators ($W_{rate}$).
3. **Reorder & Inventory Metadata (`inventory_items` table extensions / metadata)**:
   * Lead time (days required for new orders to arrive), safety stock buffer, and maximum storage capacity per item/category.
4. **AI Prediction History Cache (`ai_predictions` table)**:
   * Stores generated demand forecasts, waste-risk levels, and reorder recommendations for historical tracking and UI rendering.

---

## 5. Proposed AI Architecture

The AI module is architected as an isolated FastAPI microservice situated inside `backend/app/ai/`, running independently or mounted to Flask via proxy.

```
+-----------------------------------------------------------------------------------+
|                                  React Frontend                                   |
|                (Business Dashboard - Waste Risk & Smart Reorder Tab)               |
+-----------------------------------------+-----------------------------------------+
                                          | HTTP / JSON REST
                                          v
+-----------------------------------------+-----------------------------------------+
|                              Flask Core Backend (Port 5000)                       |
|                       JWT Auth, Inventory CRUD, Database Session                  |
+--------------------+------------------------------------+-------------------------+
                     |                                    |
                     | Shared DB Session                  | Internal Proxy / HTTP
                     v                                    v
+--------------------+--------------------+ +-------------+-------------------------+
|       PostgreSQL / SQLite Database      | |      FastAPI AI Microservice (Port 8000) |
| (inventory_items, sales_transactions,   | |  ├── Demand Forecasting (Prophet/LSTM)|
|  waste_logs, ai_predictions)            | |  ├── Waste-Risk Scoring Engine        |
+-----------------------------------------+ |  └── Smart Reorder Recommendation Engine|
                                            +---------------------------------------+
```

### Core Subcomponents

#### A. Data Preprocessor (`backend/app/ai/preprocessing/`)
* **`data_loader.py`**: Queries `sales_transactions` and `smart_waste_inventory_dataset.csv`.
* **`time_series_cleaner.py`**: Resamples data into uniform daily (`D`) and weekly (`W`) time frequencies, handles missing dates via forward-fill/interpolation, and formats datasets for Prophet (`ds`, `y`) and LSTM (3D tensor windows: `[samples, time_steps, features]`).

#### B. Demand Forecasting Models (`backend/app/ai/models/`)
* **Prophet Model (`prophet_model.py`)**: Meta Prophet time-series forecaster tuned for weekly seasonality, holiday effects, and macro trend shifts per product category.
* **LSTM Model (`lstm_model.py`)**: PyTorch-based Long Short-Term Memory recurrent neural network capturing complex non-linear short-term demand patterns.
* **Model Evaluator (`evaluator.py`)**: Compares Prophet vs LSTM on test splits using three evaluation metrics:
  $$\text{MAE} = \frac{1}{n} \sum_{t=1}^n |y_t - \hat{y}_t|$$
  $$\text{RMSE} = \sqrt{\frac{1}{n} \sum_{t=1}^n (y_t - \hat{y}_t)^2}$$
  $$\text{MAPE} = \frac{100\%}{n} \sum_{t=1}^n \left| \frac{y_t - \hat{y}_t}{y_t} \right|$$
  Selects the superior model dynamically for category forecasts.

#### C. Waste-Risk Scoring Engine (`backend/app/ai/algorithms/waste_risk_scorer.py`)
Computes a normalized multi-factor waste-risk score ($S_{risk} \in [0, 100]$):

$$S_{risk} = w_1 \cdot f(\text{Days to Expiry}) + w_2 \cdot f\left(\frac{\text{Current Stock}}{\text{Forecast Demand}}\right) + w_3 \cdot f(\text{Spoilage Indicator}) + w_4 \cdot f(\text{Stock Age})$$

**Risk Level Categorization**:
* **`LOW`** ($S_{risk} < 30$): Stock outflow comfortably exceeds expiry risk.
* **`MEDIUM`** ($30 \le S_{risk} < 60$): Moderate risk; monitor sales pace.
* **`HIGH`** ($60 \le S_{risk} < 85$): High risk of spoilage; prioritize sales or donation.
* **`CRITICAL`** ($S_{risk} \ge 85$ or $\text{Days to Expiry} \le 2$): Severe spoilage danger; flag for urgent redistribution.

#### D. Smart Reorder Recommendation Engine (`backend/app/ai/algorithms/smart_reorder.py`)
Calculates Reorder Point (ROP) and Recommended Order Quantity ($Q_{reorder}$):

$$\text{Safety Stock (SS)} = Z \times \sigma_{d} \times \sqrt{\text{Lead Time}}$$
$$\text{Reorder Point (ROP)} = (\hat{D}_{\text{daily}} \times \text{Lead Time}) + \text{Safety Stock}$$
$$Q_{reorder} = \max(0, \text{Storage Capacity} - \text{Current Stock} + \hat{D}_{\text{forecast}})$$

**CRITICAL SAFETY RULE**:
$$\text{If Risk Level} \in \{\text{HIGH}, \text{CRITICAL}\}, \text{ then } Q_{reorder} = 0$$
* Prevents unnecessary purchasing when current inventory is already at risk of spoiling.

#### E. Prediction Execution Modes
1. **Real-Time / On-Demand Prediction**: Triggered via `POST /api/ai/predict` upon request.
2. **Scheduled / Batch Prediction**: Background APScheduler job running nightly to pre-calculate and cache risk levels for all business inventory items.

---

## 6. Proposed New Files

```
AI-Food-Redistribution-System/
├── docs/
│   └── WEEKS_3_4_ARCHITECTURE.md             [THIS DOCUMENT]
├── database/
│   ├── generate_dataset.py                    # Synthetic dataset generator script
│   └── data/
│       └── smart_waste_inventory_dataset.csv # Time-series historical dataset
├── backend/
│   ├── app/
│   │   ├── ai/                               # FASTAPI AI MICROSERVICE MODULE
│   │   │   ├── __init__.py
│   │   │   ├── main.py                       # FastAPI microservice app entrypoint
│   │   │   ├── config.py                     # AI parameters, weights, hyperparameters
│   │   │   ├── preprocessing/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── data_loader.py            # DB and CSV data loader
│   │   │   │   └── time_series_cleaner.py    # Resampling, interpolation, sequence scaling
│   │   │   ├── models/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── prophet_model.py          # Prophet demand forecasting wrapper
│   │   │   │   ├── lstm_model.py             # PyTorch LSTM forecasting neural network
│   │   │   │   └── evaluator.py              # MAE, RMSE, MAPE comparison engine
│   │   │   ├── algorithms/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── waste_risk_scorer.py      # Multi-factor waste risk scorer (LOW, MED, HIGH, CRITICAL)
│   │   │   │   └── smart_reorder.py          # ROP, Safety Stock, Reorder Quantity logic
│   │   │   ├── scheduler/
│   │   │   │   ├── __init__.py
│   │   │   │   └── batch_jobs.py             # APScheduler batch prediction jobs
│   │   │   └── schemas/
│   │   │       ├── __init__.py
│   │   │       └── ai_schemas.py             # Pydantic validation schemas
│   │   ├── models/
│   │   │   ├── sales_log.py                  # ORM model for historical sales/consumption
│   │   │   ├── waste_log.py                  # ORM model for historical spoilage events
│   │   │   └── prediction.py                 # ORM model for cached predictions & reorders
│   │   └── api/
│   │       └── ai_routes.py                  # Flask blueprint route proxy to AI microservice
│   └── tests/
│       ├── test_ai_preprocessing.py
│       ├── test_forecasting_models.py
│       ├── test_waste_risk_scorer.py
│       └── test_smart_reorder.py
```

---

## 7. Proposed API Endpoints

### FastAPI AI Microservice Endpoints (`/api/ai/*`)

#### 1. Demand Forecasting
* **`POST /api/ai/forecast`**
  * **Payload**: `{"category": "Dairy", "granularity": "daily", "days": 14}`
  * **Response**: Prophet vs. LSTM demand forecast curves, daily/weekly values, and model comparison metrics (MAE, RMSE, MAPE).

#### 2. Waste Risk Scoring
* **`POST /api/ai/waste-risk`**
  * **Payload**: `{"item_id": "uuid", "days_to_expiry": 3, "current_stock": 45, "storage_type": "Refrigerated"}`
  * **Response**: Composite risk score, risk level (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), risk factors breakdown.

#### 3. Smart Reorder Recommendations
* **`POST /api/ai/reorder-recommendations`**
  * **Payload**: `{"item_id": "uuid", "lead_time_days": 3, "safety_stock": 10, "max_capacity": 100}`
  * **Response**: Reorder Point (ROP), recommended order quantity ($Q_{reorder}$), purchase suppression status (`suppressed: true` if risk is HIGH/CRITICAL).

#### 4. Scheduled Batch Prediction
* **`POST /api/ai/batch-predict`**
  * **Payload**: `{"user_id": "uuid"}` (Optional filter)
  * **Response**: Summary of updated prediction records for active inventory items.

#### 5. Model Evaluation Metrics
* **`GET /api/ai/model-metrics`**
  * **Response**: Benchmark summary of Prophet vs LSTM metrics across all product categories.

---

## 8. Integration Points with Weeks 1–2

1. **Authentication & Authorization**:
   * Flask proxy routes in `backend/app/api/ai_routes.py` enforce `@jwt_required()` and `@role_required(['BUSINESS'])`, securing access to the AI microservice.
2. **Database Continuity**:
   * New models (`SalesTransaction`, `WasteLog`, `PredictionResult`) link to existing `User` (`users.id`) and `InventoryItem` (`inventory_items.id`) tables with foreign key constraints.
3. **Frontend Integration**:
   * React frontend receives AI prediction data via Axios API calls (`frontend/src/services/ai.ts`) and displays risk scores and reorder badges in `BusinessDashboardShell.tsx`.
4. **Non-Breaking Extension**:
   * Existing inventory endpoints (`GET /api/inventory`, `POST /api/inventory`, `POST /api/inventory/import`) remain completely untouched.

---

## 9. Testing Strategy

### A. Automated Unit Tests (`backend/tests/`)
1. **`test_ai_preprocessing.py`**: Verifies time-series cleaner resampling, zero missing dates, forward-fill interpolation, and sequence scaling.
2. **`test_forecasting_models.py`**: Verifies Prophet and PyTorch LSTM model training, inference output shapes, non-negativity constraint, and metric evaluation (MAE, RMSE, MAPE).
3. **`test_waste_risk_scorer.py`**: Tests risk scorer boundary conditions (e.g. 1 day to expiry = `CRITICAL`, stock > forecast = `HIGH`, 30 days to expiry = `LOW`).
4. **`test_smart_reorder.py`**: Verifies ROP and safety stock math, and asserts that $Q_{reorder} = 0$ whenever waste-risk is `HIGH` or `CRITICAL`.

### B. Integration Tests
1. **FastAPI Microservice Test Suite**: Uses `httpx.AsyncClient` to test all FastAPI endpoints.
2. **Flask-FastAPI Proxy Test Suite**: Tests end-to-end JWT authenticated requests from Flask routes to the AI service.

### C. Regression Verification
1. Run `pytest backend/tests` to confirm zero regression on existing auth and inventory features.
