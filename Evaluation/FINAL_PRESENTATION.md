# Final Presentation - AI-Based Food Redistribution System

**Project Title**: AI-Based Food Redistribution System for Waste Reduction & Surplus Inventory Management
**Milestone**: Final Capstone Project (July 2026 - August 2026)

---

## Slide 1: Executive Summary & Objective
* **Problem**: 1.3 billion tons of food is wasted globally each year, causing significant economic loss and carbon emissions. Meanwhile, food insecurity affects millions.
* **Solution**: An intelligent multi-tenant platform bridging the gap between food donors (supermarkets, restaurants, wholesalers) and recipients (NGOs, shelter homes).
* **Key Innovation**: AI-driven inventory analytics, predictive demand forecasting, automated reordering thresholds, dynamic carbon-offset savings dashboard, and location-aware proximity matching.

---

## Slide 2: Platform Architecture & Tech Stack

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
   └────────────────────────────────────────────────────────┘
```

* **Frontend**: React (v18), Vite, TypeScript, Tailwind CSS, Recharts (visual trends), Leaflet (OpenStreetMap geo-tracking).
* **Backend**: Flask REST API, PostgreSQL, SQLAlchemy ORM, Flask-JWT-Extended (RBAC authentication).
* **AI Engine**: FastAPI predictive microservice running Facebook Prophet time-series models with statistical smoothing fallback algorithms.
* **Orchestration**: Docker & Docker Compose (multi-container isolation).

---

## Slide 3: Milestone Timeline & Accomplishments

### Weeks 1–2: Base Mechanics & Integrations
* User Account RBAC (Business Donor vs. NGO Recipient vs. Admin).
* Core Inventory Models & CSV Import/Export.
* **POS REST API Integration**: Endpoint enabling real-time external store registry sync with automatic item consolidation and duplicate handling.

### Weeks 3–4: AI & ML Engine
* Integrated the FastAPI Microservice.
* Implemented Time-Series Demand Forecasting and AI Waste Risk Scoring.
* **APScheduler Background Jobs**: Daily predictive model refreshing and auto-generation of persistent approaching/expired item notifications.

### Weeks 5–6: Proximity & Marketplace Claims
* Geo-location proximity calculations (Haversine formula).
* NGO claim scheduling with Sandbox Checkout simulation and verification.
* **Map Rendering**: Lightweight Leaflet marker mapping of surplus pickup points.

### Weeks 7–8: Validation & Hardening E2E
* **Stress/Load Testing**: Asynchronous concurrent client query simulation.
* **Cross-Browser Verification**: Playwright test suites executing layout compatibility checks.
* **Production Packaging**: Container integration mapping.

---

## Slide 4: Real-time Sustainability Analytics
* **Environmental Metrics**: Dynamic, transaction-driven calculation of:
  * **CO2 Equivalent Emissions Saved**: Based on weight coefficients of saved inventory (e.g., $2.5 \text{ kg } CO_2e / \text{ kg food}$).
  * **Meals Supported**: Standardized conversion of surplus weights into meal counts (e.g., $0.42 \text{ kg food} / \text{ meal}$).
* **Visualization**: Interactive Recharts trend charts reflecting cumulative impact metrics.

---

## Slide 5: QA Testing & Benchmarks

### Backend Test Coverage
* **70+ Integration Tests** validating auth tokens, RBAC permissions, bulk imports, checkout claims, reorder point suppressions, and POS sync.

### Load & Stress Test Results
* Simulated concurrent client workers.
* Average Response Time: $< 150 \text{ ms}$ under 20 RPS load.
* 95th Percentile Latency: $< 320 \text{ ms}$.
* Request success rate: $100\%$.

---

## Slide 6: Deployment & Future Roadmap
* **Deployment Target**: Production-ready configuration maps for AWS EC2 instance deployment.
* **Roadmap Goals**:
  * **Dynamic Logistics**: Integrating route optimization algorithms for volunteer delivery networks.
  * **Advanced NLP**: OCR scanning of printed invoices to parse expiry dates and product info.
  * **Multi-Store Aggregation**: Unified chain inventory dashboard for regional retail operators.
