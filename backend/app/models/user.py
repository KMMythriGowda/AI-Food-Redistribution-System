"""
User SQLAlchemy Database Model
"""
import uuid
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from app.extensions import db
from app.models.enums import UserRole

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(255), nullable=False)
    organization_name = db.Column(db.String(255), nullable=True)
    role = db.Column(db.Enum(UserRole), nullable=False, default=UserRole.BUSINESS)
    business_type = db.Column(db.String(100), nullable=True, default="Other")
    phone = db.Column(db.String(50), nullable=True)
    profile_image = db.Column(db.String(500), nullable=True)
    address = db.Column(db.String(500), nullable=True)
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    is_verified = db.Column(db.Boolean, default=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def set_password(self, password: str):
        """Hashes and sets user password."""
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        """Verifies provided password against stored hash."""
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        """Serializes public user dictionary."""
        return {
            'id': self.id,
            'email': self.email,
            'full_name': self.full_name,
            'organization_name': self.organization_name,
            'role': self.role.value if isinstance(self.role, UserRole) else self.role,
            'business_type': self.business_type,
            'phone': self.phone,
            'profile_image': self.profile_image,
            'address': self.address,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'is_verified': self.is_verified,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
