import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import {
  Building2,
  LogOut,
  Moon,
  Sun,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Sparkles,
  Bell
} from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useInventory } from '@/hooks/useInventory';
import { InventoryItem, InventoryCreateInput, InventoryUpdateInput } from '@/types';
import { marketplaceService, Notification as InAppNotification } from '@/services/marketplace';

import {
  InventorySkeleton,
  InventoryMetricsHeader,
  ExpiryTimelineCard,
  InventoryFilterBar,
  InventoryTable,
  InventoryCardGrid,
  InventoryItemModal,
  CsvUploadModal,
  BarcodeQrModal,
} from '@/components/inventory';
import BarcodeScannerModal from '@/components/inventory/BarcodeScannerModal';
import { AiWasteDashboardTab } from '@/components/inventory/AiWasteDashboardTab';
import { BusinessMarketplaceTab } from '@/components/donations/BusinessMarketplaceTab';
import { MarketplaceAnalyticsTab } from '@/components/analytics/MarketplaceAnalyticsTab';

export const BusinessDashboardShell: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Custom Inventory Hook
  const {
    items,
    pagination,
    stats,
    isListLoading,
    isListFetching,
    params,
    updateFilter,
    resetFilters,
    refetchList,
    refetchStats,
    createItem,
    isCreating,
    updateItem,
    isUpdating,
    deleteItem,
    isDeleting,
    importCsv,
    isImporting,
    downloadSampleTemplate,
    exportCsv,
  } = useInventory();

  // UI Local State
  const [activeTab, setActiveTab] = useState<'inventory' | 'ai' | 'marketplace' | 'analytics'>('inventory');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<InventoryItem | null>(null);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerMode, setScannerMode] = useState<'search' | 'add'>('search');
  const [barcodePrefill, setBarcodePrefill] = useState('');
  const [qrModalItem, setQrModalItem] = useState<InventoryItem | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<InventoryItem | null>(null);

  // Notification States
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const fetchNotifications = async () => {
    try {
      const res = await marketplaceService.getNotifications();
      if (res.success && res.data) {
        setNotifications(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkNotificationsRead = async () => {
    try {
      await marketplaceService.readAllNotifications();
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  // Handlers
  const handleOpenAddModal = () => {
    setItemToEdit(null);
    setBarcodePrefill('');
    setIsItemModalOpen(true);
  };

  const handleOpenAddByBarcode = () => {
    setScannerMode('add');
    setIsScannerOpen(true);
  };

  const handleOpenEditModal = (item: InventoryItem) => {
    setItemToEdit(item);
    setBarcodePrefill('');
    setIsItemModalOpen(true);
  };

  const handleSaveItem = async (data: InventoryCreateInput | InventoryUpdateInput) => {
    if (itemToEdit) {
      await updateItem({ id: itemToEdit.id, data: data as InventoryUpdateInput });
    } else {
      await createItem(data as InventoryCreateInput);
    }
  };

  const handleCloseItemModal = () => {
    setIsItemModalOpen(false);
    setItemToEdit(null);
    setBarcodePrefill('');
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirmItem) {
      await deleteItem(deleteConfirmItem.id);
      setDeleteConfirmItem(null);
    }
  };

  const handleRefreshAll = () => {
    refetchList();
    refetchStats();
  };

  const handleBarcodeScan = (barcode: string) => {
    const normalizedBarcode = barcode.trim();
    console.log(normalizedBarcode);
    setIsScannerOpen(false);

    if (scannerMode === 'search') {
      updateFilter({ search: normalizedBarcode });
      toast.success(`Showing inventory results for ${normalizedBarcode}`);
      return;
    }

    const existingItem = items.find(
      (item) => item.barcode?.trim().toLowerCase() === normalizedBarcode.toLowerCase()
    );

    if (existingItem) {
      setItemToEdit(existingItem);
      setBarcodePrefill(normalizedBarcode);
      toast.error('Product already exists.');
    } else {
      setItemToEdit(null);
      setBarcodePrefill(normalizedBarcode);
      toast.success('Ready to add a new item.');
    }

    setIsItemModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-300 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Navigation & Header Bar */}
        <header className="glass-panel p-5 flex flex-col sm:flex-row justify-between items-center gap-4 border border-emerald-500/30">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl shadow-lg shadow-emerald-500/20">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {user?.organization_name || 'Business Portal'}
                </h1>
                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-extrabold rounded-full border border-emerald-500/20">
                  FOOD BUSINESS
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Logged in as <span className="font-semibold">{user?.full_name}</span> ({user?.email})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Notifications Bell */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications) {
                    handleMarkNotificationsRead();
                  }
                }}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors relative"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {notifications.some(n => !n.is_read) && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-50 p-3.5 space-y-2.5 text-xs text-left">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-750">
                    <span className="font-bold text-slate-900 dark:text-white">Notifications</span>
                    <button 
                      onClick={() => setShowNotifications(false)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-850">
                    {notifications.length === 0 ? (
                      <p className="text-slate-500 text-center py-4">No notifications yet.</p>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} className="py-2 space-y-0.5">
                          <div className="flex justify-between items-start">
                            <p className="font-bold text-slate-800 dark:text-white">{n.title}</p>
                            <span className="text-[9px] text-slate-400">{new Date(n.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-400" />}
            </button>

            {/* Logout Button */}
            <button
              onClick={logout}
              className="btn-secondary py-2 px-4 text-xs font-semibold"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </header>

        {/* Dashboard Title & Phase Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              Inventory & Expiry Control Center <Sparkles className="w-5 h-5 text-amber-500" />
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Manage product stocks, monitor expiry risk levels, set custom thresholds, and import/export records.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            Phase 3 Active Module
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-850 gap-4 text-xs font-semibold flex-wrap">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`pb-3 px-1 border-b-2 transition-all ${
              activeTab === 'inventory'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-750 dark:text-slate-400'
            }`}
          >
            Inventory Stock Items
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`pb-3 px-1 border-b-2 transition-all ${
              activeTab === 'ai'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-750 dark:text-slate-400'
            }`}
          >
            AI Waste Prediction & Reorders
          </button>
          <button
            onClick={() => setActiveTab('marketplace')}
            className={`pb-3 px-1 border-b-2 transition-all ${
              activeTab === 'marketplace'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-750 dark:text-slate-400'
            }`}
          >
            Redistribution Marketplace
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`pb-3 px-1 border-b-2 transition-all ${
              activeTab === 'analytics'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-750 dark:text-slate-400'
            }`}
          >
            Sustainability Analytics
          </button>
        </div>

        {activeTab === 'inventory' ? (
          <>
            {/* Top Metric Cards */}
            <InventoryMetricsHeader
              stats={stats}
              onFilterStatus={(status) => updateFilter({ status })}
            />

            {/* Expiry Risk Timeline & Critical Alerts */}
            <ExpiryTimelineCard
              stats={stats}
              onSelectItem={(item) => handleOpenEditModal(item)}
              onFilterExpiring={() => updateFilter({ status: 'Expiring Soon' })}
            />

            {/* Filter & Action Toolbar */}
            <InventoryFilterBar
              params={params}
              onUpdateParams={updateFilter}
              onResetParams={resetFilters}
              onAddNew={handleOpenAddModal}
              onImportCsv={() => setIsCsvModalOpen(true)}
              onExportCsv={exportCsv}
              onScanBarcode={() => {
                setScannerMode('search');
                setIsScannerOpen(true);
              }}
              onAddByBarcode={handleOpenAddByBarcode}
              onRefresh={handleRefreshAll}
              viewMode={viewMode}
              onToggleViewMode={setViewMode}
              isFetching={isListFetching}
            />

            {/* Inventory Items List View */}
            {isListLoading ? (
              <InventorySkeleton />
            ) : (
              <div className="space-y-4">
                {viewMode === 'table' ? (
                  <InventoryTable
                    items={items}
                    onEdit={handleOpenEditModal}
                    onDelete={(item) => setDeleteConfirmItem(item)}
                    onViewQr={(item) => setQrModalItem(item)}
                  />
                ) : (
                  <InventoryCardGrid
                    items={items}
                    onEdit={handleOpenEditModal}
                    onDelete={(item) => setDeleteConfirmItem(item)}
                    onViewQr={(item) => setQrModalItem(item)}
                  />
                )}

                {/* Pagination Controls */}
                {pagination.pages > 1 && (
                  <div className="glass-panel p-4 flex justify-between items-center text-xs">
                    <span className="text-slate-500 dark:text-slate-400">
                      Showing Page <span className="font-bold text-slate-800 dark:text-slate-200">{pagination.page}</span> of{' '}
                      <span className="font-bold text-slate-800 dark:text-slate-200">{pagination.pages}</span> ({pagination.total} total items)
                    </span>

                    <div className="flex gap-2">
                      <button
                        onClick={() => updateFilter({ page: Math.max(1, pagination.page - 1) })}
                        disabled={pagination.page <= 1}
                        className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 disabled:opacity-40"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => updateFilter({ page: Math.min(pagination.pages, pagination.page + 1) })}
                        disabled={pagination.page >= pagination.pages}
                        className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 disabled:opacity-40"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : activeTab === 'ai' ? (
          <AiWasteDashboardTab />
        ) : activeTab === 'marketplace' ? (
          <BusinessMarketplaceTab inventoryItems={items} />
        ) : (
          <MarketplaceAnalyticsTab />
        )}
      </div>

      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleBarcodeScan}
      />

      {/* Item Modal (Create / Edit) */}
      <InventoryItemModal
        isOpen={isItemModalOpen}
        onClose={handleCloseItemModal}
        onSubmit={handleSaveItem}
        itemToEdit={itemToEdit}
        initialValues={barcodePrefill ? { barcode: barcodePrefill } : undefined}
        isSubmitting={isCreating || isUpdating}
      />

      {/* CSV Import Modal with downloadable sample template */}
      <CsvUploadModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        onUpload={async (file: File) => {
          const res = await importCsv(file);
          return res.data;
        }}
        onDownloadTemplate={downloadSampleTemplate}
        isUploading={isImporting}
      />

      {/* Barcode & QR Code Preview Modal */}
      <BarcodeQrModal item={qrModalItem} onClose={() => setQrModalItem(null)} />

      {/* Delete Confirmation Modal */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-panel w-full max-w-sm bg-white dark:bg-slate-900 p-6 space-y-4 border border-rose-500/30 text-center"
          >
            <div className="w-12 h-12 bg-rose-500/10 text-rose-500 rounded-2xl mx-auto flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Delete Inventory Item?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete <span className="font-bold text-slate-800 dark:text-slate-200">{deleteConfirmItem.product_name}</span>? This action cannot be undone.
              </p>
            </div>

            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={() => setDeleteConfirmItem(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md transition-colors"
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
