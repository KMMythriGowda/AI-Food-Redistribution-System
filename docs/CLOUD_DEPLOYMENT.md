# Cloud Deployment Guide - AWS EC2

This guide outlines the exact steps to configure, build, and deploy the AI-Based Food Redistribution System in a production environment (such as an AWS EC2 instance).

---

## 🏗 Container Composition

The system utilizes a multi-container Docker Compose architecture:
1. **PostgreSQL**: Stores relational transactional and inventory records.
2. **Flask Backend**: Exposes REST endpoints on port `5000`.
3. **FastAPI AI Engine**: Handles forecasting/waste prediction on port `8000`.
4. **Nginx Frontend**: Bundles the production React build and acts as an entrypoint on port `80`.

---

## 🔑 Production Environment Configuration

Create a production `.env` file in the project root directory. Do **NOT** commit this file.

```env
# Database Persistence
DATABASE_URL=postgresql://postgres:YOUR_STRONG_PASSWORD_HERE@postgres:5432/food_redistribution_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=YOUR_STRONG_PASSWORD_HERE
POSTGRES_DB=food_redistribution_db

# Security Secrets (Generate random high-entropy strings)
SECRET_KEY=secure-random-high-entropy-flask-key-string
JWT_SECRET_KEY=secure-random-high-entropy-jwt-key-string

# API Routing Configurations
VITE_API_BASE_URL=http://YOUR_EC2_PUBLIC_IP/api
AI_SERVICE_URL=http://ai:8000
PORT=5000
FLASK_ENV=production
```

---

## 🚀 AWS EC2 Deployment Steps

### 1. Provision EC2 Instance
* Launch an EC2 Instance (Ubuntu Server 22.04 LTS recommended, `t3.medium` or higher instance type is ideal for hosting AI time-series packages).
* Configure the Security Group to allow incoming TCP traffic on:
  * Port `22` (SSH Access)
  * Port `80` (HTTP Web Access)
  * Port `443` (HTTPS Web Access, if SSL is set up)

### 2. Install Docker & Docker Compose
Connect to your EC2 instance via SSH and run:
```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose
sudo systemctl enable --now docker
```

### 3. Clone and Initialize Project
```bash
git clone https://github.com/AI-Food-Redistribution-System.git
cd AI-Food-Redistribution-System
```

### 4. Inject Environment Configuration
Create the `.env` file using the configuration schema listed in the *Production Environment Configuration* section.

### 5. Launch the Application Stack
Execute Docker Compose command to build and launch all containers in background daemon mode:
```bash
sudo docker-compose up --build -d
```

### 6. Verify Service Health
Verify that the services are online:
* **Frontend UI**: Browse to `http://<YOUR_EC2_PUBLIC_IP>/`
* **Backend API Health Check**: Run `curl http://localhost:5000/api/health`
* **FastAPI AI Engine Health Check**: Run `curl http://localhost:8000/api/ai/health`
