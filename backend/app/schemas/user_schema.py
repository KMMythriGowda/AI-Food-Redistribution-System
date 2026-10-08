"""User Marshmallow Schemas"""
from marshmallow import Schema, fields, validate
from app.models.enums import UserRole


class UserSchema(Schema):
    id = fields.Str(dump_only=True)
    email = fields.Email(required=True)
    full_name = fields.Str(required=True)
    organization_name = fields.Str(allow_none=True)
    role = fields.Str(dump_only=True)
    phone = fields.Str(allow_none=True)
    profile_image = fields.Str(allow_none=True)
    address = fields.Str(allow_none=True)
    latitude = fields.Float(allow_none=True)
    longitude = fields.Float(allow_none=True)
    is_verified = fields.Bool(dump_only=True)
    is_active = fields.Bool(dump_only=True)
    created_at = fields.Str(dump_only=True)
    updated_at = fields.Str(dump_only=True)


class UserRegisterSchema(Schema):
    email = fields.Email(required=True)
    password = fields.Str(required=True, validate=validate.Length(min=6))
    full_name = fields.Str(required=True, validate=validate.Length(min=2))
    organization_name = fields.Str(allow_none=True)
    # Public self-registration is intentionally limited to Business/NGO.
    role = fields.Str(
        validate=validate.OneOf([UserRole.BUSINESS.value, UserRole.NGO.value]),
        load_default=UserRole.BUSINESS.value,
    )
    phone = fields.Str(allow_none=True)
    address = fields.Str(allow_none=True)
    latitude = fields.Float(allow_none=True)
    longitude = fields.Float(allow_none=True)
    business_type = fields.Str(allow_none=True)


class UserLoginSchema(Schema):
    email = fields.Email(required=True)
    password = fields.Str(required=True)


user_schema = UserSchema()
register_schema = UserRegisterSchema()
login_schema = UserLoginSchema()
