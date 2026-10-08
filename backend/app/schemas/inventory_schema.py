"""
Inventory Marshmallow Schemas
"""
from marshmallow import Schema, fields, validate
from app.models.enums import InventoryCategory, InventoryStatus, StorageType

category_values = [c.value for c in InventoryCategory]
status_values = [s.value for s in InventoryStatus]
storage_values = [st.value for st in StorageType]

class InventoryItemSchema(Schema):
    id = fields.Str(dump_only=True)
    user_id = fields.Str(dump_only=True)
    product_name = fields.Str(required=True, validate=validate.Length(min=1, max=255))
    category = fields.Str(required=True, validate=validate.OneOf(category_values))
    description = fields.Str(allow_none=True)
    quantity = fields.Float(required=True, validate=validate.Range(min=0))
    unit = fields.Str(required=True, validate=validate.Length(min=1, max=50))
    purchase_date = fields.Date(allow_none=True)
    manufacturing_date = fields.Date(allow_none=True)
    expiry_date = fields.Date(required=True)
    storage_type = fields.Str(validate=validate.OneOf(storage_values), load_default=StorageType.AMBIENT.value)
    storage_temperature = fields.Float(allow_none=True)
    supplier = fields.Str(allow_none=True)
    cost_price = fields.Float(load_default=0.0, validate=validate.Range(min=0))
    selling_price = fields.Float(load_default=0.0, validate=validate.Range(min=0))
    barcode = fields.Str(allow_none=True)
    qr_code = fields.Str(allow_none=True)
    product_image = fields.Str(allow_none=True)
    low_stock_threshold = fields.Float(load_default=5.0, validate=validate.Range(min=0))
    status = fields.Str(validate=validate.OneOf(status_values), load_default=InventoryStatus.FRESH.value)
    days_remaining = fields.Int(dump_only=True)
    risk_level = fields.Str(dump_only=True)
    risk_color = fields.Str(dump_only=True)
    total_value = fields.Float(dump_only=True)
    created_at = fields.Str(dump_only=True)
    updated_at = fields.Str(dump_only=True)

class InventoryCreateSchema(Schema):
    product_name = fields.Str(required=True, validate=validate.Length(min=1, max=255))
    category = fields.Str(required=True, validate=validate.OneOf(category_values))
    description = fields.Str(allow_none=True)
    quantity = fields.Float(required=True, validate=validate.Range(min=0))
    unit = fields.Str(load_default='units', validate=validate.Length(min=1, max=50))
    purchase_date = fields.Date(allow_none=True)
    manufacturing_date = fields.Date(allow_none=True)
    expiry_date = fields.Date(required=True)
    storage_type = fields.Str(validate=validate.OneOf(storage_values), load_default=StorageType.AMBIENT.value)
    storage_temperature = fields.Float(allow_none=True)
    supplier = fields.Str(allow_none=True)
    cost_price = fields.Float(load_default=0.0, validate=validate.Range(min=0))
    selling_price = fields.Float(load_default=0.0, validate=validate.Range(min=0))
    barcode = fields.Str(allow_none=True)
    qr_code = fields.Str(allow_none=True)
    product_image = fields.Str(allow_none=True)
    low_stock_threshold = fields.Float(load_default=5.0, validate=validate.Range(min=0))
    status = fields.Str(validate=validate.OneOf(status_values), load_default=InventoryStatus.FRESH.value)

class InventoryUpdateSchema(Schema):
    product_name = fields.Str(validate=validate.Length(min=1, max=255))
    category = fields.Str(validate=validate.OneOf(category_values))
    description = fields.Str(allow_none=True)
    quantity = fields.Float(validate=validate.Range(min=0))
    unit = fields.Str(validate=validate.Length(min=1, max=50))
    purchase_date = fields.Date(allow_none=True)
    manufacturing_date = fields.Date(allow_none=True)
    expiry_date = fields.Date()
    storage_type = fields.Str(validate=validate.OneOf(storage_values))
    storage_temperature = fields.Float(allow_none=True)
    supplier = fields.Str(allow_none=True)
    cost_price = fields.Float(validate=validate.Range(min=0))
    selling_price = fields.Float(validate=validate.Range(min=0))
    barcode = fields.Str(allow_none=True)
    qr_code = fields.Str(allow_none=True)
    product_image = fields.Str(allow_none=True)
    low_stock_threshold = fields.Float(validate=validate.Range(min=0))
    status = fields.Str(validate=validate.OneOf(status_values))

inventory_item_schema = InventoryItemSchema()
inventory_items_schema = InventoryItemSchema(many=True)
inventory_create_schema = InventoryCreateSchema()
inventory_update_schema = InventoryUpdateSchema()
