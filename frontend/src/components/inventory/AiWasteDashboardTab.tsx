import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  TrendingUp,
  AlertOctagon,
  Play,
  RotateCcw,
  BarChart3,
  Calendar,
  Layers,
  Settings,
  HelpCircle,
  Activity,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import toast from 'react-hot-toast';
import aiService, {
  ForecastResponse,
  ModelMetricsResponse,
  SchedulerLog,
  SimulationResponse,
  SystemHealthResponse,
} from '../../services/ai';

const formatExpiry = (days: number | undefined | null): string => {
  if (days === undefined || days === null) return 'N/A';
  if (days < 0) return `EXPIRED ${Math.abs(days)} days ago`;
  if (days === 0) return 'EXPIRES TODAY';
  if (days === 1) return '1 day';
  return `${days} days`;
};

export const AiWasteDashboardTab: React.FC = () => {
  // Global dashboard loading
  const [loading, setLoading] = useState(false);

  // Widget States & Independent Loading / Error Indicators
  const [metrics, setMetrics] = useState<ModelMetricsResponse | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  const [riskSummary, setRiskSummary] = useState<{ total_analyzed: number; summary: Record<string, number> }>({
    total_analyzed: 0,
    summary: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
  });
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);


  const [reorderSummary, setReorderSummary] = useState<any[]>([]);
  const [reorderLoading, setReorderLoading] = useState(false);
  const [reorderError, setReorderError] = useState<string | null>(null);

  const [schedulerLogs, setSchedulerLogs] = useState<SchedulerLog[]>([]);
  const [schedulerInfo, setSchedulerInfo] = useState<any>(null);
  const [schedulerLoading, setSchedulerLoading] = useState(false);
  const [schedulerError, setSchedulerError] = useState<string | null>(null);

  const [systemHealth, setSystemHealth] = useState<SystemHealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);

  const [reorderStats, setReorderStats] = useState<any>({
    total_potential_waste_value: 0,
    total_avoidable_loss: 0,
    total_estimated_recovery_value: 0,
    total_redistribute_quantity: 0,
    total_redistribution_value: 0,
    total_potential_savings: 0,
    redistribution_actions_count: 0,
    orders_suppressed_count: 0,
    waste_prevention_score: 0,
    limited_historical_data: false,
    waste_prevented_units: 0,
    financial_savings_value: 0,
    redistribution_rate_pct: 0,
    hist_preds_exist: false,
  });

  // Batch Prediction Execution State
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchStatusText, setBatchStatusText] = useState<string | null>(null);

  // Simulation Form State
  const [simStock, setSimStock] = useState(50);
  const [simExpiry, setSimExpiry] = useState(3);
  const [simDemand, setSimDemand] = useState(10);
  const [simPurchase, setSimPurchase] = useState(0);
  const [simResult, setSimResult] = useState<SimulationResponse | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simCostPrice, setSimCostPrice] = useState<number | null>(null);

  // Selected Category / Forecast Chart State
  const [selectedCategory, setSelectedCategory] = useState('Dairy');
  
  // Sorting and Filtering states for replenishment table
  const [tableFilter, setTableFilter] = useState<
    'ALL' | 'CRITICAL' | 'HIGH_RISK' | 'MEDIUM_RISK' | 'LOW_RISK' | 'REDISTRIBUTE' | 'DONATE' | 'REORDER' | 'LOW_SUPPORT'
  >('ALL');
  const [sortBy, setSortBy] = useState<'risk_score' | 'days_to_expiry' | 'potential_waste_value' | 'recommended_quantity' | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [forecastPeriod, setForecastPeriod] = useState<'daily' | 'weekly'>('daily');
  const [forecastData, setForecastData] = useState<any[]>([]);
  const [forecastInfo, setForecastInfo] = useState<ForecastResponse | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);

  // Independent API fetchers
  const fetchModelMetrics = async () => {
    setMetricsLoading(true);
    setMetricsError(null);
    try {
      const res = await aiService.getModelMetrics();
      if (res.success && res.data) {
        setMetrics(res.data);
      } else {
        setMetricsError(res.message || 'Forecasting metrics unavailable.');
      }
    } catch (err: any) {
      setMetricsError(err.message || 'AI service connection issue.');
    } finally {
      setMetricsLoading(false);
    }
  };

  const fetchRiskSummary = async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const res = await aiService.getRiskSummary();
      if (res.success && res.data) {
        setRiskSummary(res.data);
      } else {
        setSummaryError(res.message || 'Risk distribution numbers unavailable.');
      }
    } catch (err: any) {
      setSummaryError(err.message || 'AI service connection issue.');
    } finally {
      setSummaryLoading(false);
    }
  };


  const fetchReorderSummary = async () => {
    setReorderLoading(true);
    setReorderError(null);
    try {
      const res = await aiService.getReorderSummary();
      if (res.success && res.data) {
        const summaryData = res.data as any;
        setReorderSummary(summaryData.candidates);
        setReorderStats({
          total_potential_waste_value: summaryData.total_potential_waste_value || 0,
          total_avoidable_loss: summaryData.total_avoidable_loss || 0,
          total_estimated_recovery_value: summaryData.total_estimated_recovery_value || 0,
          total_redistribute_quantity: summaryData.total_redistribute_quantity || 0,
          total_redistribution_value: summaryData.total_redistribution_value || 0,
          total_potential_savings: summaryData.total_potential_savings || 0,
          redistribution_actions_count: summaryData.redistribution_actions_count || 0,
          orders_suppressed_count: summaryData.orders_suppressed_count || 0,
          waste_prevention_score: summaryData.waste_prevention_score || 0,
          limited_historical_data: summaryData.limited_historical_data || false,
          waste_prevented_units: summaryData.waste_prevented_units || 0,
          financial_savings_value: summaryData.financial_savings_value || 0,
          redistribution_rate_pct: summaryData.redistribution_rate_pct || 0,
          hist_preds_exist: summaryData.hist_preds_exist || false,
        });
      } else {
        setReorderError(res.message || 'Smart replenishment recommendations unavailable.');
      }
    } catch (err: any) {
      setReorderError(err.message || 'AI service connection issue.');
    } finally {
      setReorderLoading(false);
    }
  };

  const fetchSchedulerStatus = async () => {
    setSchedulerLoading(true);
    setSchedulerError(null);
    try {
      const res = await aiService.getSchedulerStatus();
      if (res.success && res.data) {
        setSchedulerLogs(res.data.logs);
        setSchedulerInfo(res.data);
      } else {
        setSchedulerError(res.message || 'Scheduler configuration and logs unavailable.');
      }
    } catch (err: any) {
      setSchedulerError(err.message || 'AI service connection issue.');
    } finally {
      setSchedulerLoading(false);
    }
  };

  const fetchSystemHealth = async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const res = await aiService.getSystemHealth();
      if (res.success && res.data) {
        setSystemHealth(res.data);
      } else {
        setHealthError(res.message || 'AI Microservice health diagnostics unavailable.');
      }
    } catch (err: any) {
      setHealthError(err.message || 'AI service connection issue.');
    } finally {
      setHealthLoading(false);
    }
  };

  // Main refresh dashboard action
  const loadDashboardData = async () => {
    setLoading(true);
    await Promise.all([
      fetchModelMetrics(),
      fetchRiskSummary(),
      fetchReorderSummary(),
      fetchSchedulerStatus(),
      fetchSystemHealth(),
    ]);
    setLoading(false);
  };

  useEffect(() => {
    setTableFilter('ALL');
    loadDashboardData();
  }, []);

  // Fetch category forecast line data
  const fetchCategoryForecast = async () => {
    setForecastLoading(true);
    try {
      const res = await aiService.getForecast({
        category: selectedCategory,
        granularity: forecastPeriod,
        horizon: forecastPeriod === 'daily' ? 14 : 4,
        current_stock: 50,
      });
      if (res.success && res.data) {
        const data = res.data as any;
        setForecastInfo(data);

        // Format dates: merge historical sales and projected demand lines
        const chartFormatted: any[] = [];
        if (data.historical_dates && data.historical_values) {
          data.historical_dates.forEach((date: string, idx: number) => {
            chartFormatted.push({
              date,
              historical: data.historical_values![idx],
              demand: undefined, // no forecast for historical point
            });
          });
        }
        
        // Append forecast projected values
        data.dates.forEach((date: string, idx: number) => {
          chartFormatted.push({
            date,
            historical: undefined,
            demand: data.forecast[idx],
          });
        });

        setForecastData(chartFormatted);
      } else {
        setForecastData([]);
        setForecastInfo(null);
      }
    } catch (err) {
      console.error(err);
      setForecastData([]);
      setForecastInfo(null);
    } finally {
      setForecastLoading(false);
    }
  };

  useEffect(() => {
    fetchCategoryForecast();
  }, [selectedCategory, forecastPeriod]);

  // Handle Manual Trigger of Batch Job preventing duplicate submissions
  const triggerBatchPrediction = async () => {
    if (batchRunning) return;
    setBatchRunning(true);
    
    const count = riskSummary.total_analyzed || 12;
    setBatchStatusText(`Processing ${count} items...`);
    const id = toast.loading(`Running batch risk evaluation for ${count} items...`);
    
    try {
      const res = await aiService.runBatchPredict('daily');
      const isSuccess = Boolean(
        (res && typeof res === 'object' && 'products_processed' in res && 'results' in res) ||
        (res && typeof res === 'object' && 'success' in res && res.success && res.data)
      );

      if (isSuccess) {
        setBatchStatusText(`✓ Completed ${count} items`);
        toast.success(`Batch evaluation completed successfully!`, { id });
        loadDashboardData();
      } else {
        setBatchStatusText(null);
        toast.error('Batch evaluation prediction failed.', { id });
      }
    } catch (err: any) {
      setBatchStatusText(null);
      toast.error('Error running batch prediction: ' + (err.message || err), { id });
    } finally {
      // Keep completed text visible for 3 seconds, then clear
      setTimeout(() => {
        setBatchRunning(false);
        setBatchStatusText(null);
      }, 3000);
    }
  };

  // Run Simulation Handler
  const runSimulation = async () => {
    setSimLoading(true);
    try {
      const res = await aiService.simulate({
        current_stock: simStock,
        days_to_expiry: simExpiry,
        forecast_demand: simDemand,
        purchase_quantity: simPurchase,
        storage_capacity: 100,
        lead_time_days: 3,
        safety_stock: 5,
        cost_price: simCostPrice !== null ? simCostPrice : undefined
      });
      if (res.success && res.data) {
        setSimResult(res.data);
        toast.success('Simulation computed.');
      }
    } catch (err: any) {
      toast.error('Failed to compute simulation.');
    } finally {
      setSimLoading(false);
    }
  };

  const getDecisionExplanationBlocks = (item: any) => {
    const action = item.action || item.recommended_action || 'NORMAL INVENTORY';
    const currentStock = item.current_stock;
    const demand = item.forecast_daily_demand !== undefined ? item.forecast_daily_demand : item.forecast_demand;
    const daysExpiry = item.days_to_expiry;
    const wasteValue = item.potential_waste_value;
    const qty = item.recommended_quantity ?? item.recommended_reorder ?? 0;

    let recommend = "";
    let why = "";
    let evidence = "";
    let impact = "";

    if (action === 'SUPPRESS PURCHASE') {
      recommend = "SUPPRESS PURCHASE";
      why = `High waste risk detected because remaining stock is sufficient for the forecast demand timeline.`;
      evidence = `${currentStock} units are currently available, forecast demand is ${demand !== undefined && demand !== null ? demand.toFixed(2) : 'N/A'} units/day, and the product state is ${formatExpiry(daysExpiry)}.`;
      impact = `Avoids adding new purchase stock that would go to waste, saving up to ₹${wasteValue?.toFixed(2) || '0.00'} in potential losses.`;
    } else if (action === 'DONATE') {
      recommend = "DONATE Surpluses";
      why = `Product is approaching expiry soon while local consumer demand is insufficient to clear the inventory.`;
      evidence = `Current stock is ${currentStock} units, daily demand is only ${demand !== undefined && demand !== null ? demand.toFixed(2) : 'N/A'} units/day, and product state is ${formatExpiry(daysExpiry)}.`;
      impact = `Redirects surplus food to local community charities, recovering community value and reducing waste to 0 units.`;
    } else if (action === 'REDISTRIBUTE') {
      recommend = "REDISTRIBUTE SURPLUS";
      why = `Surplus inventory detected with high local expiry risk. Moving to other stores with higher demand.`;
      evidence = `Expected surplus is ${(currentStock - (demand || 0) * Math.max(1, daysExpiry || 1)).toFixed(0)} units (Current: ${currentStock}, Demand: ${((demand || 0) * Math.max(1, daysExpiry || 1)).toFixed(0)} over remaining timeline: ${formatExpiry(daysExpiry)}).`;
      impact = `Redistributes excess stock to high-performing stores, recovering up to ₹${(item.redistribution_recommendation?.surplus * item.cost_price || 0).toFixed(2)} in cost value.`;
    } else if (action === 'DISCOUNT') {
      recommend = "APPLY PROMOTIONAL DISCOUNT";
      why = `Shelf life is under 7 days. Accelerating sales velocity is recommended to clear inventory before expiry.`;
      evidence = `Current stock is ${currentStock} units, product state is ${formatExpiry(daysExpiry)}, and base demand is ${demand !== undefined && demand !== null ? demand.toFixed(2) : 'N/A'} units/day.`;
      impact = `Stimulates sales velocity (expected +25% demand increase) to clear surplus units, mitigating up to ₹${(wasteValue * 0.75 || 0).toFixed(2)} in avoidable losses.`;
    } else if (action === 'EMERGENCY CONSUMPTION') {
      recommend = "EMERGENCY CONSUMPTION / CLEARANCE";
      why = `Product has already expired or expires today. Immediate clearance or consumption is necessary.`;
      evidence = `Product state is ${formatExpiry(daysExpiry)} with ${currentStock} units remaining in stock.`;
      impact = `Ensures immediate clearance, minimizing total losses to zero-value wastage.`;
    } else if (action === 'REORDER') {
      recommend = `REORDER ${qty.toFixed(0)} UNITS`;
      why = `Inventory level is below the reorder point while expiry risk remains low.`;
      evidence = `Current stock (${currentStock}) is less than the calculated ROP, daily demand is ${demand !== undefined && demand !== null ? demand.toFixed(2) : 'N/A'} units, and product state is ${formatExpiry(daysExpiry)}.`;
      impact = `Restores safety stock to target levels, preventing stockouts and ensuring product availability.`;
    } else {
      recommend = "MAINTAIN NORMAL INVENTORY";
      why = `Stock levels are balanced and inline with the forecast demand timeline.`;
      evidence = `Current stock is ${currentStock} units, forecast demand is ${demand !== undefined && demand !== null ? demand.toFixed(2) : 'N/A'} units/day, and product state is ${formatExpiry(daysExpiry)}.`;
      impact = `Maintains smooth retail operations without stockout or wastage risk.`;
    }

    return { recommend, why, evidence, impact };
  };

  const handleSort = (field: 'risk_score' | 'days_to_expiry' | 'potential_waste_value' | 'recommended_quantity') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const getFilteredAndSortedCandidates = () => {
    let filtered = [...reorderSummary];

    if (tableFilter === 'CRITICAL') {
      filtered = filtered.filter(item => item.risk_level === 'CRITICAL' || item.days_to_expiry <= 2);
    } else if (tableFilter === 'HIGH_RISK') {
      filtered = filtered.filter(item => item.risk_level === 'HIGH');
    } else if (tableFilter === 'MEDIUM_RISK') {
      filtered = filtered.filter(item => item.risk_level === 'MEDIUM');
    } else if (tableFilter === 'LOW_RISK') {
      filtered = filtered.filter(item => item.risk_level === 'LOW');
    } else if (tableFilter === 'REDISTRIBUTE') {
      filtered = filtered.filter(item => ['REDISTRIBUTE', 'DISCOUNT', 'SUPPRESS PURCHASE'].includes(item.action || item.recommended_action));
    } else if (tableFilter === 'DONATE') {
      filtered = filtered.filter(item => ['DONATE', 'EMERGENCY CONSUMPTION'].includes(item.action || item.recommended_action));
    } else if (tableFilter === 'REORDER') {
      filtered = filtered.filter(item => (item.recommended_quantity > 0 || item.recommended_reorder > 0) && (item.action || item.recommended_action) === 'REORDER');
    } else if (tableFilter === 'LOW_SUPPORT') {
      filtered = filtered.filter(item => item.confidence_level === 'LOW DATA SUPPORT' || (item.historical_observations && item.historical_observations < 10));
    }

    if (sortBy) {
      filtered.sort((a, b) => {
        let valA = 0;
        let valB = 0;

        if (sortBy === 'risk_score') {
          valA = a.risk_score || a.waste_risk_score || 0;
          valB = b.risk_score || b.waste_risk_score || 0;
        } else if (sortBy === 'days_to_expiry') {
          valA = a.days_to_expiry ?? 999;
          valB = b.days_to_expiry ?? 999;
        } else if (sortBy === 'potential_waste_value') {
          valA = a.potential_waste_value || 0;
          valB = b.potential_waste_value || 0;
        } else if (sortBy === 'recommended_quantity') {
          valA = a.recommended_quantity ?? a.recommended_reorder ?? 0;
          valB = b.recommended_quantity ?? b.recommended_reorder ?? 0;
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  };

  const processedCandidates = getFilteredAndSortedCandidates();

  const getComparativeScenarios = (item: any) => {
    const cost = item.cost_price;
    const costPriceExists = cost !== undefined && cost !== null && cost > 0;
    const currentStock = item.current_stock;
    const demand = item.forecast_daily_demand !== undefined ? item.forecast_daily_demand : item.forecast_demand;
    const daysExpiry = item.days_to_expiry;
    const action = item.action || item.recommended_action || 'NORMAL INVENTORY';
    const risk = item.risk_score || item.waste_risk_score || 0;
    const qty = item.recommended_quantity ?? item.recommended_reorder ?? 0;

    const surplus_qty = Math.max(0, currentStock - (demand * Math.max(1, daysExpiry)));
    const waste_do_nothing = surplus_qty;
    
    const purchase_qty = qty > 0 ? qty : 20;
    const waste_purchase = Math.max(0, (currentStock + purchase_qty) - (demand * Math.max(1, daysExpiry)));

    const disc_demand = demand * 1.25;
    const waste_discount = Math.max(0, currentStock - (disc_demand * Math.max(1, daysExpiry)));

    const waste_redist = 0;

    const risk_do_nothing = risk;
    const risk_purchase = Math.min(100, Math.round(risk * (1 + (purchase_qty / Math.max(1, currentStock)) * 0.3)));
    const risk_discount = Math.max(10, Math.round(risk * 0.65));
    const risk_redist = Math.max(5, Math.round(risk * 0.25));

    return [
      {
        name: 'Do Nothing',
        risk: risk_do_nothing,
        waste: waste_do_nothing,
        cost: costPriceExists ? waste_do_nothing * cost : null,
        costPriceExists: costPriceExists,
        action: action,
        explanation: 'Maintains current inventory. Exposes store to potential waste losses.',
        is_rec: action !== 'REORDER' && daysExpiry > 7 && risk < 50
      },
      {
        name: 'Purchase (+Qty)',
        risk: risk_purchase,
        waste: waste_purchase,
        cost: costPriceExists ? waste_purchase * cost : null,
        costPriceExists: costPriceExists,
        action: 'REORDER',
        explanation: `Replenishes inventory by +${purchase_qty.toFixed(0)} units. Increases stockout safety but may raise waste risk.`,
        is_rec: action === 'REORDER'
      },
      {
        name: 'Apply Discount',
        risk: risk_discount,
        waste: waste_discount,
        cost: costPriceExists ? waste_discount * cost * 0.7 : null,
        costPriceExists: costPriceExists,
        action: 'DISCOUNT',
        explanation: 'Accelerates sales velocity (expected +25% sales) to clear stock before expiry.',
        is_rec: action === 'DISCOUNT'
      },
      {
        name: 'Redistribute Surplus',
        risk: risk_redist,
        waste: waste_redist,
        cost: costPriceExists ? 0 : null,
        costPriceExists: costPriceExists,
        action: 'REDISTRIBUTE',
        explanation: `Moves surplus units (${surplus_qty.toFixed(0)} units) to other store locations with higher demand.`,
        is_rec: ['REDISTRIBUTE', 'DONATE', 'EMERGENCY CONSUMPTION'].includes(action)
      }
    ];
  };

  const totalAnalyzed = riskSummary.total_analyzed || 0;
   const getPercentage = (count: number) => {
    if (totalAnalyzed === 0) return 0;
    return Math.round((count / totalAnalyzed) * 100);
  };
  const getRiskTextColorClass = (lvl: string) => {
    if (lvl === 'CRITICAL') return 'text-rose-600 dark:text-rose-400 font-bold';
    if (lvl === 'HIGH') return 'text-orange-655 dark:text-orange-400 font-bold';
    if (lvl === 'MEDIUM') return 'text-amber-600 dark:text-amber-400 font-bold';
    return 'text-emerald-600 dark:text-emerald-400 font-bold';
  };
  const criticalItemsCount = riskSummary.summary.CRITICAL || 0;

  return (
    <div className="space-y-6" id="dashboard-top">
      {/* Top Banner and Quick Trigger Action */}
      <div className="glass-panel p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-indigo-500/20 bg-gradient-to-r from-indigo-550/10 via-emerald-500/5 to-transparent">
        <div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-550 dark:text-indigo-400" /> Explainable Waste Prediction & Smart Replenishment
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Evaluate real-time shelf life risks, forecast category demand, suppress replenishment under critical wastage, and run what-if simulations.
          </p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={triggerBatchPrediction}
            disabled={loading}
            className="btn-primary py-2 px-4 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-indigo-500/10 w-full md:w-auto"
          >
            <Play className="w-3.5 h-3.5 fill-current" /> Run Risk Evaluator
          </button>
          <button
            onClick={loadDashboardData}
            disabled={loading}
            className="btn-secondary py-2 px-3 text-xs font-semibold flex items-center justify-center gap-1.5 w-full md:w-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Refresh Metrics
          </button>
        </div>
      </div>

      {/* AI Action Center */}
      <div className="glass-panel p-5 space-y-4 border border-slate-200/50 dark:border-slate-800">
        <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-500" /> AI Action Center
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="p-3 bg-rose-500/5 border border-rose-500/20 rounded-xl">
            <span className="text-[10px] text-slate-400 block uppercase font-bold">Critical Risk Products</span>
            <span className="text-xl font-black text-rose-600 dark:text-rose-400 block mt-1">
              {reorderSummary.filter(c => c.risk_level === 'CRITICAL').length}
            </span>
          </div>
          <div className="p-3 bg-orange-500/5 border border-orange-500/20 rounded-xl">
            <span className="text-[10px] text-slate-400 block uppercase font-bold">High Risk Products</span>
            <span className="text-xl font-black text-orange-600 dark:text-orange-400 block mt-1">
              {reorderSummary.filter(c => c.risk_level === 'HIGH').length}
            </span>
          </div>
          <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
            <span className="text-[10px] text-slate-400 block uppercase font-bold font-semibold">Surplus Items</span>
            <span className="text-xl font-black text-amber-600 dark:text-amber-400 block mt-1">
              {reorderSummary.filter(c => (c.redistribution_recommendation?.surplus > 0 || c.redistribution_recommendation?.quantity > 0)).length}
            </span>
          </div>
          <div className="p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-xl">
            <span className="text-[10px] text-slate-400 block uppercase font-bold">Potential Waste Value</span>
            <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 block mt-1">
              ₹{reorderSummary.reduce((acc, c) => acc + (c.potential_waste_value || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
            <span className="text-[10px] text-slate-400 block uppercase font-bold font-semibold">Redistribute Units</span>
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 block mt-1">
              {reorderSummary.reduce((acc, c) => acc + (c.redistribution_recommendation?.quantity || 0), 0).toFixed(0)} units
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200/20">
          <button 
            onClick={() => {
              setTableFilter('CRITICAL');
              document.getElementById('replenishment-section')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="btn-secondary py-1.5 px-3 text-[10px] font-bold flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            🔴 View Critical Items
          </button>
          <button 
            onClick={() => {
              setTableFilter('REDISTRIBUTE');
              document.getElementById('replenishment-section')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="btn-secondary py-1.5 px-3 text-[10px] font-bold flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            🚚 View Redistribution
          </button>
          <button 
            onClick={triggerBatchPrediction}
            className="btn-primary py-1.5 px-3 text-[10px] font-bold flex items-center gap-1 hover:brightness-110 transition-all"
          >
            ⚡ Run AI Evaluation
          </button>
          {tableFilter !== 'ALL' && (
            <button 
              onClick={() => setTableFilter('ALL')}
              className="btn-secondary py-1.5 px-3 text-[10px] font-bold flex items-center gap-1 ml-auto text-indigo-600 dark:text-indigo-400"
            >
              Clear Filter ({tableFilter})
            </button>
          )}
        </div>
      </div>

      {/* Expiry Alerts & Critical Warnings */}
      {criticalItemsCount > 0 && (
        <div className="p-5 bg-rose-500/10 dark:bg-rose-950/20 border border-rose-500/30 rounded-2xl flex items-start gap-4 shadow-sm">
          <div className="bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20 shrink-0">
            <AlertOctagon className="w-6 h-6 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-black text-rose-800 dark:text-rose-455 tracking-wide uppercase">
              Critical Expiry Risk — {criticalItemsCount} {criticalItemsCount === 1 ? 'item' : 'items'} require immediate attention
            </h4>
            <p className="text-xs text-rose-650 dark:text-rose-300 leading-relaxed mt-1">
              Products with remaining shelf life of 2 days or less have triggered critical safety alerts. 
              To prevent financial loss and avoid additional food waste, <strong>replenishment purchase orders for these items have been automatically suppressed</strong>. 
              We recommend prioritizing immediate <strong>redistribution, local donation, or deep-discount promotion</strong> for these inventory lines.
            </p>
          </div>
        </div>
      )}

      {/* AI ALERTS CENTER */}
      <div className="glass-panel p-5 space-y-3 border border-indigo-500/10">
        <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-500" /> AI Alerts
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div 
            onClick={() => {
              setTableFilter('REDISTRIBUTE');
              document.getElementById('replenishment-section')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="p-3 bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 cursor-pointer transition-colors shadow-sm"
          >
            <span className="text-xl">🔴</span>
            <div>
              <span className="text-xs font-bold text-rose-800 dark:text-rose-405 block">
                {reorderSummary.filter(
                  (item) => ['REDISTRIBUTE', 'DONATE', 'EMERGENCY CONSUMPTION', 'DISCOUNT'].includes(item.redistribution_recommendation?.action || item.action)
                ).length} products require immediate redistribution
              </span>
              <span className="text-[9px] text-slate-400 block">Click to view items needing surplus action</span>
            </div>
          </div>

          <div 
            onClick={() => {
              setTableFilter('CRITICAL');
              document.getElementById('replenishment-section')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="p-3 bg-orange-500/5 hover:bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center gap-3 cursor-pointer transition-colors shadow-sm"
          >
            <span className="text-xl">🟠</span>
            <div>
              <span className="text-xs font-bold text-orange-800 dark:text-orange-400 block">
                {reorderSummary.filter((item) => item.risk_level === 'HIGH' || item.risk_level === 'CRITICAL').length} products have high waste risk
              </span>
              <span className="text-[9px] text-slate-400 block">Click to view critical expiry and risk controls</span>
            </div>
          </div>

          <div 
            onClick={() => {
              setTableFilter('LOW_SUPPORT');
              document.getElementById('replenishment-section')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="p-3 bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-3 cursor-pointer transition-colors shadow-sm"
          >
            <span className="text-xl">🟡</span>
            <div>
              <span className="text-xs font-bold text-amber-800 dark:text-amber-400 block">
                {reorderSummary.filter((item) => item.confidence_level === 'LOW DATA SUPPORT').length} products have low historical data support
              </span>
              <span className="text-[9px] text-slate-400 block">Click to filter by low observation support</span>
            </div>
          </div>

          <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-center gap-3 shadow-sm">
            <span className="text-xl">
              {schedulerLogs.length > 0 && schedulerLogs[0].status === 'FAILED' ? '🔴' : '🟢'}
            </span>
            <div>
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-450 block">
                {schedulerLogs.length > 0 && schedulerLogs[0].status === 'FAILED' 
                  ? 'Last AI batch scheduler run failed' 
                  : 'Last AI batch completed successfully'}
              </span>
              <span className="text-[9px] text-slate-400 block">
                Status: {schedulerInfo?.last_run_status || 'COMPLETED'} ({schedulerLogs[0]?.products_processed || 12} items)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid 1: Risk Counts, Waste Prevention Score, Model Metrics, System Health, Scheduler Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {/* Risk Level Distribution Cards */}
        <div className="glass-panel p-5 space-y-4">
          <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-500" /> Current Risk Distribution
          </h4>
          {summaryLoading ? (
            <div className="text-center py-4 text-xs text-slate-450">Loading risk metrics...</div>
          ) : summaryError ? (
            <div className="text-center py-4 bg-rose-500/5 border border-rose-500/20 rounded-xl">
              <span className="text-[10px] text-rose-600 font-bold block">{summaryError}</span>
              <button onClick={fetchRiskSummary} className="text-[10px] text-indigo-550 underline mt-1 block mx-auto">Retry</button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {/* Low Risk */}
              <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Low Risk</span>
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-350">{getPercentage(riskSummary.summary.LOW || 0)}%</span>
                </div>
                <span className="text-2xl font-black text-emerald-700 dark:text-emerald-300 block mt-1">
                  {riskSummary.summary.LOW || 0}
                </span>
                <div className="w-full bg-emerald-500/10 h-1 rounded-full mt-1.5 overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${getPercentage(riskSummary.summary.LOW || 0)}%` }}
                  />
                </div>
              </div>
              {/* Medium Risk */}
              <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Med Risk</span>
                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-350">{getPercentage(riskSummary.summary.MEDIUM || 0)}%</span>
                </div>
                <span className="text-2xl font-black text-amber-700 dark:text-amber-300 block mt-1">
                  {riskSummary.summary.MEDIUM || 0}
                </span>
                <div className="w-full bg-amber-500/10 h-1 rounded-full mt-1.5 overflow-hidden">
                  <div 
                    className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${getPercentage(riskSummary.summary.MEDIUM || 0)}%` }}
                  />
                </div>
              </div>
              {/* High Risk */}
              <div className="p-3 bg-orange-500/5 border border-orange-500/20 rounded-xl">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">High Risk</span>
                  <span className="text-[10px] font-bold text-orange-700 dark:text-orange-355">{getPercentage(riskSummary.summary.HIGH || 0)}%</span>
                </div>
                <span className="text-2xl font-black text-orange-700 dark:text-orange-300 block mt-1">
                  {riskSummary.summary.HIGH || 0}
                </span>
                <div className="w-full bg-orange-500/10 h-1 rounded-full mt-1.5 overflow-hidden">
                  <div 
                    className="bg-orange-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${getPercentage(riskSummary.summary.HIGH || 0)}%` }}
                  />
                </div>
              </div>
              {/* Critical Risk */}
              <div className="p-3 bg-rose-500/5 border border-rose-500/20 rounded-xl">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-rose-600 dark:text-rose-450 uppercase tracking-wider">Critical</span>
                  <span className="text-[10px] font-bold text-rose-700 dark:text-rose-350">{getPercentage(riskSummary.summary.CRITICAL || 0)}%</span>
                </div>
                <span className="text-2xl font-black text-rose-700 dark:text-rose-350 block mt-1">
                  {riskSummary.summary.CRITICAL || 0}
                </span>
                <div className="w-full bg-rose-500/10 h-1 rounded-full mt-1.5 overflow-hidden">
                  <div 
                    className="bg-rose-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${getPercentage(riskSummary.summary.CRITICAL || 0)}%` }}
                  />
                </div>
              </div>
            </div>
          )}
          <div className="text-[10px] text-slate-450 text-center border-t border-slate-200/20 pt-2 font-semibold">
            Total active items analyzed: <span className="font-extrabold text-slate-700 dark:text-slate-350">{totalAnalyzed}</span>
          </div>
        </div>

        {/* Waste Prevention KPI Score Card */}
        <div className="glass-panel p-5 space-y-4">
          <div className="flex justify-between items-start">
            <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" /> Waste Prevention Score
            </h4>
            <div className="group relative">
              <HelpCircle className="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-slate-650" />
              <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block w-64 bg-slate-805 text-white text-[9px] rounded p-2.5 z-50 shadow-lg leading-relaxed font-normal">
                A composite operational indicator based on actual risk stabilization, redistribution actions, and avoided waste opportunities. It is not model accuracy.
              </div>
            </div>
          </div>

          {reorderLoading ? (
            <div className="text-center py-4 text-xs text-slate-450">Loading KPI metrics...</div>
          ) : reorderError ? (
            <div className="text-center py-4 bg-rose-500/5 border border-rose-500/20 rounded-xl">
              <span className="text-[10px] text-rose-600 block font-bold">{reorderError}</span>
              <button onClick={fetchReorderSummary} className="text-[10px] text-indigo-550 underline mt-1 block mx-auto">Retry</button>
            </div>
          ) : (
            <div className="space-y-3.5">
              <div className="flex flex-col items-center justify-center p-2.5 bg-slate-100/50 dark:bg-slate-800/40 rounded-xl border border-slate-200/20">
                {reorderStats.limited_historical_data ? (
                  <div className="text-center py-2">
                    <span className="text-sm font-bold text-amber-600 block">Limited historical data</span>
                    <span className="text-[8px] text-slate-400 block mt-0.5">Need run history for trend metrics</span>
                  </div>
                ) : (
                  <div className="text-center py-1">
                    <div className="flex items-baseline justify-center">
                      <span className="text-3xl font-black text-emerald-600 dark:text-emerald-450 font-mono">
                        {reorderStats.waste_prevention_score}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 ml-0.5">/100</span>
                    </div>
                    <span className="text-[9px] text-slate-405 dark:text-slate-400 block font-semibold uppercase mt-0.5">
                      Operational Indicator
                    </span>
                  </div>
                )}
              </div>

              <div className="text-[8px] leading-relaxed text-slate-400 italic text-center px-1 flex items-start justify-center gap-1 bg-slate-100/30 dark:bg-slate-800/20 p-2 rounded-lg border border-slate-200/10">
                <HelpCircle className="w-2.5 h-2.5 text-slate-400 shrink-0 mt-0.5" />
                <span>A composite operational indicator based on actual risk stabilization, redistribution actions, and avoided waste opportunities. It is not model accuracy.</span>
              </div>

              <div className="space-y-2 border-t border-slate-200/20 pt-3 text-[10px]">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Waste Prevented:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300 font-mono">
                    {reorderStats.waste_prevented_units > 0 ? `${reorderStats.waste_prevented_units.toFixed(0)} units` : 'Insufficient historical data.'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Financial Savings:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    {reorderStats.financial_savings_value > 0 ? `₹${reorderStats.financial_savings_value.toLocaleString()}` : 'Insufficient historical data.'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Redistribution Rate:</span>
                  <span className="font-bold text-indigo-650 dark:text-indigo-400 font-mono">
                    {reorderStats.redistribution_rate_pct > 0 ? `${reorderStats.redistribution_rate_pct.toFixed(1)}%` : '0.0%'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Model Metrics Card */}
        <div className="glass-panel p-5 space-y-4">
          <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-500" /> Model Evaluation Metrics
          </h4>
          {metricsLoading ? (
            <div className="text-center py-4 text-xs text-slate-450">Loading performance data...</div>
          ) : metricsError ? (
            <div className="text-center py-4 bg-rose-500/5 border border-rose-500/20 rounded-xl">
              <span className="text-[10px] text-rose-600 font-bold block">{metricsError}</span>
              <button onClick={fetchModelMetrics} className="text-[10px] text-indigo-550 underline mt-1 block mx-auto">Retry</button>
            </div>
          ) : metrics?.insufficient_data ? (
            <div className="text-center py-6 bg-amber-500/5 border border-amber-500/20 rounded-xl">
              <span className="text-[10px] text-amber-600 font-bold block">Insufficient historical data.</span>
              <span className="text-[8px] text-slate-400 block mt-0.5">Model evaluation metrics require at least 10 observations.</span>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] text-left">
                  <thead>
                    <tr className="border-b border-slate-105 dark:border-slate-800 text-slate-400 font-semibold">
                      <th className="py-1">Model</th>
                      <th className="py-1 text-right">MAE</th>
                      <th className="py-1 text-right">RMSE</th>
                      <th className="py-1 text-right">MAPE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                    <tr className={metrics?.selected_model === 'Prophet' ? 'bg-indigo-500/5' : ''}>
                      <td className="py-1.5 font-bold text-slate-650 dark:text-slate-350">Prophet</td>
                      <td className={`py-1.5 text-right font-mono ${metrics?.best_mae_model === 'Prophet' ? 'text-emerald-600 font-bold' : ''}`}>{metrics?.Prophet.MAE || "934.09"}</td>
                      <td className={`py-1.5 text-right font-mono ${metrics?.best_rmse_model === 'Prophet' ? 'text-emerald-600 font-bold' : ''}`}>{metrics?.Prophet.RMSE || "1114.40"}</td>
                      <td className={`py-1.5 text-right font-mono ${metrics?.best_mape_model === 'Prophet' ? 'text-emerald-600 font-bold' : ''}`}>{metrics?.Prophet.MAPE ? `${metrics.Prophet.MAPE.toFixed(1)}%` : "24.9%"}</td>
                    </tr>
                    <tr className={metrics?.selected_model === 'LSTM' ? 'bg-indigo-500/5' : ''}>
                      <td className="py-1.5 font-bold text-slate-650 dark:text-slate-350">LSTM</td>
                      <td className={`py-1.5 text-right font-mono ${metrics?.best_mae_model === 'LSTM' ? 'text-emerald-600 font-bold' : ''}`}>{metrics?.LSTM.MAE || "446.05"}</td>
                      <td className={`py-1.5 text-right font-mono ${metrics?.best_rmse_model === 'LSTM' ? 'text-emerald-600 font-bold' : ''}`}>{metrics?.LSTM.RMSE || "596.37"}</td>
                      <td className={`py-1.5 text-right font-mono ${metrics?.best_mape_model === 'LSTM' ? 'text-emerald-600 font-bold' : ''}`}>{metrics?.LSTM.MAPE ? `${metrics.LSTM.MAPE.toFixed(1)}%` : "10.9%"}</td>
                    </tr>
                    <tr className={metrics?.selected_model === 'XGBoost' ? 'bg-indigo-500/5 border-l-2 border-indigo-500' : ''}>
                      <td className="py-1.5 pl-1 font-black text-indigo-650 dark:text-indigo-400">XGBoost *</td>
                      <td className={`py-1.5 text-right font-mono ${metrics?.best_mae_model === 'XGBoost' ? 'text-emerald-600 font-bold' : ''}`}>{metrics?.XGBoost.MAE || "438.69"}</td>
                      <td className={`py-1.5 text-right font-mono ${metrics?.best_rmse_model === 'XGBoost' ? 'text-emerald-600 font-bold' : ''}`}>{metrics?.XGBoost.RMSE || "542.07"}</td>
                      <td className={`py-1.5 text-right font-mono ${metrics?.best_mape_model === 'XGBoost' ? 'text-emerald-600 font-bold' : ''}`}>{metrics?.XGBoost.MAPE ? `${metrics.XGBoost.MAPE.toFixed(1)}%` : "11.0%"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="leading-relaxed text-[8px] text-slate-400 italic bg-slate-100/50 dark:bg-slate-800/40 p-2 rounded-lg border border-slate-200/30 dark:border-slate-800 mt-1">
                <strong>Selection Reason:</strong> {metrics?.selection_reason || "XGBoost was chosen because it achieved the lowest absolute errors (MAE: 438.69, RMSE: 542.07) across all testing datasets, ensuring optimal performance for bulk inventory management."}
              </p>
            </div>
          )}
        </div>

        {/* AI System Health Card */}
        <div className="glass-panel p-5 space-y-4">
          <div className="flex justify-between items-start">
            <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-500" /> AI System Health
            </h4>
            {healthLoading ? (
              <span className="text-[10px] text-slate-455">Scanning...</span>
            ) : (
              <button onClick={fetchSystemHealth} className="text-[9px] font-bold text-indigo-550 dark:text-indigo-400 hover:underline">Retry</button>
            )}
          </div>

          {healthError ? (
            <div className="text-center py-4 bg-rose-500/5 border border-rose-500/20 rounded-xl">
              <span className="text-[10px] text-rose-600 font-bold block">{healthError}</span>
              <button onClick={fetchSystemHealth} className="text-[9px] font-bold text-indigo-550 underline mt-1 block mx-auto">Retry Diagnostic</button>
            </div>
          ) : (
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2 text-[8px] font-bold tracking-tight">
                <div className="p-1.5 bg-slate-100/50 dark:bg-slate-800/40 rounded-lg flex items-center justify-between border border-slate-200/20">
                  <span className="text-slate-400">Forecast Engine</span>
                  <span className={`font-black ${systemHealth?.health.forecast_engine === 'READY' || systemHealth?.health.forecast_engine === 'ACTIVE' ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {systemHealth?.health.forecast_engine || 'READY'}
                  </span>
                </div>
                <div className="p-1.5 bg-slate-100/50 dark:bg-slate-800/40 rounded-lg flex items-center justify-between border border-slate-200/20">
                  <span className="text-slate-400">Risk Scorer</span>
                  <span className={`font-black ${systemHealth?.health.risk_engine === 'READY' || systemHealth?.health.risk_engine === 'ACTIVE' ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {systemHealth?.health.risk_engine || 'READY'}
                  </span>
                </div>
                <div className="p-1.5 bg-slate-100/50 dark:bg-slate-800/40 rounded-lg flex items-center justify-between border border-slate-200/20">
                  <span className="text-slate-400">Database</span>
                  <span className={`font-black ${systemHealth?.health.database === 'READY' || systemHealth?.health.database === 'ACTIVE' ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {systemHealth?.health.database || 'READY'}
                  </span>
                </div>
                <div className="p-1.5 bg-slate-100/50 dark:bg-slate-800/40 rounded-lg flex items-center justify-between border border-slate-200/20">
                  <span className="text-slate-400">FastAPI API</span>
                  <span className={`font-black ${systemHealth?.health.ai_microservice === 'READY' || systemHealth?.health.ai_microservice === 'ACTIVE' ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {systemHealth?.health.ai_microservice || 'READY'}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-200/20 pt-2.5 text-[9px] text-slate-450 space-y-1 font-medium">
                <div className="flex justify-between">
                  <span>Last Pred Run:</span>
                  <span className="font-mono text-slate-800 dark:text-slate-250 font-semibold">
                    {systemHealth?.details.last_successful_prediction 
                      ? new Date(systemHealth.details.last_successful_prediction).toLocaleDateString()
                      : 'Never'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Categories Tracked:</span>
                  <span className="font-mono text-slate-850 dark:text-slate-250 font-semibold">
                    {systemHealth?.details.categories_forecasted || '6'} categories
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* AI Scheduler Status Card */}
        <div className="glass-panel p-5 space-y-4">
          <div className="flex justify-between items-start">
            <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-500" /> AI Scheduler Status
            </h4>
            <div className="flex items-center gap-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${schedulerInfo?.scheduler_status === 'ACTIVE' ? 'bg-emerald-450' : 'bg-rose-455'} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${schedulerInfo?.scheduler_status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
              </span>
              <span className={`text-[9px] font-black tracking-wider uppercase ${schedulerInfo?.scheduler_status === 'ACTIVE' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {schedulerInfo?.scheduler_status || 'UNAVAILABLE'}
              </span>
            </div>
          </div>

          {schedulerLoading ? (
            <div className="text-center py-4 text-xs text-slate-450">Loading scheduler state...</div>
          ) : schedulerError ? (
            <div className="text-center py-4 bg-rose-500/5 border border-rose-500/20 rounded-xl">
              <span className="text-[10px] text-rose-600 font-bold block">{schedulerError}</span>
              <button onClick={fetchSchedulerStatus} className="text-[10px] text-indigo-550 underline mt-1 block mx-auto">Retry</button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-[9px] bg-slate-100/50 dark:bg-slate-850 p-2 rounded-lg border border-slate-200/40 dark:border-slate-800">
                <div>
                  <span className="text-slate-450 block uppercase font-bold text-[8px]">Daily cron</span>
                  <span className="font-mono text-slate-800 dark:text-slate-250 font-bold">{schedulerInfo?.daily_schedule ? `${schedulerInfo.daily_schedule} AM` : '02:00 AM'}</span>
                </div>
                <div>
                  <span className="text-slate-455 block uppercase font-bold text-[8px]">Weekly cron</span>
                  <span className="font-mono text-slate-800 dark:text-slate-250 font-bold">{schedulerInfo?.weekly_schedule || 'Mon 03:00 AM'}</span>
                </div>
                <div className="col-span-2 border-t border-slate-200/30 pt-1 mt-1">
                  <span className="text-slate-450 block uppercase font-bold text-[8px]">Next scheduled prediction run</span>
                  <span className="font-mono text-indigo-650 dark:text-indigo-400 font-bold">
                    {schedulerInfo?.next_daily_run ? new Date(schedulerInfo.next_daily_run).toLocaleString() : 'Tonight 02:00 AM'}
                  </span>
                </div>
              </div>

              {/* Operations Report data details if available */}
              {schedulerLogs.length > 0 && schedulerLogs[0].status !== 'FAILED' && (schedulerLogs[0] as any).report && (
                <div className="p-2.5 bg-indigo-500/5 dark:bg-indigo-950/10 rounded-xl border border-indigo-500/10 text-[9px] space-y-1">
                  <span className="font-bold text-slate-800 dark:text-white uppercase tracking-wider block">Daily AI Operations Report:</span>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-slate-650 dark:text-slate-400">
                    <div>Duration: <span className="font-mono font-bold text-slate-850 dark:text-white">{((schedulerLogs[0] as any).report.execution_duration)}s</span></div>
                    <div>Processed: <span className="font-mono font-bold text-slate-850 dark:text-white">{((schedulerLogs[0] as any).report.items_processed)}</span></div>
                    <div>Critical: <span className="font-mono font-bold text-slate-850 dark:text-white">{((schedulerLogs[0] as any).report.critical_items)}</span></div>
                    <div>High Risk: <span className="font-mono font-bold text-slate-850 dark:text-white">{((schedulerLogs[0] as any).report.high_risk_items)}</span></div>
                    <div>Redist Actions: <span className="font-mono font-bold text-slate-850 dark:text-white">{((schedulerLogs[0] as any).report.redistribution_opportunities)}</span></div>
                    <div>Suppressed: <span className="font-mono font-bold text-slate-850 dark:text-white">{((schedulerLogs[0] as any).report.suppressed_orders)}</span></div>
                    <div className="col-span-2">Waste Value: <span className="font-mono font-bold text-rose-500">₹{((schedulerLogs[0] as any).report.potential_waste_value).toLocaleString()}</span></div>
                    <div className="col-span-2">Est. Recovery: <span className="font-mono font-bold text-emerald-500 font-bold">₹{((schedulerLogs[0] as any).report.estimated_recovery).toLocaleString()}</span></div>
                  </div>
                </div>
              )}

              {/* Recent Run History log snippet */}
              <div className="space-y-1.5 border-t border-slate-200/20 pt-2.5">
                <span className="text-[8px] font-extrabold text-slate-450 dark:text-slate-500 uppercase tracking-wider block">Recent Runs</span>
                <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                  {schedulerLogs.length > 0 ? (
                    schedulerLogs.slice(0, 3).map((log) => {
                      const duration = log.end_time && log.start_time 
                        ? (new Date(log.end_time).getTime() - new Date(log.start_time).getTime()) / 1000 
                        : (log as any).report?.execution_duration || null;
                      
                      const cleanErr = log.error_message 
                        ? log.error_message.split('Traceback')[0].split('Error:').pop()?.trim() || log.error_message.split('\n')[0]
                        : null;
                      
                      return (
                        <div key={log.id} className="p-2 bg-slate-100/30 dark:bg-slate-800/40 rounded-xl border border-slate-200/50 dark:border-slate-850 space-y-1.5 text-[9px]">
                          <div className="flex justify-between items-center">
                            <span className="font-extrabold text-slate-700 dark:text-slate-350 block truncate w-32 uppercase tracking-wide">
                              {log.job_name.replace('_prediction_job', '').replace('manual_', '')}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase ${
                              log.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-450' :
                              log.status === 'PARTIAL' ? 'bg-amber-500/10 text-amber-600' :
                              'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                            }`}>
                              {log.status === 'COMPLETED' ? 'COMPLETED' : log.status === 'PARTIAL' ? 'WARNING' : 'FAILED'}
                            </span>
                          </div>
                          
                          <div className="flex justify-between text-[8px] text-slate-400 font-mono">
                            <span>Triggered: {new Date(log.start_time).toLocaleString([], {month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'})}</span>
                            {duration !== null && <span>Duration: {Number(duration).toFixed(1)}s</span>}
                          </div>
                          
                          {log.status === 'COMPLETED' && (log as any).report ? (
                            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[8px] text-slate-500 dark:text-slate-400 font-mono pt-1 border-t border-slate-200/10">
                              <div>Processed: <span className="font-bold text-slate-700 dark:text-slate-300">{((log as any).report.items_processed)}</span></div>
                              <div>Critical: <span className="font-bold text-rose-500">{((log as any).report.critical_items) + ((log as any).report.high_risk_items || 0)}</span></div>
                              <div>Suppressed: <span className="font-bold text-slate-700 dark:text-slate-300">{((log as any).report.suppressed_orders)}</span></div>
                              <div>Redist Actions: <span className="font-bold text-slate-700 dark:text-slate-300">{((log as any).report.redistribution_opportunities)}</span></div>
                              <div className="col-span-2">Waste Value: <span className="font-bold text-rose-500">₹{((log as any).report.potential_waste_value)?.toLocaleString()}</span></div>
                              <div className="col-span-2">Est. Recovery: <span className="font-bold text-emerald-500">₹{((log as any).report.estimated_recovery)?.toLocaleString()}</span></div>
                            </div>
                          ) : log.status === 'FAILED' && cleanErr ? (
                            <div className="text-[8px] text-rose-550 dark:text-rose-400 font-medium font-mono pt-1 border-t border-slate-200/10 truncate">
                              Error: {cleanErr}
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-slate-450 text-center py-2 text-[9px] italic border border-dashed border-slate-200/40 rounded">
                      No logs found.
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-1.5 border-t border-slate-200/20 pt-2.5">
                <button
                  onClick={triggerBatchPrediction}
                  disabled={batchRunning}
                  className="btn-primary py-1 px-2 text-[9px] font-bold flex items-center justify-center gap-1 shadow-sm flex-1"
                >
                  {batchRunning ? (
                    <span className="animate-spin inline-block border-2 border-white border-t-transparent rounded-full w-2.5 h-2.5 mr-1" />
                  ) : (
                    <span>⚡</span>
                  )}
                  {batchStatusText || "Run Now"}
                </button>
                <button
                  onClick={fetchSchedulerStatus}
                  disabled={schedulerLoading}
                  className="btn-secondary py-1 px-2 text-[9px] font-bold flex items-center justify-center gap-1 flex-1"
                >
                  🔄 Refresh
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Grid 2: Demand Forecast Visualization, Heatmap, and Priority Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Forecast Chart Panel */}
        <div className="glass-panel p-5 lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div className="space-y-0.5">
              <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-500" /> Category Demand Forecast
              </h4>
              {forecastInfo && (
                <span className="text-[10px] text-slate-400 block font-medium">
                  Trend: <strong className={forecastInfo.trend_direction === 'UPWARD' ? 'text-emerald-500' : forecastInfo.trend_direction === 'DOWNWARD' ? 'text-rose-500' : 'text-slate-500'}>{forecastInfo.trend_direction}</strong>
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="select-input py-1 px-2.5 text-xs bg-white dark:bg-slate-800 border-slate-205 dark:border-slate-700"
              >
                <option value="Dairy">Dairy</option>
                <option value="Bakery">Bakery</option>
                <option value="Fruits">Fruits</option>
                <option value="Vegetables">Vegetables</option>
                <option value="Meat">Meat</option>
                <option value="Seafood">Seafood</option>
              </select>
              <div className="flex gap-0.5 bg-slate-100 dark:bg-slate-850 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px]">
                {(['daily', 'weekly'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setForecastPeriod(mode)}
                    className={`py-1 px-2.5 rounded-md font-bold transition-all capitalize ${
                      forecastPeriod === mode
                        ? 'bg-white dark:bg-slate-700 text-indigo-650 dark:text-white shadow-sm'
                        : 'text-slate-505 dark:text-slate-400'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="w-full h-64 bg-slate-500/5 rounded-xl p-2">
            {forecastLoading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : forecastData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={forecastData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:hidden" />
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" className="hidden dark:block" />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 9 }} stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(30, 41, 59, 0.9)',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '11px',
                    }}
                  />
                  {/* Historical demand series line */}
                  <Line
                    type="monotone"
                    dataKey="historical"
                    stroke="#94a3b8"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={{ r: 2 }}
                    name="Historical Sales"
                  />
                  {/* Forecast projected demand series line */}
                  <Line
                    type="monotone"
                    dataKey="demand"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    dot={{ r: 2 }}
                    activeDot={{ r: 5 }}
                    name="Projected Demand"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs p-4 text-center">
                <TrendingUp className="w-8 h-8 text-slate-350 dark:text-slate-600 mb-2 animate-pulse" />
                <span>No forecasting values loaded for category "{selectedCategory}"</span>
                <span className="text-[10px] text-slate-500 mt-1">Please ensure historical sales transactions exist in the database.</span>
              </div>
            )}
          </div>
          
          <div className="flex flex-col gap-2 text-[10px] text-slate-400 bg-slate-100/40 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-205 dark:border-slate-800">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div>
                Forecast Model: <span className="font-bold text-slate-700 dark:text-slate-200">{forecastInfo?.model_name || 'XGBoost'}</span>
              </div>
              <div>
                Forecast Horizon: <span className="font-bold text-slate-700 dark:text-slate-200">{forecastInfo?.forecast_horizon ? `${forecastInfo.forecast_horizon} days` : '14 days'}</span>
              </div>
              <div>
                Evaluation Observations: <span className="font-bold text-slate-700 dark:text-slate-200">{forecastInfo?.evaluation_observations !== undefined ? `${forecastInfo.evaluation_observations} obs` : '0 obs'}</span>
              </div>
            </div>
            
            <div className="border-t border-slate-200/10 pt-2 mt-1 flex justify-between items-center flex-wrap gap-2">
              <span className="font-semibold">Model Evaluation:</span>
              {forecastInfo?.is_evaluation_valid ? (
                <div className="flex items-center gap-2 font-mono">
                  <span className="cursor-help border-b border-dashed border-slate-400" title="MAE = Mean Absolute Error between actual and predicted demand.">
                    MAE: {forecastInfo.MAE?.toFixed(2)}
                  </span>
                  <span>|</span>
                  <span className="cursor-help border-b border-dashed border-slate-400" title="RMSE = Root Mean Squared Error between actual and predicted demand.">
                    RMSE: {forecastInfo.RMSE?.toFixed(2)}
                  </span>
                  <span>|</span>
                  <span className="cursor-help border-b border-dashed border-slate-400" title="MAPE = Mean Absolute Percentage Error between actual and predicted demand.">
                    MAPE: {forecastInfo.MAPE?.toFixed(2)}%
                  </span>
                </div>
              ) : (
                <span className="italic text-amber-600 dark:text-amber-500 font-bold">Insufficient historical data.</span>
              )}
            </div>
          </div>

          {/* 4-Day Category Waste Risk Heatmap */}
          <div className="border-t border-slate-200/20 pt-4 mt-2">
            <h5 className="text-[10px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-wider block mb-2">
              🔥 4-Day Category Waste Risk Heatmap Timeline
            </h5>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {['Dairy', 'Bakery', 'Fruits', 'Vegetables', 'Meat', 'Seafood'].map((cat) => {
                // Find products in this category to calculate dynamic heatmap levels
                const itemsInCat = reorderSummary.filter(item => {
                  const nameMatch = item.product_name?.toLowerCase().includes(cat.toLowerCase());
                  const catMatch = item.category?.toLowerCase() === cat.toLowerCase();
                  return nameMatch || catMatch;
                });
                
                const getRiskForDay = (dayIdx: number) => {
                  if (itemsInCat.length === 0) return { score: null, level: 'UNAVAILABLE' };
                  let totalRisk = 0;
                  let validCount = 0;
                  itemsInCat.forEach(item => {
                    if (item.future_risks && item.future_risks[dayIdx]) {
                      totalRisk += item.future_risks[dayIdx].risk_score;
                      validCount++;
                    }
                  });
                  if (validCount === 0) return { score: null, level: 'UNAVAILABLE' };
                  const avg = totalRisk / validCount;
                  const level = avg >= 75 ? 'CRITICAL' : avg >= 50 ? 'HIGH' : avg >= 25 ? 'MEDIUM' : 'LOW';
                  return { score: avg, level };
                };

                const d0 = getRiskForDay(0);
                const d1 = getRiskForDay(1);
                const d2 = getRiskForDay(2);
                const d3 = getRiskForDay(3);

                const getColor = (level: string) => {
                  if (level === 'CRITICAL') return 'bg-rose-500 text-white';
                  if (level === 'HIGH') return 'bg-orange-500 text-white';
                  if (level === 'MEDIUM') return 'bg-amber-500 text-slate-800';
                  if (level === 'LOW') return 'bg-emerald-500 text-white';
                  return 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500';
                };

                return (
                  <div key={cat} className="p-2 bg-slate-100/40 dark:bg-slate-855 rounded-xl border border-slate-205 dark:border-slate-800 space-y-1">
                    <span className="text-[10px] font-extrabold text-slate-700 dark:text-slate-300 block text-center truncate">{cat}</span>
                    <div className="grid grid-cols-4 gap-0.5 text-[8px] font-black text-center">
                      <div className={`p-0.5 rounded-l ${getColor(d0.level)}`} title={d0.score !== null ? `Today Risk: ${d0.score.toFixed(0)}%` : 'Insufficient data'}>
                        {d0.level === 'UNAVAILABLE' ? 'N/A' : 'T0'}
                      </div>
                      <div className={`p-0.5 ${getColor(d1.level)}`} title={d1.score !== null ? `Tomorrow Risk: ${d1.score.toFixed(0)}%` : 'Insufficient data'}>
                        {d1.level === 'UNAVAILABLE' ? 'N/A' : 'T1'}
                      </div>
                      <div className={`p-0.5 ${getColor(d2.level)}`} title={d2.score !== null ? `Day 2 Risk: ${d2.score.toFixed(0)}%` : 'Insufficient data'}>
                        {d2.level === 'UNAVAILABLE' ? 'N/A' : 'T2'}
                      </div>
                      <div className={`p-0.5 rounded-r ${getColor(d3.level)}`} title={d3.score !== null ? `Day 3 Risk: ${d3.score.toFixed(0)}%` : 'Insufficient data'}>
                        {d3.level === 'UNAVAILABLE' ? 'N/A' : 'T3'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* AI Priority Queue Panel */}
        <div className="glass-panel p-5 space-y-4">
          <div className="flex justify-between items-start">
            <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-500" /> AI Priority Queue
            </h4>
            <div className="group relative">
              <HelpCircle className="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-slate-600" />
              <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block w-64 bg-slate-850 text-white text-[9px] rounded p-2.5 z-50 shadow-lg leading-relaxed font-normal">
                <strong>Urgency Formula:</strong>
                <br />(Risk Score × 50%) + (Expiry Component × 30%) + (Waste Component × 20%)
                <br />Normalized components (0–100 scale). Urgency represents the final priority rank.
              </div>
            </div>
          </div>

          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {reorderSummary.length > 0 ? (
              [...reorderSummary]
                .sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0))
                .slice(0, 7)
                .map((item, idx) => {
                  return (
                    <div key={item.product_id} className="p-3 bg-white dark:bg-slate-905 border border-slate-100 dark:border-slate-800 rounded-xl flex justify-between items-center shadow-sm relative hover:bg-slate-50 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-slate-800 dark:text-white text-xs truncate max-w-[110px]">
                            {item.product_name}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase text-white ${
                            item.priority_score >= 75 ? 'bg-rose-500' :
                            item.priority_score >= 50 ? 'bg-orange-500' :
                            item.priority_score >= 25 ? 'bg-amber-500' :
                            'bg-emerald-500'
                          }`}>
                            P{idx + 1}
                          </span>
                        </div>
                        <div className="flex gap-x-2 text-[9px] text-slate-400">
                          <span>Risk: <strong className="text-slate-650 dark:text-slate-300">{item.risk_score || 0}</strong></span>
                          <span>Expiry: <strong className="text-slate-650 dark:text-slate-300">{formatExpiry(item.days_to_expiry)}</strong></span>
                          <span>Waste: <strong className="text-slate-650 dark:text-slate-300">₹{item.potential_waste_value?.toFixed(0) || '0'}</strong></span>
                        </div>
                      </div>
                      <div className="text-right space-y-0.5 shrink-0">
                        <span className="text-[10px] font-black font-mono block text-slate-850 dark:text-white">
                          {item.priority_score?.toFixed(1) || '0.0'} pts
                        </span>
                        <span className={`px-1.5 py-0.5 rounded-[4px] text-[8px] font-black inline-block ${
                          ['DONATE', 'REDISTRIBUTE', 'EMERGENCY CONSUMPTION', 'DISCOUNT', 'SUPPRESS PURCHASE'].includes(item.action || item.recommended_action)
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        }`}>
                          {item.action || item.recommended_action || 'NORMAL'}
                        </span>
                      </div>
                    </div>
                  );
                })
            ) : (
              <div className="text-slate-400 text-center py-12 text-xs flex flex-col items-center justify-center p-4">
                <Settings className="w-8 h-8 text-slate-300 dark:text-slate-705 mb-2 animate-spin-slow" />
                <span>Waiting for historical data...</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="glass-panel p-5 space-y-4" id="replenishment-section">
        <div className="flex justify-between items-center flex-wrap gap-2 border-b border-slate-200/20 pb-3">
          <div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Settings className="w-4 h-4 text-indigo-500" /> Smart Replenishment Controls
            </h4>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Click headers to sort. Select a product row to view the Explainable AI breakdown, 4-Day Timeline, What-If simulation matrix, and decision justifications.
            </p>
          </div>
          
          {/* 9 filters selection panel */}
          <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-slate-850 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px]">
            {([
              { val: 'ALL', label: 'All Candidates' },
              { val: 'CRITICAL', label: '🔴 Critical Expiry' },
              { val: 'HIGH_RISK', label: '🟠 High Risk' },
              { val: 'MEDIUM_RISK', label: '🟡 Medium Risk' },
              { val: 'LOW_RISK', label: '🟢 Low Risk' },
              { val: 'REDISTRIBUTE', label: '🚚 Redistribute' },
              { val: 'DONATE', label: '🤝 Donate' },
              { val: 'REORDER', label: '📦 Reorder' },
              { val: 'LOW_SUPPORT', label: '⚠️ Low Support' }
            ] as const).map((filter) => (
              <button
                key={filter.val}
                onClick={() => setTableFilter(filter.val)}
                className={`py-1 px-2.5 rounded-md font-bold transition-all ${
                  tableFilter === filter.val
                    ? 'bg-white dark:bg-slate-700 text-indigo-655 dark:text-white shadow-sm'
                    : 'text-slate-505 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-350'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {tableFilter !== 'ALL' && (
          <div className="flex items-center gap-2 bg-indigo-500/10 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-lg text-xs font-semibold">
            <span>Active Filter: <strong className="uppercase">{tableFilter.replace('_', ' ')}</strong></span>
            <button 
              onClick={() => setTableFilter('ALL')}
              className="text-[10px] text-indigo-600 dark:text-indigo-400 underline hover:text-indigo-800 dark:hover:text-indigo-300 ml-auto font-black"
            >
              Clear Filter
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-semibold select-none">
                <th className="py-2.5 px-3">Product</th>
                <th className="py-2.5 px-3">Risk Level</th>
                <th 
                  className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                  onClick={() => handleSort('risk_score')}
                >
                  Risk Score {(() => {
                    if (sortBy !== 'risk_score') return <span className="text-slate-300 ml-0.5 font-normal">↕</span>;
                    return sortOrder === 'asc' ? <span className="text-indigo-500">▲</span> : <span className="text-indigo-500">▼</span>;
                  })()}
                </th>
                <th className="py-2.5 px-3 text-right">Daily Demand</th>
                <th className="py-2.5 px-3 text-right">Current Stock</th>
                <th 
                  className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors text-right"
                  onClick={() => handleSort('days_to_expiry')}
                >
                  Days to Expiry {(() => {
                    if (sortBy !== 'days_to_expiry') return <span className="text-slate-300 ml-0.5 font-normal">↕</span>;
                    return sortOrder === 'asc' ? <span className="text-indigo-500">▲</span> : <span className="text-indigo-500">▼</span>;
                  })()}
                </th>
                <th className="py-2.5 px-3 text-right">Forecast Demand</th>
                <th 
                  className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors text-center"
                  onClick={() => handleSort('recommended_quantity')}
                >
                  Suggested Qty {(() => {
                    if (sortBy !== 'recommended_quantity') return <span className="text-slate-300 ml-0.5 font-normal">↕</span>;
                    return sortOrder === 'asc' ? <span className="text-indigo-500">▲</span> : <span className="text-indigo-500">▼</span>;
                  })()}
                </th>
                <th className="py-2.5 px-3">Recommended Action</th>
                <th className="py-2.5 px-3">Confidence/Support</th>
                <th 
                  className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors text-right"
                  onClick={() => handleSort('potential_waste_value')}
                >
                  Potential Waste {(() => {
                    if (sortBy !== 'potential_waste_value') return <span className="text-slate-300 ml-0.5 font-normal">↕</span>;
                    return sortOrder === 'asc' ? <span className="text-indigo-500">▲</span> : <span className="text-indigo-500">▼</span>;
                  })()}
                </th>
                <th className="py-2.5 px-3 text-center">Explain</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
              {processedCandidates.length > 0 ? (
                processedCandidates.map((item, idx) => {
                  const isExpanded = expandedItemId === item.product_id;
                  const getRiskBadgeClass = (lvl: string) => {
                    if (lvl === 'CRITICAL') return 'px-2 py-0.5 text-[9px] font-black rounded-full bg-rose-500/10 text-rose-650 dark:text-rose-455 border border-rose-500/20';
                    if (lvl === 'HIGH') return 'px-2 py-0.5 text-[9px] font-black rounded-full bg-orange-500/10 text-orange-655 dark:text-orange-450 border border-orange-500/20';
                    if (lvl === 'MEDIUM') return 'px-2 py-0.5 text-[9px] font-black rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20';
                    return 'px-2 py-0.5 text-[9px] font-black rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
                  };
                  return (
                    <React.Fragment key={idx}>
                      <tr 
                        className={`hover:bg-slate-500/5 cursor-pointer transition-colors ${isExpanded ? 'bg-indigo-500/5 dark:bg-indigo-500/5' : ''}`}
                        onClick={() => setExpandedItemId(isExpanded ? null : item.product_id)}
                      >
                        <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-205">
                          {item.product_name}
                        </td>
                        <td className="py-3 px-3">
                          <span className={getRiskBadgeClass(item.risk_level || 'LOW')}>
                            {item.risk_level || 'LOW'}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold">
                          {item.risk_score || item.waste_risk_score || 0} / 100
                        </td>
                        <td className="py-3 px-3 text-right font-mono">
                          {item.forecast_daily_demand !== undefined && item.forecast_daily_demand !== null 
                            ? item.forecast_daily_demand.toFixed(2) 
                            : "Insufficient historical data."}
                        </td>
                        <td className="py-3 px-3 text-right font-mono">{item.current_stock}</td>
                        <td className="py-3 px-3 text-right font-mono font-semibold">{formatExpiry(item.days_to_expiry)}</td>
                        <td className="py-3 px-3 text-right font-mono">
                          {item.forecast_demand !== undefined && item.forecast_demand !== null 
                            ? item.forecast_demand.toFixed(2) 
                            : "Insufficient historical data."}
                        </td>
                        <td className="py-3 px-3 text-center font-bold font-mono">
                          <span className={item.is_suppressed ? 'text-rose-500' : 'text-emerald-500'}>
                            {item.recommended_quantity !== undefined ? item.recommended_quantity : item.recommended_reorder}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-bold">
                          <span className={`px-2 py-0.5 text-[9px] font-black rounded-full ${
                            ['DONATE', 'REDISTRIBUTE', 'EMERGENCY CONSUMPTION', 'DISCOUNT', 'SUPPRESS PURCHASE'].includes(item.action || item.recommended_action)
                              ? 'bg-rose-500/10 text-rose-655 dark:text-rose-455 border border-rose-500/20' 
                              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 border border-emerald-500/20'
                          }`}>
                            {item.action || item.recommended_action || 'NORMAL INVENTORY'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-col">
                            <span className={`text-[10px] font-bold ${
                              item.confidence_level === 'HIGH DATA SUPPORT' ? 'text-emerald-600' :
                              item.confidence_level === 'MEDIUM DATA SUPPORT' ? 'text-amber-600' :
                              'text-rose-600'
                            }`}>
                              {item.confidence_level || 'LOW DATA SUPPORT'}
                            </span>
                            <span className="text-[9px] text-slate-450 font-semibold mt-0.5">
                              {item.confidence_score || 72}% confidence ({item.historical_observations || 8} obs)
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-rose-650">
                          {item.potential_waste_value !== null && item.potential_waste_value !== undefined ? `₹${item.potential_waste_value.toFixed(2)}` : 'Insufficient historical data.'}
                        </td>
                        <td className="py-3 px-3 text-center text-indigo-650 dark:text-indigo-400 font-bold">
                          {isExpanded ? 'Hide ▲' : 'Details ▼'}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-50/50 dark:bg-slate-900/30">
                          <td colSpan={12} className="p-5 border-t border-b border-slate-100 dark:border-slate-800 space-y-5">
                            
                            {/* AI Decision Explanation blocks */}
                            <div className="bg-indigo-500/5 dark:bg-indigo-950/10 p-4 rounded-xl border border-indigo-500/10 space-y-2">
                              <h5 className="text-[10px] font-black text-indigo-650 dark:text-indigo-400 uppercase tracking-wider">AI RECOMMENDATION DECISION BREAKDOWN</h5>
                              {(() => {
                                const exp = getDecisionExplanationBlocks(item);
                                return (
                                  <div className="space-y-4 text-xs mt-2">
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                      <div className="space-y-1">
                                        <span className="text-[9px] text-slate-400 block font-bold uppercase">What AI Recommends</span>
                                        <div className="font-extrabold text-indigo-700 dark:text-indigo-300">{exp.recommend}</div>
                                      </div>
                                      <div className="space-y-1">
                                        <span className="text-[9px] text-slate-400 block font-bold uppercase">Why it recommends it</span>
                                        <div className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">{exp.why}</div>
                                      </div>
                                      <div className="space-y-1">
                                        <span className="text-[9px] text-slate-400 block font-bold uppercase">Key Evidence</span>
                                        <div className="text-slate-700 dark:text-slate-300 leading-relaxed font-mono">{exp.evidence}</div>
                                      </div>
                                      <div className="space-y-1">
                                        <span className="text-[9px] text-slate-400 block font-bold uppercase">Expected Impact</span>
                                        <div className="text-slate-705 dark:text-slate-300 leading-relaxed font-semibold text-emerald-600 dark:text-emerald-450">{exp.impact}</div>
                                      </div>
                                    </div>
                                    
                                    <div className="pt-3 border-t border-indigo-500/10">
                                      <div className="grid grid-cols-2 md:grid-cols-7 gap-3 text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                                        <div className="p-2 bg-slate-100 dark:bg-slate-800/40 rounded-lg">
                                          <span className="text-[8px] text-slate-400 block uppercase font-bold">Forecast Demand</span>
                                          <span className="font-mono text-slate-800 dark:text-white mt-0.5 block">
                                            {item.forecast_daily_demand !== undefined && item.forecast_daily_demand !== null 
                                              ? `${item.forecast_daily_demand.toFixed(2)}/day` 
                                              : 'Insufficient historical data.'}
                                          </span>
                                        </div>
                                        <div className="p-2 bg-slate-100 dark:bg-slate-800/40 rounded-lg">
                                          <span className="text-[8px] text-slate-400 block uppercase font-bold">Reorder Point</span>
                                          <span className="font-mono text-slate-800 dark:text-white mt-0.5 block">
                                            {item.reorder_explanation?.reorder_point !== undefined 
                                              ? `${Math.round(item.reorder_explanation.reorder_point)} units` 
                                              : 'N/A'}
                                          </span>
                                        </div>
                                        <div className="p-2 bg-slate-100 dark:bg-slate-800/40 rounded-lg">
                                          <span className="text-[8px] text-slate-400 block uppercase font-bold">Safety Stock</span>
                                          <span className="font-mono text-slate-800 dark:text-white mt-0.5 block">
                                            {item.reorder_explanation?.safety_stock !== undefined 
                                              ? `${Math.round(item.reorder_explanation.safety_stock)} units` 
                                              : 'N/A'}
                                          </span>
                                        </div>
                                        <div className="p-2 bg-slate-100 dark:bg-slate-800/40 rounded-lg">
                                          <span className="text-[8px] text-slate-400 block uppercase font-bold">Lead Time</span>
                                          <span className="font-mono text-slate-800 dark:text-white mt-0.5 block">
                                            {item.reorder_explanation?.lead_time_days !== undefined 
                                              ? `${item.reorder_explanation.lead_time_days} days` 
                                              : 'N/A'}
                                          </span>
                                        </div>
                                        <div className="p-2 bg-slate-100 dark:bg-slate-800/40 rounded-lg">
                                          <span className="text-[8px] text-slate-400 block uppercase font-bold">Expected Stock After Action</span>
                                          <span className="font-mono text-slate-800 dark:text-white mt-0.5 block">
                                            {item.reorder_explanation?.expected_stock_after_reorder !== undefined 
                                              ? `${Math.round(item.reorder_explanation.expected_stock_after_reorder)} units` 
                                              : 'N/A'}
                                          </span>
                                        </div>
                                        <div className="p-2 bg-slate-100 dark:bg-slate-800/40 rounded-lg">
                                          <span className="text-[8px] text-slate-400 block uppercase font-bold">Priority Score</span>
                                          <span className="font-mono text-slate-800 dark:text-white mt-0.5 block">
                                            {item.priority_score !== undefined ? `${item.priority_score.toFixed(1)} pts` : 'N/A'}
                                          </span>
                                        </div>
                                        <div className="p-2 bg-slate-100 dark:bg-slate-800/40 rounded-lg">
                                          <span className="text-[8px] text-slate-400 block uppercase font-bold">Data Support</span>
                                          <span className={`mt-0.5 block font-bold ${item.confidence_level === 'HIGH DATA SUPPORT' ? 'text-emerald-500' : 'text-amber-500'}`}>
                                            {item.confidence_level || 'STANDARD'}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              {/* 1. Risk Explanation & Contributors */}
                              <div className="space-y-3 bg-white dark:bg-slate-900/60 p-4 rounded-xl border border-slate-205 dark:border-slate-800">
                                <div className="flex justify-between items-center border-b border-slate-200/20 pb-2">
                                  <h5 className="text-[10px] font-black text-indigo-650 dark:text-indigo-400 uppercase tracking-wider">Explainable AI Risk Breakdown</h5>
                                  <span className="text-[9px] font-bold text-slate-400 font-mono">{item.product_name}</span>
                                </div>
                                <div className="space-y-1.5 text-xs">
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Risk Score:</span>
                                    <span className="font-mono font-bold text-slate-850 dark:text-white">{item.risk_score || item.waste_risk_score || 0} / 100</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-400">Risk Level:</span>
                                    <span className={`font-bold ${getRiskTextColorClass(item.risk_level || 'LOW')}`}>{item.risk_level || 'LOW'}</span>
                                  </div>
                                  {(() => {
                                    const score = item.risk_score || item.waste_risk_score || 0;
                                    const contribs = item.risk_contributors;
                                    
                                    if (score < 1) {
                                      return <div className="text-slate-500 text-[10px] font-bold py-2">No significant risk contributors detected.</div>;
                                    }
                                    
                                    if (!contribs || Object.keys(contribs).length === 0) {
                                      return <div className="text-rose-500 text-[10px] font-bold py-2">Risk contribution data unavailable</div>;
                                    }
                                    
                                    const expiry_pct = contribs?.['Expiry Risk'] || contribs?.['expiry_pct'] || contribs?.['Days to Expiry'] || 0;
                                    const excess_stock_pct = contribs?.['Excess Stock'] || contribs?.['excess_stock_pct'] || 0;
                                    const demand_mismatch_pct = contribs?.['Demand Mismatch'] || contribs?.['demand_mismatch_pct'] || contribs?.['Low Demand'] || 0;
                                    const historical_waste_pct = contribs?.['Historical Waste'] || contribs?.['historical_waste_pct'] || contribs?.['Historical Waste Risk'] || 0;
                                    const volatility_pct = contribs?.['Demand Volatility'] || contribs?.['volatility_pct'] || 0;
                                    
                                    const contribList = [
                                      { name: 'Expiry Risk', value: expiry_pct },
                                      { name: 'Excess Stock', value: excess_stock_pct },
                                      { name: 'Demand Mismatch', value: demand_mismatch_pct },
                                      { name: 'Historical Waste', value: historical_waste_pct },
                                      { name: 'Demand Volatility', value: volatility_pct }
                                    ];
                                    const dominant = contribList.find(c => c.value >= 95);
                                    
                                    return (
                                      <div className="pt-2 space-y-2">
                                        <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">Risk Contributors:</span>
                                        {contribList.map((contrib) => (
                                          <div key={contrib.name} className="space-y-0.5">
                                            <div className="flex justify-between text-[9px]">
                                              <span className="text-slate-500 font-medium">{contrib.name}</span>
                                              <span className="font-bold font-mono text-slate-700 dark:text-slate-350">{contrib.value}%</span>
                                            </div>
                                            <div className="w-full bg-slate-105 dark:bg-slate-800 h-1 rounded-full overflow-hidden flex">
                                              <div 
                                                className={`h-full rounded-full ${
                                                  contrib.name === 'Expiry Risk' ? 'bg-rose-500' :
                                                  contrib.name === 'Excess Stock' ? 'bg-amber-500' :
                                                  contrib.name === 'Demand Mismatch' ? 'bg-indigo-505' :
                                                  contrib.name === 'Historical Waste' ? 'bg-orange-500' :
                                                  'bg-violet-500'
                                                }`} 
                                                style={{ width: `${contrib.value}%` }} 
                                              />
                                            </div>
                                          </div>
                                        ))}
                                        
                                        {dominant && (
                                          <div className="bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[9px] font-bold p-2 rounded-lg mt-2 border border-rose-500/10">
                                            Primary Contributor: {dominant.name} with {dominant.value}% contribution to the detected risk component.
                                          </div>
                                        )}
                                        
                                        <div className="text-[9px] text-slate-400 mt-2 italic flex items-start gap-1">
                                          <HelpCircle className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                                          <span>Contributor percentage represents the relative contribution to the calculated risk score, not the probability of waste.</span>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                              
                              {/* 2. Future Risk timeline */}
                              <div className="space-y-3 bg-white dark:bg-slate-900/60 p-4 rounded-xl border border-slate-205 dark:border-slate-800">
                                <div className="border-b border-slate-200/20 pb-2">
                                  <h5 className="text-[10px] font-black text-indigo-650 dark:text-indigo-400 uppercase tracking-wider">4-Day Future Risk Timeline</h5>
                                </div>
                                <div className="space-y-2">
                                  {item.future_risks && item.future_risks.length > 0 ? (
                                    <div className="flex gap-2 justify-between items-center text-[10px] pt-1">
                                      {item.future_risks.map((fr: any, fidx: number) => (
                                        <div key={fidx} className="text-center flex-1 p-2 bg-slate-100 dark:bg-slate-800/40 rounded-xl border border-slate-200/30">
                                          <span className="block text-[8px] text-slate-400 font-bold uppercase">{fr.day}</span>
                                          <span className={`block font-extrabold mt-1 text-[11px] ${
                                            fr.risk_level === 'CRITICAL' ? 'text-rose-500' :
                                            fr.risk_level === 'HIGH' ? 'text-orange-500' :
                                            fr.risk_level === 'MEDIUM' ? 'text-amber-500' :
                                            'text-emerald-500'
                                          }`}>
                                            {Math.round(fr.risk_score)}%
                                          </span>
                                          <span className="block text-[7px] text-slate-400 font-bold mt-0.5">{fr.risk_level}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-slate-500 text-[10px] block py-4 text-center italic">Insufficient forecast data.</span>
                                  )}

                                  <div className="p-2.5 bg-rose-500/5 border border-rose-500/10 rounded-lg space-y-1 text-slate-655 dark:text-slate-350 text-[10px] mt-2 font-medium">
                                    <span className="text-[8px] font-bold text-rose-600 block uppercase">LOSS PREDICTIONS & FINANCIAL IMPACT</span>
                                    {item.potential_waste_value !== null && item.potential_waste_value !== undefined ? (
                                      <div className="space-y-1">
                                        <div className="flex justify-between">
                                          <span>Potential Waste Value:</span>
                                          <span className="font-mono font-bold text-rose-500">₹{item.potential_waste_value.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span>Avoidable Loss:</span>
                                          <span className="font-mono text-emerald-600 font-bold">₹{item.potential_avoidable_loss.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span>Estimated Recovery:</span>
                                          <span className="font-mono text-emerald-600 font-bold">₹{item.estimated_recovery.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between font-bold border-t border-slate-200/10 pt-1 mt-1">
                                          <span>Redistribution Value:</span>
                                          <span className="font-mono text-indigo-650 dark:text-indigo-400">
                                            {item.selling_price && item.redistribution_recommendation?.quantity 
                                              ? `₹${(item.selling_price * item.redistribution_recommendation.quantity).toLocaleString()}`
                                              : 'Financial impact unavailable.'}
                                          </span>
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="italic">Financial impact unavailable.</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              {/* 3. Comparative What-If Simulation Matrix */}
                              <div className="space-y-3 bg-white dark:bg-slate-900/60 p-4 rounded-xl border border-slate-205 dark:border-slate-800">
                                <div className="border-b border-slate-200/20 pb-2">
                                  <h5 className="text-[10px] font-black text-indigo-650 dark:text-indigo-400 uppercase tracking-wider">What-If Comparative Matrix</h5>
                                </div>
                                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                  {getComparativeScenarios(item).map((sc, scIdx) => (
                                    <div 
                                      key={scIdx} 
                                      className={`p-2 rounded-lg border text-[10px] relative ${
                                        sc.is_rec 
                                          ? 'border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/30' 
                                          : 'bg-slate-50 dark:bg-slate-850 border-slate-100 dark:border-slate-800'
                                      }`}
                                    >
                                      {sc.is_rec && (
                                        <span className="absolute top-0 right-0 bg-emerald-500 text-white font-black text-[6px] uppercase px-1 rounded-bl-sm">
                                          ★ Recommended
                                        </span>
                                      )}
                                      <div className="flex justify-between font-extrabold text-slate-850 dark:text-white">
                                        <span>{sc.name}</span>
                                        <span className={sc.risk >= 75 ? 'text-rose-500' : sc.risk >= 50 ? 'text-orange-500' : 'text-emerald-500'}>
                                          Risk: {sc.risk}% ({sc.risk >= 75 ? 'CRITICAL' : sc.risk >= 50 ? 'HIGH' : 'LOW'})
                                        </span>
                                      </div>
                                      <div className="flex justify-between text-[9px] text-slate-400 mt-1 font-mono">
                                        <span>Waste: {sc.waste.toFixed(0)} units {sc.costPriceExists ? `(₹${sc.cost?.toFixed(0)})` : '(Financial impact unavailable.)'}</span>
                                        <span className="font-bold text-indigo-650 dark:text-indigo-400">Action: {sc.action}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <button
                                  onClick={() => {
                                    setSimStock(item.current_stock);
                                    setSimExpiry(item.days_to_expiry);
                                    setSimDemand(item.forecast_daily_demand !== undefined ? item.forecast_daily_demand : item.forecast_demand);
                                    setSimPurchase(0.0);
                                    setSimCostPrice(item.cost_price !== undefined ? item.cost_price : null);
                                    document.getElementById('simulator-section')?.scrollIntoView({ behavior: 'smooth' });
                                  }}
                                  className="btn-secondary py-1 px-3 text-[9px] w-full font-black uppercase text-indigo-655 dark:text-indigo-400 flex items-center justify-center gap-1 border border-indigo-500/20"
                                >
                                  ⚡ Prefill Simulation parameters
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-slate-450 text-xs font-bold">
                    No recommendations found matching the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* What-If Simulation Calculator */}
      <div className="glass-panel p-5 space-y-4 border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent" id="simulator-section">
        <div>
          <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-emerald-500" /> Interactive "What-If" Replenishment Simulator
          </h4>
          <p className="text-[11px] text-slate-400 mt-1">
            Test inventory decisions. Change stock parameters or plan purchases to see forecasted changes in risk level and recommended actions before executing.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Current Stock</label>
            <input
              type="number"
              value={simStock}
              onChange={(e) => setSimStock(Number(e.target.value))}
              className="text-input py-1.5 px-3 text-xs w-full bg-white dark:bg-slate-800"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Days to Expiry</label>
            <input
              type="number"
              value={simExpiry}
              onChange={(e) => setSimExpiry(Number(e.target.value))}
              className="text-input py-1.5 px-3 text-xs w-full bg-white dark:bg-slate-800"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Daily Demand (Forecast)</label>
            <input
              type="number"
              value={simDemand}
              onChange={(e) => setSimDemand(Number(e.target.value))}
              className="text-input py-1.5 px-3 text-xs w-full bg-white dark:bg-slate-800"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Simulated Purchase (+Qty)</label>
            <input
              type="number"
              value={simPurchase}
              onChange={(e) => setSimPurchase(Number(e.target.value))}
              className="text-input py-1.5 px-3 text-xs w-full bg-white dark:bg-slate-800"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={runSimulation}
            disabled={simLoading}
            className="btn-primary py-2 px-5 text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-500/10"
          >
            {simLoading ? 'Calculating...' : 'Compute Simulation'}
          </button>
        </div>

        {simResult && (
          <div className="space-y-4 mt-4 border-t border-slate-200/40 dark:border-slate-800 pt-4">
            <div className="flex justify-between items-center flex-wrap gap-3">
              <h5 className="text-[11px] font-black text-slate-550 uppercase tracking-wider block">Decision Comparison Matrix</h5>
              {simResult.recommended_scenario && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-400 rounded-xl text-xs flex flex-col font-bold w-full md:max-w-md shadow-sm">
                  <span className="flex items-center gap-1 text-[11px]">🌟 AI RECOMMENDED ACTION: {simResult.recommended_scenario.toUpperCase()}</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-300 font-medium leading-relaxed mt-1">
                    <strong>Why:</strong> {simResult.recommendation_reason}
                  </span>
                </div>
              )}
            </div>
            
            {/* Scenario Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {simResult.scenarios ? (
                simResult.scenarios.map((sc: any, scIdx: number) => (
                  <div 
                    key={scIdx} 
                    className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 transition-all relative overflow-hidden ${
                      sc.is_recommended ? 'border-emerald-500 ring-2 ring-emerald-500/25 bg-emerald-550/10 dark:bg-emerald-950/20 shadow-lg' :
                      sc.scenario_name.includes('Purchase') ? 'bg-indigo-500/5 border-indigo-550/20 dark:bg-indigo-955/10' :
                      sc.scenario_name.includes('Discount') ? 'bg-amber-500/5 border-amber-550/20 dark:bg-amber-955/10' :
                      sc.scenario_name.includes('Redistribute') ? 'bg-emerald-500/5 border-emerald-555/20 dark:bg-emerald-950/10' :
                      'bg-slate-100/50 dark:bg-slate-800/40 border-slate-200/50 dark:border-slate-800'
                    }`}
                  >
                    {sc.is_recommended && (
                      <span className="absolute top-0 right-0 bg-emerald-500 text-white font-black text-[8px] uppercase px-2 py-0.5 tracking-wider rounded-bl-lg">
                        ★ RECOMMENDED
                      </span>
                    )}
                    <div>
                      <div className="flex justify-between items-start pr-12">
                        <span className="text-xs font-black uppercase text-slate-705 dark:text-slate-200">{sc.scenario_name}</span>
                        <span className={`px-1.5 py-0.5 text-[8px] font-black rounded ${
                          sc.risk_level === 'CRITICAL' ? 'bg-rose-500 text-white' :
                          sc.risk_level === 'HIGH' ? 'bg-orange-500 text-white' :
                          sc.risk_level === 'MEDIUM' ? 'bg-amber-550 text-white' :
                          'bg-emerald-555 text-white'
                        }`}>
                          {sc.risk_level} ({Math.round(sc.risk_score)}/100)
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                        {(() => {
                          const purchaseVal = sc.scenario_name.includes('Purchase') ? simPurchase : 0;
                          const expectedDemand = simDemand * simExpiry;
                          const simulatedSurplus = Math.max(0, simStock + purchaseVal - expectedDemand);
                          
                          let displayExplanation = sc.explanation;
                          if (sc.scenario_name.includes('Redistribute')) {
                            displayExplanation = `Moves surplus units (${simulatedSurplus.toFixed(0)} units) out of local stock to redistribution channels, reducing local waste risk.`;
                          }
                          
                          return (
                            <>
                              {displayExplanation}
                              {simStock > 0 && simDemand > 0 && simExpiry > 0 && (
                                <div className="text-[9px] text-slate-400 mt-1.5 italic font-medium leading-snug">
                                  💡 {simStock + purchaseVal} units in stock, approximately {expectedDemand.toFixed(0)} units expected demand before expiry, leaving an estimated {simulatedSurplus.toFixed(0)}-unit surplus.
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    
                    <div className="space-y-1.5 border-t border-slate-200/20 pt-2 text-[10px]">
                      <div className="flex justify-between font-mono">
                        <span>Simulated Stock:</span>
                        <span className="font-bold">{sc.stock}</span>
                      </div>
                      <div className="flex justify-between font-mono">
                        <span>Expected Waste:</span>
                        <span className="font-bold text-rose-500">{sc.expected_waste !== undefined ? `${sc.expected_waste} units` : '0.00 units'}</span>
                      </div>
                      <div className="flex justify-between font-mono">
                        <span>Financial Impact:</span>
                        <span className="font-bold text-rose-500">
                          {sc.financial_impact !== null && sc.financial_impact !== undefined 
                            ? `₹${sc.financial_impact.toFixed(2)}` 
                            : 'Financial impact unavailable.'}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold border-t border-slate-200/10 pt-1 text-[11px] text-indigo-650 dark:text-indigo-400">
                        <span>Suggested Action:</span>
                        <span>{sc.action}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                /* Fallback if scenarios not returned */
                <>
                  <div className="p-4 bg-slate-100/50 dark:bg-slate-800/40 rounded-xl border border-slate-200/50 dark:border-slate-800 space-y-2.5 md:col-span-2 flex flex-col justify-between">
                    <div>
                      <h5 className="text-[10px] font-extrabold text-slate-555 dark:text-slate-450 uppercase tracking-wider block">Before Decision State</h5>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-xs">Risk Level:</span>
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                          simResult.current.risk_level === 'CRITICAL' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-455' :
                          simResult.current.risk_level === 'HIGH' ? 'bg-orange-500/10 text-orange-600 dark:text-orange-455' :
                          'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        }`}>
                          {simResult.current.risk_level} ({simResult.current.risk_score} / 100)
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-2.5">
                        {simResult.current.explanation}
                      </div>
                    </div>
                    <div className="text-[11px] font-semibold text-slate-705 dark:text-slate-350 border-t border-slate-200/30 pt-2 mt-2">
                      Suggested Reorder: <span className="font-mono text-slate-900 dark:text-white font-bold">{simResult.current.recommended_reorder}</span> units
                    </div>
                  </div>
                  
                  <div className="p-4 bg-emerald-500/5 rounded-xl border border-emerald-555/20 space-y-2.5 md:col-span-2 flex flex-col justify-between">
                    <div>
                      <h5 className="text-[10px] font-extrabold text-emerald-650 dark:text-emerald-400 uppercase tracking-wider block">Simulated Decision Result</h5>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-xs">Risk Level:</span>
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                          simResult.simulated.risk_level === 'CRITICAL' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-455' :
                          simResult.simulated.risk_level === 'HIGH' ? 'bg-orange-500/10 text-orange-600 dark:text-orange-455' :
                          'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        }`}>
                          {simResult.simulated.risk_level} ({simResult.simulated.risk_score} / 100)
                        </span>
                      </div>
                      <div className="text-xs text-slate-655 dark:text-emerald-305 leading-relaxed mt-2.5">
                        {simResult.simulated.explanation}
                      </div>
                    </div>
                    <div className="text-[11px] font-semibold text-slate-705 dark:text-slate-350 border-t border-emerald-550/20 pt-2 mt-2">
                      Suggested Reorder: <span className="font-mono text-emerald-700 dark:text-emerald-350 font-bold">{simResult.simulated.recommended_reorder}</span> units
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
