import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit2, Trash2, QrCode, AlertCircle, Package } from 'lucide-react';
import { InventoryItem } from '@/types';

interface InventoryTableProps {
  items: InventoryItem[];
  onEdit: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => void;
  onViewQr: (item: InventoryItem) => void;
}

export const InventoryTable: React.FC<InventoryTableProps> = ({
  items,
  onEdit,
  onDelete,
  onViewQr,
}) => {
  if (items.length === 0) {
    return (
      <div className="glass-panel p-12 text-center text-slate-500 dark:text-slate-400">
        <Package className="w-12 h-12 mx-auto text-slate-400 mb-3 opacity-60" />
        <h4 className="text-lg font-bold text-slate-800 dark:text-white">No inventory items found</h4>
        <p className="text-xs text-slate-500 mt-1">
          Try adjusting your search filters or add a new inventory item.
        </p>
      </div>
    );
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'fresh':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
      case 'expiring soon':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
      case 'expired':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30';
      case 'low stock':
        return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30';
      default:
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30';
    }
  };

  return (
    <div className="glass-panel overflow-hidden border border-slate-200/80 dark:border-slate-800/80">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100/70 dark:bg-slate-800/70 border-b border-slate-200/80 dark:border-slate-700/80 text-xs font-bold text-slate-600 dark:text-slate-300">
              <th className="py-3.5 px-4">Product</th>
              <th className="py-3.5 px-4">Category</th>
              <th className="py-3.5 px-4">Quantity</th>
              <th className="py-3.5 px-4">Expiry Date</th>
              <th className="py-3.5 px-4">Storage</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4">Selling Price</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60 text-xs">
            <AnimatePresence>
              {items.map((item, idx) => {
                const isLowStock = item.quantity <= item.low_stock_threshold;
                return (
                  <motion.tr
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2, delay: idx * 0.03 }}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    {/* Product Name & Supplier */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm flex-shrink-0">
                          {item.product_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white text-sm">
                            {item.product_name}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {item.supplier || 'No supplier listed'}
                            {item.barcode && ` • ${item.barcode}`}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 bg-slate-200/60 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-medium">
                        {item.category}
                      </span>
                    </td>

                    {/* Quantity with Low Stock Threshold indicator */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-bold ${isLowStock ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-200'}`}>
                          {item.quantity} {item.unit}
                        </span>
                        {isLowStock && (
                          <span
                            className="p-0.5 text-rose-500 bg-rose-500/10 rounded"
                            title={`Low Stock (Threshold: ${item.low_stock_threshold})`}
                          >
                            <AlertCircle className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        Min Threshold: {item.low_stock_threshold}
                      </span>
                    </td>

                    {/* Expiry Date & Days Left */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-0.5">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">
                          {item.expiry_date}
                        </p>
                        <span
                          className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: item.risk_color }}
                        >
                          {item.days_remaining < 0
                            ? 'Expired'
                            : item.days_remaining === 0
                            ? 'Today'
                            : `${item.days_remaining} days left`}
                        </span>
                      </div>
                    </td>

                    {/* Storage Type */}
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                      {item.storage_type}
                    </td>

                    {/* Status Pill */}
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 rounded-full border text-[11px] font-bold ${getStatusBadgeClass(item.status)}`}>
                        {item.status}
                      </span>
                    </td>

                    {/* Price */}
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                      ${item.selling_price.toFixed(2)}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onViewQr(item)}
                          className="p-1.5 text-slate-500 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors"
                          title="View QR Code"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onEdit(item)}
                          className="p-1.5 text-slate-500 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors"
                          title="Edit Item"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDelete(item)}
                          className="p-1.5 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                          title="Delete Item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
  );
};
