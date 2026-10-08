import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Calendar, ArrowUpRight, Flame } from 'lucide-react';
import { InventoryDashboardStats, InventoryItem } from '@/types';

interface ExpiryTimelineCardProps {
  stats: InventoryDashboardStats | null;
  onSelectItem?: (item: InventoryItem) => void;
  onFilterExpiring?: () => void;
}

export const ExpiryTimelineCard: React.FC<ExpiryTimelineCardProps> = ({
  stats,
  onSelectItem,
  onFilterExpiring,
}) => {
  if (!stats) return null;

  const timeline = stats.expiry_timeline;
  const urgentAlerts = stats.todays_alerts || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Expiry Risk Timeline Summary */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="glass-panel p-6 lg:col-span-1 border border-amber-500/30 dark:border-amber-500/20 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent flex flex-col justify-between"
      >
        <div>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Expiry Timeline
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Risk forecasting based on shelf dates
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 my-4">
            <div className="p-3 bg-rose-500/10 dark:bg-rose-500/20 rounded-xl border border-rose-500/20">
              <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">Today</span>
              <p className="text-xl font-extrabold text-rose-700 dark:text-rose-300 mt-0.5">
                {timeline.today} <span className="text-xs font-normal">items</span>
              </p>
            </div>

            <div className="p-3 bg-amber-500/10 dark:bg-amber-500/20 rounded-xl border border-amber-500/20">
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Tomorrow</span>
              <p className="text-xl font-extrabold text-amber-700 dark:text-amber-300 mt-0.5">
                {timeline.tomorrow} <span className="text-xs font-normal">items</span>
              </p>
            </div>

            <div className="p-3 bg-orange-500/10 dark:bg-orange-500/20 rounded-xl border border-orange-500/20">
              <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">Next 7 Days</span>
              <p className="text-xl font-extrabold text-orange-700 dark:text-orange-300 mt-0.5">
                {timeline.next_7_days} <span className="text-xs font-normal">items</span>
              </p>
            </div>

            <div className="p-3 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-xl border border-emerald-500/20">
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Next 30 Days</span>
              <p className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5">
                {timeline.next_30_days} <span className="text-xs font-normal">items</span>
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={onFilterExpiring}
          className="btn-primary w-full py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 mt-2"
        >
          View All Expiring Items <ArrowUpRight className="w-4 h-4" />
        </button>
      </motion.div>

      {/* Critical Expiry Alerts Carousel / List */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="glass-panel p-6 lg:col-span-2 border border-slate-200/80 dark:border-slate-800/80"
      >
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-rose-500/10 text-rose-500 rounded-xl">
              <Flame className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Urgent Expiry Alerts ({urgentAlerts.length})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Items requiring immediate redistribution or action
              </p>
            </div>
          </div>
        </div>

        {urgentAlerts.length === 0 ? (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            <Calendar className="w-10 h-10 mx-auto text-emerald-500/40 mb-2" />
            <p className="text-sm font-medium">No urgent items expiring in the next 3 days!</p>
            <p className="text-xs text-slate-400 mt-1">Your inventory is in good health.</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
            {urgentAlerts.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectItem?.(item)}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 hover:border-amber-500/50 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.risk_color }}
                  ></div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {item.product_name}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {item.quantity} {item.unit} • {item.category} • Expiry: {item.expiry_date}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full text-white"
                    style={{ backgroundColor: item.risk_color }}
                  >
                    {item.days_remaining < 0
                      ? 'Expired'
                      : item.days_remaining === 0
                      ? 'Expires Today'
                      : `${item.days_remaining} Days Left`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};
