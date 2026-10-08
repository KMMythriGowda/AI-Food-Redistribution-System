import React from 'react';
import {
  Search,
  Filter,
  Plus,
  Upload,
  Download,
  RefreshCw,
  LayoutGrid,
  List,
  X,
  ScanLine,
} from 'lucide-react';

import { InventoryListParams } from '@/types';

interface InventoryFilterBarProps {
  params: InventoryListParams;
  onUpdateParams: (newParams: Partial<InventoryListParams>) => void;
  onResetParams: () => void;
  onAddNew: () => void;
  onAddByBarcode: () => void;
  onImportCsv: () => void;
  onExportCsv: () => void;

  onScanBarcode: () => void;

  onRefresh: () => void;
  viewMode: 'table' | 'grid';
  onToggleViewMode: (mode: 'table' | 'grid') => void;
  isFetching?: boolean;
}

const CATEGORIES = [
  'Fruits',
  'Vegetables',
  'Dairy',
  'Bakery',
  'Meat',
  'Seafood',
  'Grains',
  'Beverages',
  'Prepared Foods',
  'Frozen',
  'Canned',
  'Others',
];

const STATUSES = ['Fresh', 'Expiring Soon', 'Expired', 'Low Stock', 'Donated'];

export const InventoryFilterBar: React.FC<InventoryFilterBarProps> = ({
  params,
  onUpdateParams,
  onResetParams,
  onAddNew,
  onAddByBarcode,
  onImportCsv,
  onExportCsv,
  onScanBarcode,
  onRefresh,
  viewMode,
  onToggleViewMode,
  isFetching,
}) => {
  const hasActiveFilters = Boolean(
    params.search || params.category || params.status || params.storage_type
  );

  return (
    <div className="glass-panel p-4 space-y-4 border border-slate-200/80 dark:border-slate-800/80">
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-center">
        {/* Search Input */}
        <div className="relative w-full lg:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by product name, supplier, barcode..."
            value={params.search || ''}
            onChange={(e) => onUpdateParams({ search: e.target.value })}
            className="w-full pl-10 pr-9 py-2 bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
          {params.search && (
            <button
              onClick={() => onUpdateParams({ search: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Action Controls & Views */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
          {/* View Mode Toggle */}
          <div className="flex bg-slate-200/60 dark:bg-slate-800 p-1 rounded-xl border border-slate-300/40 dark:border-slate-700/40">
            <button
              onClick={() => onToggleViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => onToggleViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={onRefresh}
            disabled={isFetching}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            title="Refresh List"
          >
            <RefreshCw
              className={`w-4 h-4 ${isFetching ? 'animate-spin text-emerald-500' : ''}`}
            />
          </button>

          <button
            onClick={onImportCsv}
            className="btn-accent py-2 px-3 text-xs font-semibold"
            title="Bulk CSV Import"
          >
            <Upload className="w-4 h-4" /> Import CSV
          </button>

          <button
            onClick={onExportCsv}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-1.5"
            title="Export CSV"
          >
            <Download className="w-4 h-4" /> Export
          </button>

          <button
            onClick={onScanBarcode}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-800/40 transition-colors inline-flex items-center gap-1.5"
            title="Scan Barcode"
          >
            <ScanLine className="w-4 h-4" />
            Scan Barcode
          </button>

          <button
            onClick={onAddByBarcode}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-800/40 transition-colors inline-flex items-center gap-1.5"
            title="Add by Barcode"
          >
            <ScanLine className="w-4 h-4" />
            Add by Barcode
          </button>

          <button onClick={onAddNew} className="btn-primary py-2 px-4 text-xs font-semibold">
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>
      </div>

      {/* Category & Status Filter Pills */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/50 dark:border-slate-800/50">
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 mr-1">
          <Filter className="w-3.5 h-3.5" /> Filters:
        </span>

        {/* Category Dropdown */}
        <select
          value={params.category || ''}
          onChange={(e) => onUpdateParams({ category: e.target.value })}
          className="px-3 py-1.5 bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        {/* Status Dropdown */}
        <select
          value={params.status || ''}
          onChange={(e) => onUpdateParams({ status: e.target.value })}
          className="px-3 py-1.5 bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="">All Statuses</option>
          {STATUSES.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>

        {/* Sort By Dropdown */}
        <select
          value={params.sort_by || 'expiry_date'}
          onChange={(e) => onUpdateParams({ sort_by: e.target.value })}
          className="px-3 py-1.5 bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="expiry_date">Sort by Expiry Date</option>
          <option value="product_name">Sort by Name</option>
          <option value="quantity">Sort by Quantity</option>
          <option value="newest">Sort by Newest</option>
        </select>

        {hasActiveFilters && (
          <button
            onClick={onResetParams}
            className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-semibold ml-auto flex items-center gap-1"
          >
            Clear Filters
          </button>
        )}
      </div>
    </div>
  );
};
