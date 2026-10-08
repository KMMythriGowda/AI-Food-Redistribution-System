import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, QrCode, Printer, Barcode } from 'lucide-react';
import { InventoryItem } from '@/types';

interface BarcodeQrModalProps {
  item: InventoryItem | null;
  onClose: () => void;
}

export const BarcodeQrModal: React.FC<BarcodeQrModalProps> = ({ item, onClose }) => {
  if (!item) return null;

  const qrCodeText = item.qr_code || `INV-${item.id.slice(0, 8).toUpperCase()}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="glass-panel w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 space-y-5"
        >
          {/* Header */}
          <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-emerald-500" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Item Barcode & QR Code
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Code Card Content */}
          <div className="text-center space-y-4 py-2">
            <div>
              <h4 className="text-lg font-extrabold text-slate-900 dark:text-white">
                {item.product_name}
              </h4>
              <p className="text-xs text-slate-500">
                {item.category} • Expiry: {item.expiry_date}
              </p>
            </div>

            {/* Simulated QR Code Graphic */}
            <div className="w-44 h-44 mx-auto p-3 bg-white rounded-2xl shadow-md border border-slate-200 flex flex-col items-center justify-center space-y-2">
              <div className="grid grid-cols-5 gap-1.5 w-32 h-32 p-2 bg-slate-900 rounded-xl">
                {[...Array(25)].map((_, i) => (
                  <div
                    key={i}
                    className={`rounded-xs ${
                      (i * 7 + 3) % 2 === 0 ? 'bg-white' : 'bg-emerald-400'
                    }`}
                  ></div>
                ))}
              </div>
              <span className="text-[10px] font-mono text-slate-600">{qrCodeText}</span>
            </div>

            {/* Barcode display */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <Barcode className="w-24 h-8 mx-auto text-slate-800 dark:text-slate-200" />
              <p className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 mt-1">
                {item.barcode || `BAR-${item.id.slice(0, 8).toUpperCase()}`}
              </p>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={handlePrint}
              className="btn-secondary py-2 px-4 text-xs font-semibold"
            >
              <Printer className="w-4 h-4" /> Print Label
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
