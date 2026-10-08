import React from 'react';
import { motion } from 'framer-motion';
import { Package, Activity, AlertTriangle, ShieldAlert } from 'lucide-react';
import { InventoryDashboardStats } from '@/types';

interface InventoryMetricsHeaderProps {
  stats: InventoryDashboardStats | null;
  onFilterStatus?: (status: string) => void;
}

export const InventoryMetricsHeader: React.FC<InventoryMetricsHeaderProps> = ({
  stats,
  onFilterStatus,
}) => {
  if (!stats) return null;

  const getHealthBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'excellent':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
      case 'good':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30';
      case 'warning':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
      default:
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30';
    }
  };

  const cards = [
    {
      title: 'Total Inventory Items',
      value: stats.total_products.toLocaleString(),
      subtitle: `Total Value: $${stats.total_inventory_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: Package,
      gradient: 'from-emerald-500/20 to-teal-500/10',
      iconColor: 'text-emerald-500 bg-emerald-500/10',
      action: () => onFilterStatus?.(''),
    },
    {
      title: 'Inventory Health',
      value: `${stats.health_score}%`,
      subtitle: `Status: ${stats.health_status}`,
      icon: Activity,
      gradient: 'from-blue-500/20 to-cyan-500/10',
      iconColor: 'text-blue-500 bg-blue-500/10',
      badge: stats.health_status,
      badgeColor: getHealthBadgeColor(stats.health_status),
    },
    {
      title: 'Expiring Soon',
      value: stats.expiring_soon_count.toLocaleString(),
      subtitle: 'Expiring within 3 days',
      icon: AlertTriangle,
      gradient: 'from-amber-500/20 to-orange-500/10',
      iconColor: 'text-amber-500 bg-amber-500/10',
      action: () => onFilterStatus?.('Expiring Soon'),
    },
    {
      title: 'Low Stock & Expired',
      value: (stats.low_stock_count + stats.expired_count).toLocaleString(),
      subtitle: `${stats.low_stock_count} Low Stock • ${stats.expired_count} Expired`,
      icon: ShieldAlert,
      gradient: 'from-rose-500/20 to-red-500/10',
      iconColor: 'text-rose-500 bg-rose-500/10',
      action: () => onFilterStatus?.('Low Stock'),
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.08 }}
            onClick={card.action}
            className={`glass-card p-5 cursor-pointer relative overflow-hidden transition-all duration-300 hover:scale-[1.02] border border-slate-200/80 dark:border-slate-800/80 bg-gradient-to-br ${card.gradient}`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {card.title}
                </p>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {card.value}
                </h3>
              </div>
              <div className={`p-2.5 rounded-xl ${card.iconColor}`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                {card.subtitle}
              </span>
              {card.badge && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${card.badgeColor}`}>
                  {card.badge}
                </span>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
