"""
PredictionResult SQLAlchemy Model
"""
import uuid
from datetime import datetime
from app.extensions import db

class PredictionResult(db.Model):
    __tablename__ = 'ai_predictions'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    inventory_item_id = db.Column(db.String(36), db.ForeignKey('inventory_items.id', ondelete='CASCADE'), nullable=False, index=True)
    product_name = db.Column(db.String(255), nullable=False, index=True)
    forecast_demand = db.Column(db.Float, nullable=False, default=0.0)
    forecast_period = db.Column(db.String(50), nullable=False, default='daily')  # daily, weekly, monthly
    days_to_expiry = db.Column(db.Integer, nullable=False, default=0)
    waste_risk_score = db.Column(db.Float, nullable=False, default=0.0)
    risk_level = db.Column(db.String(50), nullable=False, default='LOW')  # LOW, MEDIUM, HIGH, CRITICAL
    recommended_action = db.Column(db.String(255), nullable=False)
    recommended_reorder = db.Column(db.Float, nullable=False, default=0.0)
    model_name = db.Column(db.String(100), nullable=False, default='fallback_statistical')
    prediction_date = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    user = db.relationship('User', backref=db.backref('predictions', lazy=True, cascade='all, delete-orphan'))
    inventory_item = db.relationship('InventoryItem', backref=db.backref('predictions', lazy=True, cascade='all, delete-orphan'))

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'inventory_item_id': self.inventory_item_id,
            'product_name': self.product_name,
            'forecast_demand': self.forecast_demand,
            'forecast_period': self.forecast_period,
            'days_to_expiry': self.days_to_expiry,
            'waste_risk_score': self.waste_risk_score,
            'risk_level': self.risk_level,
            'recommended_action': self.recommended_action,
            'recommended_reorder': self.recommended_reorder,
            'model_name': self.model_name,
            'prediction_date': self.prediction_date.isoformat() if self.prediction_date else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
