# AI-Based Food Redistribution System for Waste Reduction and Surplus Inventory Management

[![Backend CI](https://img.shields.io/badge/Backend%20Tests-72%20Passed-emerald)](https://github.com/AI-Food-Redistribution-System)
[![Milestone 3](https://img.shields.io/badge/Milestone%203-36%2F36%20Passed-blue)](https://github.com/AI-Food-Redistribution-System)
[![Python](https://img.shields.io/badge/Python-3.11-blue)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-18-cyan)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110-teal)](https://fastapi.tiangolo.com/)

---

## 🌟 Overview & Vision

The **AI-Based Food Redistribution System** is an enterprise-grade full-stack SaaS platform bridging the gap between food donors (supermarkets, restaurants, wholesalers, hotels) and recipients (NGOs, shelter homes, community kitchens).

By integrating **Artificial Intelligence (Machine Learning Demand Forecasting, Dynamic Waste Risk Scoring, and Automated Reordering)**, **Real-Time Surplus Marketplace Mechanics**, **Geolocation-Aware Haversine Proximity Matching**, **Automated Expiry Alerts & POS Integration**, and **Interactive Carbon-Offset Sustainability Analytics**, the platform redirects surplus food to community relief and prevents landfill waste.

---

## 🏗 System Architecture

The project is structured as a scalable monorepo orchestrating four containerized services via Docker Compose:

```
                          ┌────────────────────────────────────────────────────────┐
                          │                       React UI                         │
                          │           (Vite + TypeScript + Tailwind CSS)           │
                          └──────────────────────────┬─────────────────────────────┘
                                                     │ HTTPS REST / JWT
                          ┌──────────────────────────▼─────────────────────────────┐
                          │                     Flask REST API                     │
                          │               (SQLAlchemy ORM + PostgreSQL)            │
                          └──────────────────────────┬─────────────────────────────┘
                                                     │ HTTP RPC JSON
                          ┌──────────────────────────▼─────────────────────────────┐
                          │                 FastAPI AI Microservice                │
                          │           (Prophet & Exponential Smoothing ML)         │
                          └──────────────────────────┬─────────────────────────────┘
                                                     │ SQL
                          ┌──────────────────────────▼─────────────────────────────┐
                          │                  PostgreSQL Database                   │
                          └────────────────────────────────────────────────────────┘
```

```
AI-Food-Redistribution-System/
├── backend/                    # Python Flask & FastAPI Architecture
│   ├── app/
│   │   ├── ai/                 # AI Engine: Prophet/LSTM Models, APScheduler Jobs, Feature Engineering
│   │   │   ├── algorithms/     # WasteRiskScorer composite logic
│   │   │   ├── data/           # Preprocessing & time-series transforms
│   │   │   ├── forecast/       # ProphetModelWrapper, LSTMModelWrapper, ModelService
│   │   │   ├── jobs/           # Scheduler: Daily/Weekly/Monthly prediction & alert jobs
│   │   │   ├── reorder/        # ReorderEngine & purchase suppression rules
│   │   │   └── main.py         # FastAPI microservice entrypoint (:8000)
│   │   ├── api/                # REST blueprints (auth, inventory, marketplace, ai, health)
│   │   ├── config/             # Environment configurations
│   │   ├── middleware/         # JWT auth middleware & RBAC guards
│   │   ├── models/             # SQLAlchemy ORM models (User, Inventory, Marketplace, NGO, Alerts)
│   │   ├── repositories/       # Multi-tenant data access layer
│   │   ├── schemas/            # Marshmallow serialization & validation schemas
│   │   ├── services/           # Core business logic (InventoryService, MarketplaceService, PaymentService)
│   │   └── __init__.py         # Flask Application Factory create_app()
│   ├── migrations/             # Alembic database migrations
│   ├── tests/                  # Pytest backend suite (72 automated integration & unit tests)
│   ├── Dockerfile              # Production Python container
│   ├── requirements.txt        # Backend dependencies
│   └── run.py                  # Flask entrypoint (:5000)
├── frontend/                   # React 18 + Vite + TypeScript + Tailwind CSS
│   ├── src/
│   │   ├── components/
│   │   │   ├── analytics/      # MarketplaceAnalyticsTab (Recharts sustainability metrics)
│   │   │   ├── donations/      # BusinessMarketplaceTab (Surplus listing management)
│   │   │   ├── inventory/      # AiWasteDashboard, Barcode Scanner/QR, Table/Grid views
│   │   │   └── maps/           # MapComponent (OpenStreetMap Leaflet geo-tracking)
│   │   ├── context/            # AuthContext (RBAC) & ThemeContext (Dark/Light)
│   │   ├── pages/
│   │   │   ├── auth/           # Login, Register, Forgot/Reset Password, Unauthorized
│   │   │   └── dashboard/      # BusinessDashboardShell (6 tabs) & NgoDashboardShell (5 tabs)
│   │   ├── services/           # Axios API services (auth, inventory, marketplace, ai)
│   │   └── routes/             # ProtectedRoute role-based routing
│   ├── tests/                  # Vitest unit test suite
│   ├── Dockerfile              # Production Nginx container
│   └── package.json
├── docs/                       # Architecture specifications & Cloud deployment manuals
├── Evaluation/                 # Final Presentation outlines & demo records
├── docker-compose.yml          # Container orchestration (Frontend, Backend, AI, Postgres)
└── README.md
```

---

## 🚀 Key Modules & Implemented Features

### 📦 Weeks 1–2: Inventory Management & Expiry Tracking
- **Multi-Channel Inventory Ingestion**:
  - **Manual Entry**: Full validation for batch quantities, unit measures, purchase/manufacturing/expiry dates.
  - **CSV Bulk Import/Export**: Upload large SKU catalogs via CSV with field parsing and error reporting.
  - **POS REST API Integration**: Dedicated `/api/inventory/pos-sync` endpoint for external point-of-sale systems with automatic item consolidation and duplicate prevention.
- **Intelligent Expiry Tracking**:
  - Dynamic `days_remaining` calculation and `risk_level` classification (`FRESH`, `APPROACHING_EXPIRY`, `EXPIRED`).
  - Configurable alert threshold (`EXPIRY_ALERT_THRESHOLD_DAYS`).
  - Automated background daily alerts generating persistent in-app notifications.
  - Expired item protection preventing expired food from entering distribution feeds.
- **Product Classification & Perishability**:
  - 12 standard food categories (Fruits, Vegetables, Dairy, Bakery, Meat, Seafood, Grains, etc.).
  - Storage requirements tracking (Ambient, Refrigerated, Frozen, Dry Storage with temperature thresholds).
- **Barcode & QR Validation**:
  - Camera-based barcode scanner integration (`html5-qrcode`) and printable QR code generation.
  - Responsive table and mobile-friendly card views.
- **Multi-Tenant Data Isolation**:
  - Strict tenant isolation enforced at repository level using JWT tokens.
  - Role-Based Access Control (`ADMIN`, `BUSINESS`, `NGO`).

### 🤖 Weeks 3–4: AI-Based Waste Prediction & Smart Reordering
- **Historical Data Pipelines**:
  - Automated ingestion of historical sales, purchase batches, and waste records with time-series feature engineering.
- **Multi-Model Demand Forecasting**:
  - **Prophet Model**: Time-series trend and seasonality forecasting.
  - **LSTM Neural Network & Statistical Fallback**: Seamless fallback to double exponential smoothing for zero-dependency high-speed predictions.
  - Prediction horizons: 14-day daily forecast and 8-week weekly forecast.
- **Composite Waste-Risk Scorer**:
  - Evaluates remaining shelf-life, current inventory quantity, and forecasted consumption to produce a composite risk score (0–100) and actionable categories (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
- **Smart Reorder Recommendation Engine**:
  - Calculates Reorder Points (ROP) and safety stock requirements.
  - **Risk-Based Purchase Suppression**: Automatically suppresses reorders on items flagged with high or critical waste risk to eliminate surplus buildup.
- **FastAPI AI Microservice**:
  - Independent microservice running on port `8000`.
  - APScheduler automated daily, weekly, and monthly background batch prediction runs.
  - Flask backend reverse proxy routing (`/api/ai/*`).

### 🤝 Weeks 5–6: Surplus Redistribution Marketplace & Sustainability Analytics
- **Surplus Food Listing Portal**:
  - Food businesses can list excess stock as **Free Donations** (price = ₹0) or **Paid Surplus** (discounted rate).
  - Validation guarantees listings do not exceed available physical inventory.
- **NGO Requirements & Smart Proximity Matching**:
  - NGOs can post specific food needs with required quantities, urgency levels (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), location, and dietary constraints.
  - **4-Factor AI Matching Algorithm**:
    $$\text{Score} = (0.35 \times \text{Category}) + (0.25 \times \text{Quantity}) + (0.20 \times \text{Haversine Proximity}) + (0.20 \times \text{Urgency/Expiry})$$
  - Generates clear, human-readable match explanations.
- **Pickup Scheduling & In-App Alerts**:
  - Flexible pickup window coordination with secure 6-character verification codes.
  - Real-time in-app notifications generated for order creation, pickup scheduling, and pickup completion.
- **Role-Dedicated React Dashboards**:
  - **Business Dashboard (6 Tabs)**: Overview, Inventory, AI Predictions & Waste Risks, Surplus Listings, Transactions & History, Settings.
  - **NGO Dashboard (5 Tabs)**: Marketplace Feed, Post Requirements, AI Smart Matches, Orders & Claims, Pickups Coordination with OpenStreetMap Leaflet pins, Impact Analytics.
- **Real-Time Sustainability Analytics**:
  - **CO2 Equivalent Emissions Avoided**: Calculated at $2.5\text{ kg } CO_2e / \text{ kg food diverted}$.
  - **Meals Supported**: Standardized conversion at $0.42\text{ kg food} / \text{ meal}$.
  - Interactive Recharts visualization diagrams for category breakdowns and monthly impact milestones.
- **Simulated Checkout & Payment Gateway**:
  - Zero-cost claim flow for free donations.
  - Sandbox payment gateway simulation and verification for paid surplus transactions.

---

## ⚡ Technology Stack

### Frontend Stack
- **Framework**: React 18, TypeScript, Vite
- **Styling & UI**: Tailwind CSS, PostCSS, Autoprefixer, `shadcn/ui` base utilities (`clsx`, `tailwind-merge`, `cva`, `tailwindcss-animate`)
- **Icons & Animations**: `lucide-react`, `framer-motion`
- **Routing & State**: `react-router-dom`, `@tanstack/react-query`
- **Forms & Validation**: `react-hook-form`, `zod`, `@hookform/resolvers`
- **HTTP Client**: Axios (`axios`) with JWT interceptors
- **Visualizations**: `recharts`
- **Maps & Scanning**: `leaflet`, `react-leaflet`, `html5-qrcode`
- **Notifications**: `react-hot-toast`
- **Unit Testing**: Vitest, JSDOM

### Backend & AI Stack
- **Framework**: Python 3.11, Flask (Application Factory pattern), FastAPI (AI Microservice)
- **Database & ORM**: PostgreSQL, `Flask-SQLAlchemy`, `Flask-Migrate`, Alembic
- **Authentication**: `Flask-JWT-Extended` (RBAC)
- **Serialization**: `Marshmallow`, `flask-marshmallow`, `marshmallow-sqlalchemy`
- **AI & Data Science**: `pandas`, `numpy`, `scikit-learn`, `prophet`, `APScheduler`
- **Containerization**: Docker, Docker Compose, Gunicorn, Uvicorn, Nginx
- **Testing**: Pytest, Httpx

---

## 🧪 Automated Testing & Verification

The test suite contains **72 automated tests** with **100% pass rate**:

```bash
============================= test session starts =============================
platform win32 -- Python 3.11.4, pytest-9.1.1
collected 72 items

tests/test_ai_algorithms.py ........                                     [ 11%]
tests/test_ai_endpoints.py ......                                        [ 19%]
tests/test_ai_jobs.py ...                                                [ 23%]
tests/test_ai_preprocessing.py ....                                      [ 29%]
tests/test_auth.py ......                                                [ 37%]
tests/test_health.py .                                                   [ 38%]
tests/test_inventory.py ............                                     [ 55%]
tests/test_marketplace.py ....................................           [100%]

====================== 72 passed, 148 warnings in 11.14s ======================
```

### Test Coverage Summary:
- **Marketplace & Claims (Milestone 3)**: **36 / 36 PASSED** (`TC-01` to `TC-36` in `test_marketplace.py`)
  - Validates authentication, RBAC isolation, free & paid listings, excess stock checks, NGO filters, donor transparency, smart matching scoring, checkout calculations, sandbox payments, pickup scheduling, pickup completion, notifications, analytics, and stock synchronization.
- **Inventory & POS Integration**: **12 / 12 PASSED** (`test_inventory.py`)
  - Validates manual CRUD, CSV import/export, POS REST sync (`/api/inventory/pos-sync`), duplicate handling, payload validation, and daily automated expiry alerts.
- **AI Waste Prediction & Algorithms**: **8 / 8 PASSED** (`test_ai_algorithms.py`)
  - Validates composite waste-risk weights, ROP calculations, and reorder purchase suppression under high risk.
- **FastAPI Inference Endpoints**: **6 / 6 PASSED** (`test_ai_endpoints.py`)
- **Authentication & RBAC**: **6 / 6 PASSED** (`test_auth.py`)
- **Feature Engineering & Preprocessing**: **4 / 4 PASSED** (`test_ai_preprocessing.py`)
- **Scheduled Background Jobs**: **3 / 3 PASSED** (`test_ai_jobs.py`)
- **Health Check**: **1 / 1 PASSED** (`test_health.py`)

---

## 🚀 Quick Start & Installation

### Option 1: Docker Compose (Recommended)

To launch all four containers (Frontend, Backend, AI Engine, PostgreSQL):

```bash
# 1. Clone repository
git clone https://github.com/AI-Food-Redistribution-System.git
cd AI-Food-Redistribution-System

# 2. Configure environment
cp .env.example .env

# 3. Build and launch services
docker-compose up --build
```

- **Frontend Application**: `http://localhost:80`
- **Backend Flask API**: `http://localhost:5000/api/health`
- **FastAPI AI Microservice**: `http://localhost:8000/api/ai/health`
- **PostgreSQL Database**: `localhost:5432`

---

### Option 2: Local Development Setup

#### 1. Backend & AI Setup
```bash
cd backend

# Create & activate virtual environment
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run Flask Backend (:5000)
python run.py

# (In a separate terminal) Run FastAPI AI Microservice (:8000)
uvicorn app.ai.main:app --port 8000 --reload
```

#### 2. Frontend Setup
```bash
cd frontend

# Install Node dependencies
npm install

# Run Vite dev server (:3000)
npm run dev
```

#### 3. Running Automated Tests
```bash
# Run all Backend Pytest Suites (72 tests)
cd backend
venv\Scripts\python -m pytest -v

# Run Frontend Vitest Suites
cd frontend
npm run test

# Run Frontend Build Check
cd frontend
npm run build
```

---

## 🔑 Environment Variables Configuration

Copy `.env.example` to `.env` in the root, `frontend/`, and `backend/` directories.

| Variable | Description | Default Value |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/food_redistribution_db` |
| `SECRET_KEY` | Flask session secret key | `dev-secret-key-change-in-production-12345` |
| `JWT_SECRET_KEY` | JWT token secret key | `dev-jwt-secret-key-change-in-production-67890` |
| `AI_SERVICE_URL` | Internal FastAPI service endpoint | `http://ai:8000` (or `http://localhost:8000`) |
| `VITE_API_BASE_URL` | Frontend API client base URL | `http://localhost:5000/api` |
| `EXPIRY_ALERT_THRESHOLD_DAYS` | Configurable days-to-expiry threshold | `3` |

---

## 🗺 Project Roadmap

- [x] **Phase 1: Project Setup & Architecture Initialization**
- [x] **Phase 2: Database Schema, Authentication & User RBAC Roles**
- [x] **Phase 3: Inventory Management, POS Sync & Expiry Alerts Engine**
- [x] **Phase 4: AI Waste Prediction, Demand Forecasting & Reorder Engine**
- [x] **Phase 5: NGO Surplus Marketplace, AI Smart Matching & Claim System**
- [x] **Phase 6: Pickup Scheduling, Leaflet Geolocation & Sustainability Analytics**
- [x] **Phase 7: End-to-End Testing (72 Tests Passed) & Container Packaging**
