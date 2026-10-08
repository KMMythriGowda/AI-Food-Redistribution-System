import apiClient from './api';
import { ApiResponse, User } from '@/types';

export interface AdminStats {
  total_users: number;
  businesses: number;
  ngos: number;
  pending_ngos: number;
  active_listings: number;
  total_orders: number;
}

export const adminService = {
  async getStats(): Promise<ApiResponse<AdminStats>> {
    const response = await apiClient.get<ApiResponse<AdminStats>>('/admin/stats');
    return response.data;
  },

  async getUsers(params?: { search?: string; role?: string; verification?: string }): Promise<ApiResponse<User[]>> {
    const response = await apiClient.get<ApiResponse<User[]>>('/admin/users', { params });
    return response.data;
  },

  async setNgoVerification(userId: string, verified: boolean): Promise<ApiResponse<User>> {
    const response = await apiClient.post<ApiResponse<User>>(`/admin/users/${userId}/verify`, { verified });
    return response.data;
  },

  async setUserStatus(userId: string, active: boolean): Promise<ApiResponse<User>> {
    const response = await apiClient.post<ApiResponse<User>>(`/admin/users/${userId}/status`, { active });
    return response.data;
  },
};
