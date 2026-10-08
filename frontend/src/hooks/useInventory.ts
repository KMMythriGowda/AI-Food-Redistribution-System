import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import inventoryService from '@/services/inventory';
import {
  InventoryCreateInput,
  InventoryUpdateInput,
  InventoryListParams,
} from '@/types';

export const INVENTORY_QUERY_KEY = ['inventory', 'list'];
export const INVENTORY_STATS_QUERY_KEY = ['inventory', 'stats'];

export const useInventory = (initialParams: InventoryListParams = {}) => {
  const queryClient = useQueryClient();

  // Search & Filter State
  const [params, setParams] = useState<InventoryListParams>({
    page: 1,
    per_page: 12,
    sort_by: 'expiry_date',
    order: 'asc',
    ...initialParams,
  });

  // Query: Inventory List
  const {
    data: listResponse,
    isLoading: isListLoading,
    isFetching: isListFetching,
    error: listError,
    refetch: refetchList,
  } = useQuery({
    queryKey: [...INVENTORY_QUERY_KEY, params],
    queryFn: () => inventoryService.getItems(params),
  });

  // Query: Dashboard Stats
  const {
    data: statsResponse,
    isLoading: isStatsLoading,
    refetch: refetchStats,
  } = useQuery({
    queryKey: INVENTORY_STATS_QUERY_KEY,
    queryFn: () => inventoryService.getDashboardStats(),
  });

  // Helper function to invalidate inventory caches
  const invalidateInventoryQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
  }, [queryClient]);

  // Mutation: Create Item
  const createMutation = useMutation({
    mutationFn: (data: InventoryCreateInput) => inventoryService.createItem(data),
    onSuccess: (res) => {
      toast.success(res.message || 'Item added successfully!');
      invalidateInventoryQueries();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.details || err?.response?.data?.error || 'Failed to create item';
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  });

  // Mutation: Update Item
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: InventoryUpdateInput }) =>
      inventoryService.updateItem(id, data),
    onSuccess: (res) => {
      toast.success(res.message || 'Item updated successfully!');
      invalidateInventoryQueries();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.details || err?.response?.data?.error || 'Failed to update item';
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  });

  // Mutation: Delete Item
  const deleteMutation = useMutation({
    mutationFn: (id: string) => inventoryService.deleteItem(id),
    onSuccess: (res) => {
      toast.success(res.message || 'Item deleted successfully!');
      invalidateInventoryQueries();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to delete item';
      toast.error(msg);
    },
  });

  // Mutation: Import CSV
  const importCsvMutation = useMutation({
    mutationFn: (file: File) => inventoryService.importCsv(file),
    onSuccess: (res) => {
      const summary = res.data;
      if (summary) {
        toast.success(`Import complete! ${summary.imported_count} items added, ${summary.failed_count} failed.`);
      } else {
        toast.success(res.message || 'CSV imported successfully!');
      }
      invalidateInventoryQueries();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to import CSV';
      toast.error(msg);
    },
  });

  // Handlers for search/filter state updates
  const updateFilter = useCallback((newParams: Partial<InventoryListParams>) => {
    setParams((prev) => ({
      ...prev,
      ...newParams,
      page: newParams.page !== undefined ? newParams.page : 1, // Reset page on filter change
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setParams({
      page: 1,
      per_page: 12,
      sort_by: 'expiry_date',
      order: 'asc',
      search: '',
      category: '',
      status: '',
      storage_type: '',
    });
  }, []);

  return {
    // Data
    items: listResponse?.data || [],
    pagination: listResponse?.pagination || { total: 0, page: 1, per_page: 12, pages: 1 },
    stats: statsResponse?.data || null,

    // Loading states
    isListLoading,
    isListFetching,
    isStatsLoading,
    listError,

    // Parameters & Filters
    params,
    updateFilter,
    resetFilters,

    // Actions & Mutations
    refetchList,
    refetchStats,
    createItem: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateItem: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteItem: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    importCsv: importCsvMutation.mutateAsync,
    isImporting: importCsvMutation.isPending,
    downloadSampleTemplate: inventoryService.downloadSampleTemplate,
    exportCsv: inventoryService.exportCsv,
  };
};

export default useInventory;
