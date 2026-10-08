"""Persistent JWT revocation model."""
import uuid
from datetime import datetime
from app.extensions import db


class RevokedToken(db.Model):
    __tablename__ = 'revoked_tokens'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    jti = db.Column(db.String(64), unique=True, nullable=False, index=True)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=True, index=True)
    token_type = db.Column(db.String(20), nullable=False, default='access')
    expires_at = db.Column(db.DateTime, nullable=True, index=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    @classmethod
    def revoke_payload(cls, payload: dict):
        """Persist a JWT payload's JTI so it cannot be reused."""
        jti = payload.get('jti')
        if not jti or cls.query.filter_by(jti=jti).first():
            return
        exp = payload.get('exp')
        expires_at = datetime.utcfromtimestamp(exp) if exp else None
        db.session.add(cls(
            jti=jti,
            user_id=str(payload.get('sub')) if payload.get('sub') is not None else None,
            token_type=payload.get('type', 'access'),
            expires_at=expires_at,
        ))
        db.session.commit()
