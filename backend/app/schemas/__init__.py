"""
Marshmallow Schemas Package
"""
from app.schemas.user_schema import user_schema, register_schema, login_schema
from app.schemas.inventory_schema import (
    inventory_item_schema,
    inventory_items_schema,
    inventory_create_schema,
    inventory_update_schema
)

__all__ = [
    'user_schema',
    'register_schema',
    'login_schema',
    'inventory_item_schema',
    'inventory_items_schema',
    'inventory_create_schema',
    'inventory_update_schema'
]

