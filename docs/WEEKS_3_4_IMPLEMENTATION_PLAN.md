# Weeks 3–4 Implementation Plan: AI-Based Waste Prediction Engine & Smart Reorder System

## Executive Summary

This document provides a comprehensive technical blueprint for implementing **Weeks 3–4: AI-Based Waste Prediction Engine & Smart Reorder Recommendations** for the *AI-Based Food Redistribution System*.

This plan strictly preserves all existing Weeks 1–2 architecture, authentication mechanisms, database models, role-based access controls, and UI components without breaking or rewriting existing functionality.

---

## A. Existing Weeks 1–2 Architecture

The existing solution is structured as an enterprise full-stack monorepo:

### 1. Backend Architecture
* **Framework**: Python 3.11 with Flask using the Application Factory Pattern (`create_app()`).
* **Database & ORM**: PostgreSQL (SQLAlchemy ORM + Flask-Migrate). SQLite fallback supported for local dev.
* **Authentication**: JWT authentication (`Flask-JWT-Extended`) with custom RBAC middleware (`@role_required(['BUSINESS'])`).
* **Serialization**: Marshmallow schemas (`InventoryCreateSchema`, `InventoryUpdateSchema`, `InventoryItemSchema`).
* **API Routing**: Modular Flask Blueprints (`auth_bp`, `health_bp`, `inventory_bp`) mounted under `/api`.

### 2. Frontend Architecture
* **Framework**: React 18 + Vite + TypeScript.
* **Styling**: Tailwind CSS + custom Glassmorphism tokens (`glass-panel`, `glass-card`) + Framer Motion animations.
* **State & Query Management**: `@tanstack/react-query` for cached server states and automatic cache invalidation.
* **UI & Visualizations**: Lucide React icons, Recharts, custom skeleton loaders.

### 3. Database Schema
* `users` table: User management, credentials, roles (`BUSINESS`, `NGO`, `ADMIN`), organization info.
* `inventory_items` table: Inventory records including product name, category, quantity, unit, purchase date, expiry date, storage type, low stock threshold, cost price, selling price, barcode, computed risk status.

---

## B. Existing Reusable Models & APIs

The following existing components will be directly leveraged for Weeks 3–4:

### 1. Models & Schemas
* `InventoryItem` (`backend/app/models/inventory.py`): Supplies real-time stock levels (`quantity`), unit, storage type, cost/selling price, purchase date, and `expiry_date`.
* `InventoryCategory` (`backend/app/models/enums.py`): Categorizes items for time-series grouping (`Fruits`, `Vegetables`, `Dairy`, `Bakery`, `Meat`, `Seafood`, `Grains`, `Beverages`, `Prepared Foods`, `Frozen Foods`, `Others`).
* `RiskLevel` (`backend/app/models/enums.py`): Base risk levels (`Low`, `Medium`, `High`, `Expired`).

### 2. APIs & Repositories
* `InventoryRepository.list()` (`backend/app/repositories/inventory_repository.py`): Retrieves inventory items for scoring.
* `InventoryService.get_dashboard_summary()`: Can consume AI risk predictions to enrich overall business health metrics.

---

## C. Missing Components Required for Weeks 3–4

To build the AI-Based Waste Prediction Engine, the following new components must be developed:

### 1. Data Collection & Preprocessing Engine
* **Historical Sales & Transaction Logger**: Model and table to record past sales volume, purchase history, and recorded waste/spoilage events over time.
* **Time-Series Preprocessor**: Module to clean, aggregate, resample (daily/weekly), handle missing values, and extract time features (day of week, seasonality, holidays) per product category.

### 2. Demand Forecasting Machine Learning Models
* **Prophet Forecasting Engine**: Facebook/Meta Prophet model for capturing macro seasonal trends, weekly seasonality, and holiday effects on food product categories.
* **LSTM (Long Short-Term Memory) Neural Network**: Recurrent Neural Network built with PyTorch/TensorFlow/scikit-learn to capture non-linear, short-term demand patterns.
* **Hybrid Ensemble Forecaster**: Blends Prophet and LSTM forecasts for optimal RMSE/MAE accuracy.

### 3. Waste Risk Scoring Algorithm
Multi-factor risk evaluation formula combining:
$$\text{Waste Risk Score} = f(\text{Days to Expiry}, \text{Current Stock}, \text{Predicted Demand}, \text{Storage Temp / Spoilage Rate})$$
* Output Categories: **Low**, **Medium**, **High**, **Critical**.

### 4. Smart Reorder Recommendation Engine
Calculates optimal purchase quantities based on:
$$\text{Reorder Point (ROP)} = (\text{Predicted Daily Demand} \times \text{Lead Time}) + \text{Safety Stock}$$
$$\text{Recommended Order Quantity} = \max(0, \text{Target Inventory Capacity} - \text{Current Stock} + \text{Predicted Demand Outflow})$$

### 5. Deployment Framework: FastAPI AI Microservice / Module
* Lightweight, async **FastAPI** service operating alongside Flask or as a dedicated sub-module, exposing async endpoints for real-time risk scoring and batch model retraining.
* Support for **real-time/on-demand scoring** and **scheduled/batch prediction** (via APScheduler/Celery).

---

## D. Recommended Integration Points

```
+-------------------------------------------------------------------+
|                        React Frontend SaaS                        |
|   (Business Dashboard - Waste Prediction & Smart Reorder View)   |
+---------------------------------+---------------------------------+
                                  | HTTP / JSON REST
                                  v
+---------------------------------+---------------------------------+
|                       Flask Main Backend API                      |
|                (Port 5000: Auth, Inventory, User RBAC)            |
+------------------+------------------------------+------------------+
                   |                              |
                   | DB Queries                   | Internal HTTP / Proxy
                   v                              v
+------------------+--------------+ +--------------------------------+
|       PostgreSQL / SQLite       | |      FastAPI AI Microservice   |
| (users, inventory, sales_logs,  | |   (Port 8000 / Submodule)      |
|    waste_logs, predictions)     | | (Prophet, LSTM, Risk Engine)  |
+---------------------------------+ +--------------------------------+
```

* **Data Layer**: FastAPI service connects to the shared PostgreSQL database to read historical transactions and inventory levels.
* **API Layer**: Flask backend proxies AI requests to FastAPI or FastAPI runs as a standalone service accessible via `/api/ai/*`.
* **Execution**: Scheduled batch jobs run nightly to update prediction tables; on-demand scoring triggers immediately when inventory is updated.

---

## E. New Files to Be Created

```
AI-Food-Redistribution-System/
├── docs/
│   └── WEEKS_3_4_IMPLEMENTATION_PLAN.md      [THIS FILE]
├── backend/
│   ├── app/
│   │   ├── ai/                               [AI MICROSERVICE MODULE]
│   │   │   ├── __init__.py
│   │   │   ├── main.py                       # FastAPI application entrypoint
│   │   │   ├── config.py                     # AI service configuration & hyperparameters
│   │   │   ├── preprocessing/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── data_loader.py            # Extracts sales & inventory logs from DB
│   │   │   │   └── time_series_cleaner.py    # Resampling, interpolation, feature engineering
│   │   │   ├── models/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── prophet_model.py          # Prophet demand forecasting wrapper
│   │   │   │   ├── lstm_model.py             # PyTorch/TensorFlow LSTM demand model
│   │   │   │   └── ensemble.py               # Hybrid ensemble forecaster
│   │   │   ├── algorithms/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── waste_risk_scorer.py      # Risk scoring (Low, Medium, High, Critical)
│   │   │   │   └── smart_reorder.py          # ROP, Safety Stock, Reorder Quantity logic
│   │   │   ├── scheduler/
│   │   │   │   ├── __init__.py
│   │   │   │   └── batch_jobs.py             # Scheduled batch predictions & background jobs
│   │   │   └── schemas/
│   │   │       ├── __init__.py
│   │   │       └── ai_schemas.py             # Pydantic schemas for AI request/responses
│   │   ├── models/
│   │   │   ├── sales_log.py                  # Sales & demand history ORM model
│   │   │   ├── waste_log.py                  # Historical spoilage & waste ORM model
│   │   │   └── prediction.py                 # Stored prediction results ORM model
│   │   └── api/
│   │       └── ai_routes.py                  # Flask route proxy to AI service
│   └── tests/
│       ├── test_ai_preprocessing.py
│       ├── test_forecasting_models.py
│       ├── test_waste_risk_scorer.py
│       └── test_smart_reorder.py
```

---

## F. Existing Files Needing Minimal Modification

1. `backend/requirements.txt`: Add FastAPI, Uvicorn, Prophet, torch/scikit-learn, pandas, numpy, pydantic, apscheduler.
2. `backend/app/models/enums.py`: Add `Critical` to `RiskLevel` or extend `WasteRiskLevel` enum.
3. `backend/app/models/__init__.py`: Register new ORM models (`SalesTransaction`, `WasteLog`, `PredictionResult`).
4. `backend/app/__init__.py`: Register `ai_bp` blueprint into Flask app factory.
5. `docker-compose.yml`: Add FastAPI microservice container definition (optional/standalone setup).
6. `frontend/src/types/index.ts`: Add TypeScript definitions for AI predictions, demand forecast curves, risk scores, and reorder recommendations.
7. `frontend/src/services/api.ts` & `frontend/src/services/ai.ts`: Add API methods for AI endpoints.

---

## G. Data Flow Architecture

```
[Inventory Data] + [Historical Sales Logs] + [Waste Logs]
                      │
                      ▼
        ┌───────────────────────────┐
        │   Time-Series Cleaner     │
        │ (Resampling & Aggregation)│
        └─────────────┬─────────────┘
                      │
                      ▼
        ┌───────────────────────────┐
        │ Demand Forecasting Engine │
        │ (Prophet + LSTM Ensemble) │
        └─────────────┬─────────────┘
                      │
            ┌─────────┴─────────┐
            │ Predicted Demand  │
            └─────────┬─────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
        ▼                           ▼
┌─────────────────────────┐   ┌───────────────────────────┐
│  Waste Risk Scorer      │   │ Smart Reorder Calculator  │
│ - Days to Expiry        │   │ - Predicted Demand        │
│ - Stock Outflow Deficit │   │ - Safety Stock            │
│ Output: Low / Medium /  │   │ - Lead Time & Capacity    │
│         High / Critical │   │ Output: Reorder Quantity  │
└────────────┬────────────┘   └─────────────┬─────────────┘
             │                              │
             └──────────────┬───────────────┘
                            │
                            ▼
           ┌────────────────────────────────┐
           │ FastAPI REST Response / DB Log │
           └────────────────┬───────────────┘
                            │
                            ▼
           ┌────────────────────────────────┐
           │  Frontend SaaS AI Dashboard    │
           └────────────────────────────────┘
```

---

## H. Required API Endpoints

### 1. AI Real-Time & Batch Prediction Endpoints (FastAPI / Flask)
* `POST /api/ai/forecast`: Predicts daily/weekly demand for a product or category over N days.
* `POST /api/ai/risk-score`: Computes real-time waste risk score and level (`Low`, `Medium`, `High`, `Critical`) for a given inventory item.
* `GET /api/ai/reorder-recommendations`: Generates smart reorder quantity recommendations for low-stock and high-demand items.
* `POST /api/ai/batch-predict`: Executes scheduled background job to score all active inventory items and update prediction cache.
* `POST /api/ai/sales-log`: Ingests sales/consumption events to populate training time-series.

---

## I. Comprehensive Testing Plan

1. **Unit Testing**:
   * Data cleaning & resampling test suite (verify zero missing dates, correct daily aggregation).
   * Prophet & LSTM model inference test (verify input/output shape, positive forecast values).
   * Waste risk algorithm unit tests (verify edge cases: expired item = `Critical`/`Expired`, high stock + 2 days left = `High`/`Critical`).
   * Smart reorder formula unit tests (verify ROP calculation with varying lead times and safety margins).

2. **Integration Testing**:
   * Test end-to-end flow from Flask database fetch -> FastAPI AI computation -> JSON response rendering.
   * Verify response times (< 200ms for real-time scoring endpoints).

3. **Validation & Verification**:
   * Run full test suites (`pytest` backend, `vitest` frontend) to ensure 0 regressions on Weeks 1–2 features.

---
*Status: Plan Created. Ready for User Review and Approval.*
