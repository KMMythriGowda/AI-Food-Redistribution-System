import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Heart, 
  ShoppingBag, 
  RefreshCw,
  Coins
} from 'lucide-react';
import { marketplaceService, MarketplaceAnalytics } from '@/services/marketplace';

export const MarketplaceAnalyticsTab: React.FC = () => {
  const [analytics, setAnalytics] = useState<MarketplaceAnalytics | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await marketplaceService.getMarketplaceAnalytics();
      if (res.success && res.data) {
        setAnalytics(res.data);
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
      </div>
    );
  }

  const donatedQty = analytics?.food_donated_quantity || 0;
  const soldQty = analytics?.food_sold_quantity || 0;
  const totalQty = donatedQty + soldQty;
  const donationPercent = totalQty > 0 ? Math.round((donatedQty / totalQty) * 100) : 0;
  const soldPercent = totalQty > 0 ? Math.round((soldQty / totalQty) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-emerald-500" /> Sustainability & Redistribution Analytics
        </h3>
        <p className="text-xs text-slate-500">Live platform performance and ecological waste-reduction statistics.</p>
      </div>

      {/* Grid Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Donation redistribution */}
        <div className="glass-card p-5 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-slate-550 dark:text-slate-400 font-extrabold uppercase tracking-wider">Food Donated</span>
            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <Heart className="w-4 h-4 fill-emerald-500/10" />
            </div>
          </div>
          <div>
            <h4 className="text-2xl font-black text-slate-900 dark:text-white">{donatedQty.toLocaleString()} <span className="text-xs font-semibold text-slate-500">units</span></h4>
            <p className="text-[10px] text-slate-500 mt-1">Redistributed through free community claims</p>
          </div>
        </div>

        {/* Sold Surplus */}
        <div className="glass-card p-5 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-slate-550 dark:text-slate-400 font-extrabold uppercase tracking-wider">Food Sold as Surplus</span>
            <div className="p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h4 className="text-2xl font-black text-slate-900 dark:text-white">{soldQty.toLocaleString()} <span className="text-xs font-semibold text-slate-500">units</span></h4>
            <p className="text-[10px] text-slate-500 mt-1">Redistributed through paid marketplace listings</p>
          </div>
        </div>

        {/* Revenue */}
        <div className="glass-card p-5 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-slate-550 dark:text-slate-400 font-extrabold uppercase tracking-wider">Payment Revenue</span>
            <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h4 className="text-2xl font-black text-slate-900 dark:text-white">₹{analytics?.payment_revenue.toLocaleString() || '0.00'}</h4>
            <p className="text-[10px] text-slate-500 mt-1">Total revenue generated from surplus sales</p>
          </div>
        </div>
      </div>

      {/* Sustainability Impact Metrics (CO2 & Meals) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CO2 Savings */}
        <div className="glass-card p-5 border border-emerald-500/20 bg-emerald-500/5 space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-extrabold uppercase tracking-wider">Estimated CO2 Savings</span>
            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 rounded-lg text-xs">
              🌱
            </div>
          </div>
          <div>
            <h4 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {analytics?.estimated_co2_savings?.toLocaleString() || '0'} <span className="text-xs font-semibold">kg CO₂e</span>
            </h4>
            <p className="text-[10px] text-slate-500 mt-1">
              *ESTIMATED environmental impact diverted. Assumes {analytics?.co2_per_unit_factor || 2.5} kg CO₂ saved per unit redistributed.
            </p>
          </div>
        </div>

        {/* Meals Redistributed */}
        <div className="glass-card p-5 border border-indigo-500/20 bg-indigo-500/5 space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-indigo-700 dark:text-indigo-400 font-extrabold uppercase tracking-wider">Estimated Meals Supported</span>
            <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-450 rounded-lg text-xs">
              🍽️
            </div>
          </div>
          <div>
            <h4 className="text-2xl font-black text-indigo-655 dark:text-indigo-400">
              {analytics?.estimated_meals_redistributed?.toLocaleString() || '0'} <span className="text-xs font-semibold">meals</span>
            </h4>
            <p className="text-[10px] text-slate-500 mt-1">
              *ESTIMATED food insecurity relief. Assumes {analytics?.meals_per_unit_factor || 2.0} meals supported per unit redistributed.
            </p>
          </div>
        </div>
      </div>

      {/* Ratios & Averages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Progress Breakdown */}
        <div className="glass-card p-6 border border-slate-200 dark:border-slate-800 space-y-5">
          <h4 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">Redistribution Mix Ratio</h4>
          
          <div className="space-y-4">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-600 dark:text-slate-300">Donations ({donationPercent}%)</span>
              <span className="text-slate-655 dark:text-slate-350">Paid Surplus ({soldPercent}%)</span>
            </div>

            {/* Custom visual progress bar */}
            <div className="w-full h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
              <div 
                className="bg-emerald-500 h-full transition-all duration-500" 
                style={{ width: `${donationPercent}%` }}
                title={`Donation: ${donationPercent}%`}
              />
              <div 
                className="bg-amber-500 h-full transition-all duration-500" 
                style={{ width: `${soldPercent}%` }}
                title={`Paid Surplus: ${soldPercent}%`}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-500 pt-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span>Community Donations: {donatedQty} units</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span>Paid Surplus Sales: {soldQty} units</span>
              </div>
            </div>
          </div>
        </div>

        {/* Transaction Stats */}
        <div className="glass-card p-6 border border-slate-200 dark:border-slate-800 space-y-4">
          <h4 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">Marketplace Financial Metrics</h4>
          
          <div className="space-y-3.5 text-xs">
            <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-850">
              <span className="text-slate-600 dark:text-slate-300 font-medium">Completed Surplus Sales Transactions</span>
              <span className="font-bold text-slate-900 dark:text-white text-sm">{analytics?.completed_paid_transactions || 0}</span>
            </div>
            
            <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-850">
              <span className="text-slate-600 dark:text-slate-300 font-medium">Average Transaction Value</span>
              <span className="font-bold text-slate-900 dark:text-white text-sm">₹{analytics?.average_transaction_value || '0.00'}</span>
            </div>

            <div className="flex justify-between items-center py-1.5">
              <span className="text-slate-600 dark:text-slate-300 font-medium">Total Volume Redistributed</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-405 text-sm">{totalQty.toLocaleString()} units</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketplaceAnalyticsTab;
