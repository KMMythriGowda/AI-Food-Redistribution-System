"""
System User Role Enums
"""
import enum

class UserRole(str, enum.Enum):
    BUSINESS = "BUSINESS"
    NGO = "NGO"
    ADMIN = "ADMIN"

class InventoryCategory(str, enum.Enum):
    FRUITS = "Fruits"
    VEGETABLES = "Vegetables"
    DAIRY = "Dairy"
    BAKERY = "Bakery"
    BEVERAGES = "Beverages"
    FROZEN_FOODS = "Frozen Foods"
    GRAINS = "Grains"
    MEAT = "Meat"
    SEAFOOD = "Seafood"
    READY_TO_EAT = "Ready To Eat"
    OTHERS = "Others"

class InventoryStatus(str, enum.Enum):
    FRESH = "Fresh"
    LOW_STOCK = "Low Stock"
    EXPIRING_SOON = "Expiring Soon"
    EXPIRED = "Expired"
    DONATED = "Donated"

class RiskLevel(str, enum.Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"
    EXPIRED = "Expired"

class StorageType(str, enum.Enum):
    AMBIENT = "Ambient"
    REFRIGERATED = "Refrigerated"
    FROZEN = "Frozen"
    DRY_STORAGE = "Dry Storage"

