import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit2, Trash2, QrCode, AlertCircle, Clock } from 'lucide-react';
import { InventoryItem } from '@/types';

interface InventoryCardGridProps {
  items: InventoryItem[];
  onEdit: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => void;
  onViewQr: (item: InventoryItem) => void;
}

export const InventoryCardGrid: React.FC<InventoryCardGridProps> = ({
  items,
  onEdit,
  onDelete,
  onViewQr,
}) => {
  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      <AnimatePresence>
        {items.map((item, idx) => {
          const isLowStock = item.quantity <= item.low_stock_threshold;
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, delay: idx * 0.04 }}
              className="glass-card p-5 flex flex-col justify-between border border-slate-200/80 dark:border-slate-800/80 relative overflow-hidden"
            >
              {/* Risk Border Top Accent */}
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{ backgroundColor: item.risk_color }}
              ></div>

              <div>
                {/* Header: Name & Status */}
                <div className="flex justify-between items-start gap-2 mb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                      {item.category}
                    </span>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white mt-1.5 line-clamp-1">
                      {item.product_name}
                    </h4>
                  </div>
                  <span
                    className="text-[10px] font-extrabold px-2.5 py-1 rounded-full text-white flex-shrink-0"
                    style={{ backgroundColor: item.risk_color }}
                  >
                    {item.days_remaining < 0 ? 'Expired' : `${item.days_remaining}d Left`}
                  </span>
                </div>

                {/* Details */}
                <div className="space-y-2 my-3 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Quantity:</span>
                    <span className={`font-bold ${isLowStock ? 'text-rose-500 flex items-center gap-1' : ''}`}>
                      {item.quantity} {item.unit}
                      {isLowStock && <AlertCircle className="w-3.5 h-3.5" />}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Low Stock Min:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {item.low_stock_threshold} {item.unit}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Expiry Date:</span>
                    <span className="font-semibold flex items-center gap-1 text-slate-800 dark:text-slate-200">
                      <Clock className="w-3.5 h-3.5 text-slate-400" /> {item.expiry_date}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Storage Type:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{item.storage_type}</span>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-slate-200/50 dark:border-slate-800/50">
                    <span className="text-slate-400">Selling Price:</span>
                    <span className="font-bold text-slate-900 dark:text-white text-sm">
                      ${item.selling_price.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                <button
                  onClick={() => onViewQr(item)}
                  className="text-xs text-slate-500 hover:text-emerald-500 font-medium inline-flex items-center gap-1"
                >
                  <QrCode className="w-3.5 h-3.5" /> Barcode/QR
                </button>

                <div className="flex gap-1">
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
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
