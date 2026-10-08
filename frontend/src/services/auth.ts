import apiClient from './api';
import { ApiResponse, AuthResponseData, User } from '@/types';

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
  organization_name?: string;
  role: 'BUSINESS' | 'NGO';
  phone?: string;
  address?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export const authService = {
  register: async (payload: RegisterPayload): Promise<ApiResponse<AuthResponseData>> => {
    const response = await apiClient.post<ApiResponse<AuthResponseData>>('/auth/register', payload);
    return response.data;
  },

  login: async (payload: LoginPayload): Promise<ApiResponse<AuthResponseData>> => {
    const response = await apiClient.post<ApiResponse<AuthResponseData>>('/auth/login', payload);
    return response.data;
  },

  getCurrentUser: async (): Promise<ApiResponse<{ user: User }>> => {
    const response = await apiClient.get<ApiResponse<{ user: User }>>('/auth/me');
    return response.data;
  },

  logout: async (refreshToken?: string | null): Promise<ApiResponse> => {
    const response = await apiClient.post<ApiResponse>('/auth/logout', {
      refresh_token: refreshToken || undefined,
    });
    return response.data;
  },

  forgotPassword: async (email: string): Promise<ApiResponse<{ reset_token?: string; reset_url?: string; delivery?: string }>> => {
    const response = await apiClient.post<ApiResponse<{ reset_token?: string; reset_url?: string; delivery?: string }>>(
      '/auth/forgot-password',
      { email }
    );
    return response.data;
  },

  resetPassword: async (token: string, password: string): Promise<ApiResponse> => {
    const response = await apiClient.post<ApiResponse>('/auth/reset-password', { token, password });
    return response.data;
  },
};
