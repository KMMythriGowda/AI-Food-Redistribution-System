"""
WasteLog SQLAlchemy Model
"""
import uuid
from datetime import datetime
from app.extensions import db
from app.models.enums import InventoryCategory

class WasteLog(db.Model):
    __tablename__ = 'waste_logs'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    product_name = db.Column(db.String(255), nullable=False, index=True)
    category = db.Column(db.Enum(InventoryCategory), nullable=False, default=InventoryCategory.OTHERS)
    quantity = db.Column(db.Float, nullable=False, default=0.0)
    waste_date = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
    reason = db.Column(db.String(255), nullable=True)
    cost_loss = db.Column(db.Float, nullable=False, default=0.0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    user = db.relationship('User', backref=db.backref('waste_logs', lazy=True, cascade='all, delete-orphan'))

    def to_dict(self):
        category_val = self.category.value if isinstance(self.category, InventoryCategory) else str(self.category)
        return {
            'id': self.id,
            'user_id': self.user_id,
            'product_name': self.product_name,
            'category': category_val,
            'quantity': self.quantity,
            'waste_date': self.waste_date.isoformat() if self.waste_date else None,
            'reason': self.reason,
            'cost_loss': self.cost_loss,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
