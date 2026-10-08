"""
Tests for Daily, Weekly, Monthly AI Jobs
"""
import pytest
from datetime import date, timedelta
from app import create_app
from app.extensions import db
from app.models.user import User
from app.models.enums import UserRole, InventoryCategory, StorageType, InventoryStatus
from app.models.inventory import InventoryItem
from app.models.job_log import JobLog
from app.models.prediction import PredictionResult
from app.ai.jobs.scheduler import run_daily_prediction_job, run_weekly_prediction_job, run_monthly_prediction_job

@pytest.fixture
def test_client():
    app = create_app('testing')
    with app.app_context():
        db.create_all()
        
        # Seed test user
        user = User(
            email='test@freshmart.com',
            full_name='Test Mart',
            organization_name='Test Mart Outlets',
            role=UserRole.BUSINESS,
            phone='+199999999',
            is_verified=True,
            is_active=True
        )
        user.set_password('TestPass123!')
        db.session.add(user)
        db.session.commit()

        # Seed test item
        item = InventoryItem(
            user_id=user.id,
            product_name='Fresh Strawberries',
            category=InventoryCategory.FRUITS,
            quantity=50.0,
            unit='boxes',
            purchase_date=date.today() - timedelta(days=2),
            expiry_date=date.today() + timedelta(days=2),  # Expiring soon
            storage_type=StorageType.REFRIGERATED,
            cost_price=2.00,
            selling_price=3.99,
            lead_time_days=3,
            safety_stock=5.0,
            storage_capacity=100.0,
            status=InventoryStatus.FRESH
        )
        db.session.add(item)
        db.session.commit()

        yield app

def test_daily_prediction_job(test_client):
    with test_client.app_context():
        # Assert database has 1 item
        assert InventoryItem.query.count() == 1
        
        # Run daily job
        run_daily_prediction_job()
        
        # Verify JobLog created
        job_log = JobLog.query.filter_by(job_name='daily_prediction_job').first()
        assert job_log is not None
        assert job_log.status in ["COMPLETED", "PARTIAL"]
        assert job_log.products_processed == 1

        # Verify PredictionResult stored
        pred = PredictionResult.query.filter_by(product_name='Fresh Strawberries').first()
        assert pred is not None
        assert pred.forecast_period == 'daily'
        assert pred.risk_level == 'CRITICAL'  # 2 days to expiry

def test_weekly_prediction_job(test_client):
    with test_client.app_context():
        run_weekly_prediction_job()
        
        job_log = JobLog.query.filter_by(job_name='weekly_prediction_job').first()
        assert job_log is not None
        assert job_log.status in ["COMPLETED", "PARTIAL"]
        
        pred = PredictionResult.query.filter_by(forecast_period='weekly').first()
        assert pred is not None
