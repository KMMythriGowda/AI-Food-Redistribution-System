"""
InventoryItem SQLAlchemy Model
"""
import uuid
from datetime import datetime, date
from app.extensions import db
from app.models.enums import InventoryCategory, InventoryStatus, RiskLevel, StorageType

class InventoryItem(db.Model):
    __tablename__ = 'inventory_items'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    product_name = db.Column(db.String(255), nullable=False, index=True)
    category = db.Column(db.Enum(InventoryCategory), nullable=False, default=InventoryCategory.OTHERS)
    description = db.Column(db.Text, nullable=True)
    quantity = db.Column(db.Float, nullable=False, default=0.0)
    unit = db.Column(db.String(50), nullable=False, default='units')
    purchase_date = db.Column(db.Date, nullable=True)
    manufacturing_date = db.Column(db.Date, nullable=True)
    expiry_date = db.Column(db.Date, nullable=False, index=True)
    storage_type = db.Column(db.Enum(StorageType), nullable=False, default=StorageType.AMBIENT)
    storage_temperature = db.Column(db.Float, nullable=True)
    supplier = db.Column(db.String(255), nullable=True)
    cost_price = db.Column(db.Float, nullable=False, default=0.0)
    selling_price = db.Column(db.Float, nullable=False, default=0.0)
    barcode = db.Column(db.String(100), nullable=True, index=True)
    qr_code = db.Column(db.Text, nullable=True)
    product_image = db.Column(db.String(500), nullable=True)
    low_stock_threshold = db.Column(db.Float, nullable=False, default=5.0)
    lead_time_days = db.Column(db.Integer, nullable=False, default=3)
    safety_stock = db.Column(db.Float, nullable=False, default=5.0)
    storage_capacity = db.Column(db.Float, nullable=False, default=100.0)
    status = db.Column(db.Enum(InventoryStatus), nullable=False, default=InventoryStatus.FRESH)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship back to User
    user = db.relationship('User', backref=db.backref('inventory_items', lazy=True, cascade='all, delete-orphan'))

    @property
    def days_remaining(self) -> int:
        """Calculates days remaining until expiry."""
        if not self.expiry_date:
            return 0
        today = date.today()
        exp = self.expiry_date if isinstance(self.expiry_date, date) else self.expiry_date.date()
        return (exp - today).days

    @property
    def risk_level(self) -> str:
        """Calculates risk level based on days remaining."""
        days = self.days_remaining
        if days < 0:
            return RiskLevel.EXPIRED.value
        elif days <= 3:
            return RiskLevel.HIGH.value
        elif days <= 7:
            return RiskLevel.MEDIUM.value
        else:
            return RiskLevel.LOW.value

    @property
    def risk_color(self) -> str:
        """Returns visual hex/theme color associated with risk level."""
        risk = self.risk_level
        if risk == RiskLevel.EXPIRED.value:
            return "#EF4444"  # Red
        elif risk == RiskLevel.HIGH.value:
            return "#F97316"  # Orange
        elif risk == RiskLevel.MEDIUM.value:
            return "#F59E0B"  # Yellow
        else:
            return "#10B981"  # Green

    @property
    def computed_status(self) -> str:
        """Dynamically evaluates current status based on quantity, dates, and manually assigned status."""
        manual_status = self.status.value if isinstance(self.status, InventoryStatus) else str(self.status)
        if manual_status == InventoryStatus.DONATED.value:
            return InventoryStatus.DONATED.value

        days = self.days_remaining
        if days < 0:
            return InventoryStatus.EXPIRED.value
        elif days <= 3:
            return InventoryStatus.EXPIRING_SOON.value
        elif self.quantity <= self.low_stock_threshold:
            return InventoryStatus.LOW_STOCK.value
        else:
            return InventoryStatus.FRESH.value

    def to_dict(self):
        """Serializes inventory item dictionary."""
        category_val = self.category.value if isinstance(self.category, InventoryCategory) else str(self.category)
        storage_val = self.storage_type.value if isinstance(self.storage_type, StorageType) else str(self.storage_type)

        return {
            'id': self.id,
            'user_id': self.user_id,
            'product_name': self.product_name,
            'category': category_val,
            'description': self.description,
            'quantity': self.quantity,
            'unit': self.unit,
            'purchase_date': self.purchase_date.isoformat() if self.purchase_date else None,
            'manufacturing_date': self.manufacturing_date.isoformat() if self.manufacturing_date else None,
            'expiry_date': self.expiry_date.isoformat() if self.expiry_date else None,
            'storage_type': storage_val,
            'storage_temperature': self.storage_temperature,
            'supplier': self.supplier,
            'cost_price': self.cost_price,
            'selling_price': self.selling_price,
            'barcode': self.barcode,
            'qr_code': self.qr_code or f"INV-{self.id[:8].upper()}",
            'product_image': self.product_image,
            'low_stock_threshold': self.low_stock_threshold,
            'lead_time_days': self.lead_time_days,
            'safety_stock': self.safety_stock,
            'storage_capacity': self.storage_capacity,
            'status': self.computed_status,
            'days_remaining': self.days_remaining,
            'risk_level': self.risk_level,
            'risk_color': self.risk_color,
            'total_value': round(self.quantity * self.selling_price, 2),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
