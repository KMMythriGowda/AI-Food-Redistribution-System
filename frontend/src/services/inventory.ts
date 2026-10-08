import apiClient from './api';
import {
  ApiResponse,
  InventoryItem,
  InventoryCreateInput,
  InventoryUpdateInput,
  InventoryListParams,
  InventoryDashboardStats,
  CsvImportSummary,
} from '@/types';

export const inventoryService = {
  /**
   * Fetches paginated, filtered, and sorted inventory list.
   */
  async getItems(params?: InventoryListParams): Promise<ApiResponse<InventoryItem[]>> {
    const response = await apiClient.get<ApiResponse<InventoryItem[]>>('/inventory', { params });
    return response.data;
  },

  /**
   * Fetches details of a single inventory item by ID.
   */
  async getItem(id: string): Promise<ApiResponse<InventoryItem>> {
    const response = await apiClient.get<ApiResponse<InventoryItem>>(`/inventory/${id}`);
    return response.data;
  },

  /**
   * Creates a new inventory item.
   */
  async createItem(data: InventoryCreateInput): Promise<ApiResponse<InventoryItem>> {
    const response = await apiClient.post<ApiResponse<InventoryItem>>('/inventory', data);
    return response.data;
  },

  /**
   * Updates an existing inventory item.
   */
  async updateItem(id: string, data: InventoryUpdateInput): Promise<ApiResponse<InventoryItem>> {
    const response = await apiClient.put<ApiResponse<InventoryItem>>(`/inventory/${id}`, data);
    return response.data;
  },

  /**
   * Deletes an inventory item by ID.
   */
  async deleteItem(id: string): Promise<ApiResponse<void>> {
    const response = await apiClient.delete<ApiResponse<void>>(`/inventory/${id}`);
    return response.data;
  },

  /**
   * Fetches dashboard metrics, inventory health score, and expiry alerts.
   */
  async getDashboardStats(): Promise<ApiResponse<InventoryDashboardStats>> {
    const response = await apiClient.get<ApiResponse<InventoryDashboardStats>>('/inventory/dashboard');
    return response.data;
  },

  /**
   * Fetches items expiring within N days (default 7).
   */
  async getExpiringItems(days: number = 7): Promise<ApiResponse<InventoryItem[]>> {
    const response = await apiClient.get<ApiResponse<InventoryItem[]>>('/inventory/expiring', {
      params: { days },
    });
    return response.data;
  },

  /**
   * Downloads sample CSV template file for bulk import reference.
   */
  async downloadSampleTemplate(): Promise<void> {
    const response = await apiClient.get('/inventory/template', { responseType: 'blob' });
    const blob = new Blob([response.data], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'sample_inventory_template.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  /**
   * Exports inventory records to CSV file.
   */
  async exportCsv(): Promise<void> {
    const response = await apiClient.get('/inventory/export', { responseType: 'blob' });
    const blob = new Blob([response.data], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `inventory_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  /**
   * Bulk imports inventory items from CSV file.
   */
  async importCsv(file: File): Promise<ApiResponse<CsvImportSummary>> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post<ApiResponse<CsvImportSummary>>('/inventory/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

export default inventoryService;
