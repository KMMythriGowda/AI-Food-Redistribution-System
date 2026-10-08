"""
Marketplace Models (SurplusListing and MarketplaceOrder)
"""
import uuid
from datetime import datetime
from app.extensions import db
from app.models.enums import InventoryCategory

class SurplusListing(db.Model):
    __tablename__ = 'surplus_listings'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    inventory_item_id = db.Column(db.String(36), db.ForeignKey('inventory_items.id', ondelete='SET NULL'), nullable=True, index=True)
    product_name = db.Column(db.String(255), nullable=False, index=True)
    category = db.Column(db.Enum(InventoryCategory), nullable=False, default=InventoryCategory.OTHERS)
    listing_type = db.Column(db.String(50), nullable=False) # DONATION, PAID_SURPLUS, DISCOUNTED_SURPLUS
    quantity_available = db.Column(db.Float, nullable=False, default=0.0)
    unit = db.Column(db.String(50), nullable=False, default='units')
    price_per_unit = db.Column(db.Float, nullable=False, default=0.0)
    expiry_date = db.Column(db.Date, nullable=False, index=True)
    pickup_location = db.Column(db.String(500), nullable=False)
    availability_window = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    payment_required = db.Column(db.Boolean, default=False)
    status = db.Column(db.String(50), nullable=False, default='AVAILABLE') # AVAILABLE, CLAIMED, CANCELLED
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = db.relationship('User', backref=db.backref('surplus_listings', lazy=True, cascade='all, delete-orphan'))
    inventory_item = db.relationship('InventoryItem', backref=db.backref('surplus_listings', lazy=True))

    def to_dict(self):
        category_val = self.category.value if isinstance(self.category, InventoryCategory) else str(self.category)
        return {
            'id': self.id,
            'user_id': self.user_id,
            'inventory_item_id': self.inventory_item_id,
            'product_name': self.product_name,
            'category': category_val,
            'listing_type': self.listing_type,
            'quantity_available': self.quantity_available,
            'unit': self.unit,
            'price_per_unit': self.price_per_unit,
            'expiry_date': self.expiry_date.isoformat() if self.expiry_date else None,
            'pickup_location': self.pickup_location,
            'availability_window': self.availability_window,
            'description': self.description,
            'payment_required': self.payment_required,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

class MarketplaceOrder(db.Model):
    __tablename__ = 'marketplace_orders'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    listing_id = db.Column(db.String(36), db.ForeignKey('surplus_listings.id', ondelete='CASCADE'), nullable=False, index=True)
    recipient_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    business_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    quantity = db.Column(db.Float, nullable=False)
    unit_price = db.Column(db.Float, nullable=False)
    subtotal = db.Column(db.Float, nullable=False)
    platform_fee = db.Column(db.Float, nullable=False, default=0.0)
    total_amount = db.Column(db.Float, nullable=False)
    payment_required = db.Column(db.Boolean, default=False)
    payment_id = db.Column(db.String(100), nullable=True, unique=True, index=True) # Mock gateway tx ID
    payment_status = db.Column(db.String(50), nullable=False, default='PENDING') # PENDING, PAYMENT_INITIATED, PAYMENT_SUCCESS, PAYMENT_FAILED, NOT_REQUIRED, REFUNDED
    order_status = db.Column(db.String(50), nullable=False, default='PENDING') # PENDING, ORDER_CONFIRMED, PICKUP_SCHEDULED, PICKED_UP, COMPLETED, CANCELLED
    payment_method = db.Column(db.String(50), nullable=True) # SANDBOX, etc.
    refund_status = db.Column(db.String(50), nullable=True) # NONE, REQUESTED, REFUNDED
    pickup_date = db.Column(db.DateTime, nullable=True)
    pickup_location = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    listing = db.relationship('SurplusListing', backref=db.backref('orders', lazy=True, cascade='all, delete-orphan'))
    recipient = db.relationship('User', foreign_keys=[recipient_id], backref=db.backref('claims', lazy=True))
    business = db.relationship('User', foreign_keys=[business_id], backref=db.backref('sales', lazy=True))

    def to_dict(self):
        return {
            'id': self.id,
            'listing_id': self.listing_id,
            'recipient_id': self.recipient_id,
            'business_id': self.business_id,
            'quantity': self.quantity,
            'unit_price': self.unit_price,
            'subtotal': self.subtotal,
            'platform_fee': self.platform_fee,
            'total_amount': self.total_amount,
            'payment_required': self.payment_required,
            'payment_id': self.payment_id,
            'payment_status': self.payment_status,
            'order_status': self.order_status,
            'payment_method': self.payment_method,
            'refund_status': self.refund_status,
            'pickup_date': self.pickup_date.isoformat() if self.pickup_date else None,
            'pickup_location': self.pickup_location,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
