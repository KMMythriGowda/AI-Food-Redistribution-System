import apiClient from './api';
import { ApiResponse } from '@/types';

// Extend types inline or import them if available. We will export clear TS interfaces for the frontend.
export interface SurplusListing {
  id: string;
  user_id: string;
  inventory_item_id?: string | null;
  product_name: string;
  category: string;
  listing_type: 'DONATION' | 'PAID_SURPLUS' | 'DISCOUNTED_SURPLUS';
  quantity_available: number;
  unit: string;
  price_per_unit: number;
  expiry_date: string;
  pickup_location: string;
  availability_window: string;
  description?: string;
  payment_required: boolean;
  status: 'AVAILABLE' | 'CLAIMED' | 'CANCELLED';
  created_at: string;
  updated_at: string;
  donor_name?: string;
  donor_type?: string;
  donor_verified?: boolean;
  distance_km?: number | null;
  donor_completed_donations?: number;
  smart_match_score?: number | null;
  smart_match_reasons?: string[];
}

export interface MarketplaceOrder {
  id: string;
  listing_id: string;
  recipient_id: string;
  business_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  platform_fee: number;
  total_amount: number;
  payment_required: boolean;
  payment_id?: string | null;
  payment_status: 'PENDING' | 'PAYMENT_INITIATED' | 'PAYMENT_SUCCESS' | 'PAYMENT_FAILED' | 'NOT_REQUIRED' | 'REFUNDED';
  order_status: 'PENDING' | 'ORDER_CONFIRMED' | 'PICKUP_SCHEDULED' | 'PICKED_UP' | 'COMPLETED' | 'CANCELLED';
  payment_method?: string | null;
  refund_status?: string | null;
  pickup_date?: string | null;
  pickup_location?: string | null;
  created_at: string;
  updated_at: string;
  product_name?: string;
  unit?: string;
  donor_name?: string;
  recipient_name?: string;
}

export interface DonorProfile {
  id: string;
  organization_name: string;
  business_type: string;
  address: string;
  phone: string;
  latitude?: number | null;
  longitude?: number | null;
  joined_date: string;
  is_verified: boolean;
  completed_donations: number;
  completed_surplus_transactions: number;
  total_units_redistributed: number;
  active_listings_count: number;
  trust_indicators: string[];
  history: Array<{
    product_name: string;
    category: string;
    quantity: number;
    unit: string;
    status: string;
    date: string;
  }>;
}

export interface BusinessStats {
  total_sales_revenue: number;
  successful_transactions: number;
  pending_transactions: number;
  failed_transactions: number;
  refunded_transactions: number;
  quantity_redistributed: number;
  completed_donations: number;
  completed_paid_sales: number;
  active_listings_count: number;
  completed_pickups: number;
  estimated_co2_savings: number;
  estimated_meals_redistributed: number;
  co2_per_unit_factor: number;
  meals_per_unit_factor: number;
}

export interface MarketplaceAnalytics {
  food_donated_quantity: number;
  food_sold_quantity: number;
  payment_revenue: number;
  completed_paid_transactions: number;
  average_transaction_value: number;
  total_volume_redistributed: number;
  estimated_co2_savings: number;
  estimated_meals_redistributed: number;
  co2_per_unit_factor: number;
  meals_per_unit_factor: number;
}

export interface NgoRequirement {
  id: string;
  user_id: string;
  category: string;
  quantity: number;
  unit: string;
  urgency: string;
  location: string;
  dietary_requirement?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface NgoImpact {
  completed_pickups: number;
  total_units_received: number;
  meals_supported: number;
  food_recovery_volume: number;
  estimated_co2_savings: number;
  meals_per_unit_factor: number;
  co2_per_unit_factor: number;
}

export const marketplaceService = {
  async createListing(data: any): Promise<ApiResponse<SurplusListing>> {
    const response = await apiClient.post<ApiResponse<SurplusListing>>('/marketplace/listings', data);
    return response.data;
  },

  async getListings(params?: any): Promise<ApiResponse<SurplusListing[]>> {
    const response = await apiClient.get<ApiResponse<SurplusListing[]>>('/marketplace/listings', { params });
    return response.data;
  },

  async getBusinessListings(): Promise<ApiResponse<SurplusListing[]>> {
    const response = await apiClient.get<ApiResponse<SurplusListing[]>>('/marketplace/listings/business');
    return response.data;
  },

  async initiateCheckout(data: { listing_id: string; quantity: number }): Promise<ApiResponse<MarketplaceOrder & { payment_details?: any }>> {
    const response = await apiClient.post<ApiResponse<MarketplaceOrder & { payment_details?: any }>>('/marketplace/orders/checkout', data);
    return response.data;
  },

  async verifyPayment(data: { order_id: string; success: boolean }): Promise<ApiResponse<MarketplaceOrder>> {
    const response = await apiClient.post<ApiResponse<MarketplaceOrder>>('/marketplace/orders/verify-payment', data);
    return response.data;
  },

  async getMyOrders(): Promise<ApiResponse<MarketplaceOrder[]>> {
    const response = await apiClient.get<ApiResponse<MarketplaceOrder[]>>('/marketplace/orders/my-orders');
    return response.data;
  },

  async schedulePickup(orderId: string, pickupDate: string): Promise<ApiResponse<MarketplaceOrder>> {
    const response = await apiClient.post<ApiResponse<MarketplaceOrder>>(`/marketplace/orders/${orderId}/schedule-pickup`, { pickup_date: pickupDate });
    return response.data;
  },

  async completePickup(orderId: string): Promise<ApiResponse<MarketplaceOrder>> {
    const response = await apiClient.post<ApiResponse<MarketplaceOrder>>(`/marketplace/orders/${orderId}/complete-pickup`);
    return response.data;
  },

  async cancelOrder(orderId: string): Promise<ApiResponse<MarketplaceOrder>> {
    const response = await apiClient.post<ApiResponse<MarketplaceOrder>>(`/marketplace/orders/${orderId}/cancel`);
    return response.data;
  },

  async getDonorProfile(businessId: string): Promise<ApiResponse<DonorProfile>> {
    const response = await apiClient.get<ApiResponse<DonorProfile>>(`/marketplace/donors/${businessId}`);
    return response.data;
  },

  async updateDonorProfile(data: any): Promise<ApiResponse<any>> {
    const response = await apiClient.put<ApiResponse<any>>('/marketplace/donors/profile', data);
    return response.data;
  },

  async getBusinessTransactions(): Promise<ApiResponse<MarketplaceOrder[]>> {
    const response = await apiClient.get<ApiResponse<MarketplaceOrder[]>>('/marketplace/business/transactions');
    return response.data;
  },

  async getBusinessStats(): Promise<ApiResponse<BusinessStats>> {
    const response = await apiClient.get<ApiResponse<BusinessStats>>('/marketplace/business/stats');
    return response.data;
  },

  async getMarketplaceAnalytics(): Promise<ApiResponse<MarketplaceAnalytics>> {
    const response = await apiClient.get<ApiResponse<MarketplaceAnalytics>>('/marketplace/analytics');
    return response.data;
  },

  async getRequirements(): Promise<ApiResponse<NgoRequirement[]>> {
    const response = await apiClient.get<ApiResponse<NgoRequirement[]>>('/marketplace/requirements');
    return response.data;
  },

  async createRequirement(data: any): Promise<ApiResponse<NgoRequirement>> {
    const response = await apiClient.post<ApiResponse<NgoRequirement>>('/marketplace/requirements', data);
    return response.data;
  },

  async deleteRequirement(id: string): Promise<ApiResponse<any>> {
    const response = await apiClient.delete<ApiResponse<any>>(`/marketplace/requirements/${id}`);
    return response.data;
  },

  async getRecommendations(): Promise<ApiResponse<SurplusListing[]>> {
    const response = await apiClient.get<ApiResponse<SurplusListing[]>>('/marketplace/recommendations');
    return response.data;
  },

  async getNotifications(): Promise<ApiResponse<Notification[]>> {
    const response = await apiClient.get<ApiResponse<Notification[]>>('/marketplace/notifications');
    return response.data;
  },

  async readAllNotifications(): Promise<ApiResponse<any>> {
    const response = await apiClient.post<ApiResponse<any>>('/marketplace/notifications/read');
    return response.data;
  },

  async getNgoImpact(): Promise<ApiResponse<NgoImpact>> {
    const response = await apiClient.get<ApiResponse<NgoImpact>>('/marketplace/ngo/impact');
    return response.data;
  }
};

export default marketplaceService;
