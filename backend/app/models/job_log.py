"""
JobLog SQLAlchemy Model
"""
import uuid
from datetime import datetime
from app.extensions import db

class JobLog(db.Model):
    __tablename__ = 'job_logs'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    job_name = db.Column(db.String(100), nullable=False, index=True)  # daily_prediction_job, etc.
    status = db.Column(db.String(50), nullable=False, default='STARTED')  # STARTED, COMPLETED, PARTIAL, FAILED
    start_time = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    end_time = db.Column(db.DateTime, nullable=True)
    products_processed = db.Column(db.Integer, nullable=False, default=0)
    products_failed = db.Column(db.Integer, nullable=False, default=0)
    critical_products = db.Column(db.Integer, nullable=True, default=0)
    error_message = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'job_name': self.job_name,
            'status': self.status,
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'products_processed': self.products_processed,
            'products_failed': self.products_failed,
            'critical_products': self.critical_products,
            'error_message': self.error_message,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
