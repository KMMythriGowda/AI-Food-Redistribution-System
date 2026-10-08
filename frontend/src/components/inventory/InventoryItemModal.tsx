import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Package, AlertCircle, Save } from 'lucide-react';
import { InventoryItem, InventoryCreateInput, InventoryUpdateInput } from '@/types';

const inventorySchema = z.object({
  product_name: z.string().min(1, 'Product name is required').max(255),
  category: z.string().min(1, 'Category is required'),
  description: z.string().optional(),
  quantity: z.number({ invalid_type_error: 'Quantity must be a number' }).min(0, 'Quantity must be non-negative'),
  unit: z.string().min(1, 'Unit is required'),
  purchase_date: z.string().optional().nullable(),
  manufacturing_date: z.string().optional().nullable(),
  expiry_date: z.string().min(1, 'Expiry date is required'),
  storage_type: z.string().default('Ambient'),
  storage_temperature: z.number().optional().nullable(),
  supplier: z.string().optional(),
  cost_price: z.number().min(0, 'Cost price cannot be negative').default(0),
  selling_price: z.number().min(0, 'Selling price cannot be negative').default(0),
  barcode: z.string().optional(),
  low_stock_threshold: z
    .number({ invalid_type_error: 'Low stock threshold must be a number' })
    .min(0, 'Threshold must be non-negative')
    .default(5),
});

type InventoryFormData = z.infer<typeof inventorySchema>;

interface InventoryItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: InventoryCreateInput | InventoryUpdateInput) => Promise<void>;
  itemToEdit?: InventoryItem | null;
  initialValues?: Partial<InventoryFormData>;
  isSubmitting?: boolean;
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

const STORAGE_TYPES = ['Ambient', 'Refrigerated', 'Frozen', 'Cold Storage'];

export const InventoryItemModal: React.FC<InventoryItemModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  itemToEdit,
  initialValues,
  isSubmitting,
}) => {
  const isEditing = Boolean(itemToEdit);

  const getDefaultValues = (): InventoryFormData => ({
    product_name: '',
    category: 'Fruits',
    description: '',
    quantity: 1,
    unit: 'units',
    purchase_date: new Date().toISOString().slice(0, 10),
    manufacturing_date: null,
    expiry_date: '',
    storage_type: 'Ambient',
    storage_temperature: null,
    supplier: '',
    cost_price: 0,
    selling_price: 0,
    barcode: '',
    low_stock_threshold: 5,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InventoryFormData>({
    resolver: zodResolver(inventorySchema),
    defaultValues: {
      product_name: '',
      category: 'Fruits',
      description: '',
      quantity: 1,
      unit: 'units',
      purchase_date: new Date().toISOString().slice(0, 10),
      expiry_date: '',
      storage_type: 'Ambient',
      supplier: '',
      cost_price: 0.0,
      selling_price: 0.0,
      barcode: '',
      low_stock_threshold: 5, // Configurable threshold default 5
    },
  });

  useEffect(() => {
    if (itemToEdit) {
      reset({
        product_name: itemToEdit.product_name || '',
        category: itemToEdit.category || 'Fruits',
        description: itemToEdit.description || '',
        quantity: itemToEdit.quantity ?? 1,
        unit: itemToEdit.unit || 'units',
        purchase_date: itemToEdit.purchase_date || null,
        manufacturing_date: itemToEdit.manufacturing_date || null,
        expiry_date: itemToEdit.expiry_date || '',
        storage_type: itemToEdit.storage_type || 'Ambient',
        storage_temperature: itemToEdit.storage_temperature || null,
        supplier: itemToEdit.supplier || '',
        cost_price: itemToEdit.cost_price ?? 0,
        selling_price: itemToEdit.selling_price ?? 0,
        barcode: itemToEdit.barcode || '',
        low_stock_threshold: itemToEdit.low_stock_threshold ?? 5,
      });
    } else {
      reset({
        ...getDefaultValues(),
        ...(initialValues ?? {}),
      });
    }
  }, [itemToEdit, initialValues, reset, isOpen]);

  const handleFormSubmit = async (data: InventoryFormData) => {
    await onSubmit(data as InventoryCreateInput);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="glass-panel w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-8"
        >
          {/* Header */}
          <div className="p-5 border-b border-slate-200/80 dark:border-slate-800/80 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {isEditing ? 'Edit Inventory Item' : 'Add New Inventory Item'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Fill in the item details, expiry date, and customizable stock threshold.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(handleFormSubmit)} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Product Name */}
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Product Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Organic Milk 1L"
                  {...register('product_name')}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                {errors.product_name && (
                  <p className="text-[11px] text-rose-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {errors.product_name.message}
                  </p>
                )}
              </div>

              {/* Category */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Category *
                </label>
                <select
                  {...register('category')}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Storage Type */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Storage Type
                </label>
                <select
                  {...register('storage_type')}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  {STORAGE_TYPES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Quantity *
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="0"
                  {...register('quantity', { valueAsNumber: true })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                {errors.quantity && (
                  <p className="text-[11px] text-rose-500">{errors.quantity.message}</p>
                )}
              </div>

              {/* Unit */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Measurement Unit *
                </label>
                <input
                  type="text"
                  placeholder="kg, liters, packs, units"
                  {...register('unit')}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Expiry Date */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Expiry Date *
                </label>
                <input
                  type="date"
                  {...register('expiry_date')}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                {errors.expiry_date && (
                  <p className="text-[11px] text-rose-500">{errors.expiry_date.message}</p>
                )}
              </div>

              {/* Purchase Date */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Purchase Date
                </label>
                <input
                  type="date"
                  {...register('purchase_date')}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Configurable Low Stock Threshold */}
              <div className="space-y-1 p-3 bg-amber-500/5 dark:bg-amber-500/10 rounded-xl border border-amber-500/30 md:col-span-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-500" /> Configurable Low Stock Threshold *
                  </label>
                  <span className="text-[11px] text-slate-500">Default: 5</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Triggers a low stock alert when quantity drops to or below this customizable value.
                </p>
                <input
                  type="number"
                  step="any"
                  placeholder="5"
                  {...register('low_stock_threshold', { valueAsNumber: true })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700/60 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none mt-1"
                />
                {errors.low_stock_threshold && (
                  <p className="text-[11px] text-rose-500">{errors.low_stock_threshold.message}</p>
                )}
              </div>

              {/* Cost Price */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Cost Price ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...register('cost_price', { valueAsNumber: true })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Selling Price */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Selling Price ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...register('selling_price', { valueAsNumber: true })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Supplier */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Supplier Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Fresh Orchards Ltd"
                  {...register('supplier')}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Barcode */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Barcode Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. BAR-88214"
                  {...register('barcode')}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Description */}
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional notes or details..."
                  {...register('description')}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800/80 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary py-2 px-5 text-xs font-semibold"
              >
                <Save className="w-4 h-4" /> {isEditing ? 'Save Changes' : 'Create Item'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
