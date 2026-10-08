// Comprehensive Domain & Auth Type Definitions

export type UserRole = 'BUSINESS' | 'NGO' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  full_name: string;
  organization_name?: string;
  role: UserRole;
  phone?: string;
  profile_image?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  is_verified: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface AuthResponseData {
  user: User;
  access_token?: string | null;
  refresh_token?: string | null;
  requires_verification?: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  details?: any;
  pagination?: {
    total: number;
    page: number;
    per_page: number;
    pages: number;
  };
}

// --- Inventory & Expiry Tracking Types ---

export type InventoryCategory =
  | 'Fruits'
  | 'Vegetables'
  | 'Dairy'
  | 'Bakery'
  | 'Meat'
  | 'Seafood'
  | 'Grains'
  | 'Beverages'
  | 'Prepared Foods'
  | 'Frozen'
  | 'Canned'
  | 'Others';

export type StorageType = 'Ambient' | 'Refrigerated' | 'Frozen' | 'Cold Storage';

export type InventoryStatus = 'Fresh' | 'Expiring Soon' | 'Expired' | 'Low Stock' | 'Donated';

export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Expired';

export interface InventoryItem {
  id: string;
  user_id: string;
  product_name: string;
  category: InventoryCategory | string;
  description?: string | null;
  quantity: number;
  unit: string;
  purchase_date?: string | null;
  manufacturing_date?: string | null;
  expiry_date: string;
  storage_type: StorageType | string;
  storage_temperature?: number | null;
  supplier?: string | null;
  cost_price: number;
  selling_price: number;
  barcode?: string | null;
  qr_code?: string | null;
  product_image?: string | null;
  low_stock_threshold: number;
  status: InventoryStatus | string;
  days_remaining: number;
  risk_level: RiskLevel | string;
  risk_color: string;
  total_value: number;
  created_at: string;
  updated_at: string;
}

export interface InventoryCreateInput {
  product_name: string;
  category: string;
  description?: string;
  quantity: number;
  unit?: string;
  purchase_date?: string | null;
  manufacturing_date?: string | null;
  expiry_date: string;
  storage_type?: string;
  storage_temperature?: number | null;
  supplier?: string;
  cost_price?: number;
  selling_price?: number;
  barcode?: string;
  product_image?: string;
  low_stock_threshold?: number;
}

export interface InventoryUpdateInput extends Partial<InventoryCreateInput> {
  status?: string;
}

export interface InventoryListParams {
  search?: string;
  category?: string;
  status?: string;
  storage_type?: string;
  supplier?: string;
  sort_by?: string;
  order?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}

export interface ExpiryTimeline {
  today: number;
  tomorrow: number;
  next_7_days: number;
  next_30_days: number;
}

export interface InventoryDashboardStats {
  total_products: number;
  total_inventory_value: number;
  fresh_count: number;
  expiring_soon_count: number;
  expired_count: number;
  low_stock_count: number;
  todays_expiry_count: number;
  health_score: number;
  health_status: string;
  avg_shelf_life_days: number;
  category_distribution: Record<string, number>;
  storage_distribution: Record<string, number>;
  expiry_timeline: ExpiryTimeline;
  expiry_calendar: Record<string, number>;
  todays_alerts: InventoryItem[];
  recent_inventory: InventoryItem[];
}

export interface CsvFailedRow {
  row: number;
  product_name: string;
  errors: string[];
}

export interface CsvImportSummary {
  total_rows: number;
  imported_count: number;
  failed_count: number;
  failed_rows: CsvFailedRow[];
  successful_items: InventoryItem[];
}

