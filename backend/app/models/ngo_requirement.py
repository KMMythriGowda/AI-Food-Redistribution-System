"""
NGO Requirements Database Model
"""
import uuid
from datetime import datetime
from app.extensions import db
from app.models.enums import InventoryCategory

class NgoRequirement(db.Model):
    __tablename__ = 'ngo_requirements'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    category = db.Column(db.Enum(InventoryCategory), nullable=False, default=InventoryCategory.OTHERS)
    quantity = db.Column(db.Float, nullable=False)
    unit = db.Column(db.String(50), nullable=False, default='units')
    urgency = db.Column(db.String(50), nullable=False, default='LOW')  # LOW, MEDIUM, HIGH, CRITICAL
    location = db.Column(db.String(500), nullable=False)
    dietary_requirement = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship back to User
    user = db.relationship('User', backref=db.backref('ngo_requirements', lazy=True, cascade='all, delete-orphan'))

    def to_dict(self):
        category_val = self.category.value if isinstance(self.category, InventoryCategory) else str(self.category)
        return {
            'id': self.id,
            'user_id': self.user_id,
            'category': category_val,
            'quantity': self.quantity,
            'unit': self.unit,
            'urgency': self.urgency,
            'location': self.location,
            'dietary_requirement': self.dietary_requirement,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
