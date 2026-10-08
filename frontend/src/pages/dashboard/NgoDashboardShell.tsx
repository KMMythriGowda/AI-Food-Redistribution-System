import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { 
  HeartHandshake, 
  LogOut,
  Moon,
  Sun,
  Search,
  MapPin,
  Calendar,
  Shield,
  CheckCircle,
  XCircle,
  Truck,
  FileText,
  RefreshCw,
  ShoppingBag,
  Bell,
  Trash2,
  Award,
  Info
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { 
  marketplaceService, 
  SurplusListing, 
  MarketplaceOrder, 
  DonorProfile, 
  NgoRequirement, 
  Notification as InAppNotification, 
  NgoImpact 
} from '@/services/marketplace';
import MapComponent from '@/components/maps/MapComponent';

export const NgoDashboardShell: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Tab State
  const [activeTab, setActiveTab] = useState<'marketplace' | 'matches' | 'orders' | 'pickups' | 'impact'>('marketplace');

  // Marketplace lists & filters
  const [listings, setListings] = useState<SurplusListing[]>([]);
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [listingType, setListingType] = useState('');
  const [expiryDays, setExpiryDays] = useState('');
  const [maxDistance, setMaxDistance] = useState('');
  const [loading, setLoading] = useState(false);

  // NGO Requirements & Recommendations
  const [requirements, setRequirements] = useState<NgoRequirement[]>([]);
  const [recommendations, setRecommendations] = useState<SurplusListing[]>([]);
  
  // New Requirement form state
  const [reqCategory, setReqCategory] = useState('Others');
  const [reqQuantity, setReqQuantity] = useState(0);
  const [reqUnit, setReqUnit] = useState('kg');
  const [reqUrgency, setReqUrgency] = useState('LOW');
  const [reqLocation, setReqLocation] = useState('');
  const [reqDietary, setReqDietary] = useState('');
  const [submittingReq, setSubmittingReq] = useState(false);

  // In-App Notifications
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Beneficiary Impact
  const [impactData, setImpactData] = useState<NgoImpact | null>(null);

  // Modal / Interaction State
  const [selectedListing, setSelectedListing] = useState<SurplusListing | null>(null);
  const [donorProfile, setDonorProfile] = useState<DonorProfile | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [quantityToClaim, setQuantityToClaim] = useState(1);
  const [isPaying, setIsPaying] = useState(false);

  // Payment Confirmation state
  const [paymentResult, setPaymentResult] = useState<{
    status: 'SUCCESS' | 'FAILED' | null;
    order?: MarketplaceOrder;
  }>({ status: null });

  // Receipt Modal state
  const [activeReceipt, setActiveReceipt] = useState<MarketplaceOrder | null>(null);

  // Pickup Scheduling state
  const [schedulingOrder, setSchedulingOrder] = useState<MarketplaceOrder | null>(null);
  const [pickupDate, setPickupDate] = useState('');

  const fetchListings = async () => {
    try {
      setLoading(true);
      const res = await marketplaceService.getListings({
        search: search || undefined,
        category: category || undefined,
        listing_type: listingType || undefined,
        expiry_days: expiryDays || undefined,
        max_distance: maxDistance || undefined
      });
      if (res.success && res.data) {
        setListings(res.data);
      }
    } catch (err) {
      toast.error('Failed to load listings');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await marketplaceService.getMyOrders();
      if (res.success && res.data) {
        setOrders(res.data);
      }
    } catch (err) {
      toast.error('Failed to load orders history');
    } finally {
      setLoading(false);
    }
  };

  const fetchRequirements = async () => {
    try {
      const res = await marketplaceService.getRequirements();
      if (res.success && res.data) {
        setRequirements(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      const res = await marketplaceService.getRecommendations();
      if (res.success && res.data) {
        setRecommendations(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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

  const fetchImpactData = async () => {
    try {
      const res = await marketplaceService.getNgoImpact();
      if (res.success && res.data) {
        setImpactData(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkNotificationsRead = async () => {
    try {
      await marketplaceService.readAllNotifications();
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddRequirement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reqQuantity <= 0 || !reqLocation) {
      toast.error('Please specify valid quantity and location');
      return;
    }
    try {
      setSubmittingReq(true);
      const res = await marketplaceService.createRequirement({
        category: reqCategory,
        quantity: reqQuantity,
        unit: reqUnit,
        urgency: reqUrgency,
        location: reqLocation,
        dietary_requirement: reqDietary || null
      });
      if (res.success) {
        toast.success('Requirement added!');
        setReqQuantity(0);
        setReqLocation('');
        setReqDietary('');
        fetchRequirements();
        fetchRecommendations();
        fetchListings();
      } else {
        toast.error(res.error || 'Failed to add requirement');
      }
    } catch (err) {
      toast.error('Error adding requirement');
    } finally {
      setSubmittingReq(false);
    }
  };

  const handleDeleteRequirement = async (id: string) => {
    try {
      const res = await marketplaceService.deleteRequirement(id);
      if (res.success) {
        toast.success('Requirement removed');
        fetchRequirements();
        fetchRecommendations();
        fetchListings();
      }
    } catch (err) {
      toast.error('Error deleting requirement');
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTab === 'marketplace') {
      fetchListings();
      fetchRequirements();
    } else if (activeTab === 'matches') {
      fetchRequirements();
      fetchRecommendations();
    } else if (activeTab === 'orders' || activeTab === 'pickups') {
      fetchOrders();
    } else if (activeTab === 'impact') {
      fetchImpactData();
    }
  }, [activeTab, search, category, listingType, expiryDays, maxDistance]);

  const handleOpenDetails = async (listing: SurplusListing) => {
    setSelectedListing(listing);
    setIsDetailsOpen(true);
    setDonorProfile(null);
    try {
      const res = await marketplaceService.getDonorProfile(listing.user_id);
      if (res.success && res.data) {
        setDonorProfile(res.data);
      }
    } catch (err) {
      console.error('Error loading donor profile:', err);
    }
  };

  const handleStartCheckout = (listing: SurplusListing) => {
    setSelectedListing(listing);
    setQuantityToClaim(1);
    setIsCheckoutOpen(true);
    setPaymentResult({ status: null });
  };

  const handleProcessCheckout = async (simulateSuccess: boolean = true) => {
    if (!selectedListing) return;
    
    try {
      setIsPaying(true);
      // 1. Create order (Checkout)
      const checkoutRes = await marketplaceService.initiateCheckout({
        listing_id: selectedListing.id,
        quantity: quantityToClaim
      });

      if (!checkoutRes.success || !checkoutRes.data) {
        toast.error(checkoutRes.error || 'Checkout initiation failed.');
        setIsPaying(false);
        return;
      }

      const order = checkoutRes.data;

      // 2. If payment required, simulate Sandbox Payment verification
      if (order.payment_required) {
        // Simulate a small delay for payment processing UI
        await new Promise(resolve => setTimeout(resolve, 1500));

        const verifyRes = await marketplaceService.verifyPayment({
          order_id: order.id,
          success: simulateSuccess
        });

        if (verifyRes.success && verifyRes.data) {
          setPaymentResult({
            status: 'SUCCESS',
            order: verifyRes.data
          });
          toast.success('Payment completed successfully!');
        } else {
          setPaymentResult({
            status: 'FAILED',
            order: order
          });
          toast.error('Payment simulation failed.');
        }
      } else {
        // For free donations, verify-payment is not required, checkout directly confirms it
        // Call verification directly to confirm donation claims and decrement inventory
        const verifyRes = await marketplaceService.verifyPayment({
          order_id: order.id,
          success: true
        });

        if (verifyRes.success && verifyRes.data) {
          setPaymentResult({
            status: 'SUCCESS',
            order: verifyRes.data
          });
          toast.success('Donation claimed successfully!');
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Transaction failed.');
    } finally {
      setIsPaying(false);
    }
  };

  const handleSchedulePickupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedulingOrder || !pickupDate) return;
    try {
      const res = await marketplaceService.schedulePickup(schedulingOrder.id, pickupDate);
      if (res.success) {
        toast.success('Pickup window scheduled!');
        setSchedulingOrder(null);
        setPickupDate('');
        fetchOrders();
      } else {
        toast.error(res.error || 'Failed to schedule pickup');
      }
    } catch (err) {
      toast.error('Error scheduling pickup');
    }
  };

  const handleConfirmPickup = async (orderId: string) => {
    try {
      const res = await marketplaceService.completePickup(orderId);
      if (res.success) {
        toast.success('Order completed and items picked up!');
        fetchOrders();
      } else {
        toast.error(res.error || 'Failed to complete pickup');
      }
    } catch (err) {
      toast.error('Error completing pickup');
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!window.confirm("Are you sure you want to cancel this claim/order? Paid orders will be refunded automatically.")) return;
    try {
      const res = await marketplaceService.cancelOrder(orderId);
      if (res.success) {
        toast.success('Order cancelled and refund requested successfully.');
        fetchOrders();
      } else {
        toast.error(res.error || 'Failed to cancel order');
      }
    } catch (err) {
      toast.error('Error cancelling order');
    }
  };

  // Pricing calculations
  const unitPrice = selectedListing?.price_per_unit || 0;
  const subtotal = roundPrice(quantityToClaim * unitPrice);
  const platformFee = 0.0;
  const totalAmount = roundPrice(subtotal + platformFee);

  function roundPrice(num: number) {
    return Math.round(num * 100) / 100;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-300 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Navigation & Header Bar */}
        <header className="glass-panel p-5 flex flex-col sm:flex-row justify-between items-center gap-4 border border-orange-500/30">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-gradient-to-br from-orange-500 to-amber-600 text-white rounded-2xl shadow-lg shadow-orange-500/20">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {user?.organization_name || 'NGO Portal'}
                </h1>
                <span className="px-2 py-0.5 bg-orange-500/10 text-orange-655 dark:text-orange-400 text-[10px] font-extrabold rounded-full border border-orange-500/20">
                  NGO / COMMUNITY KITCHEN
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
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-400" />}
            </button>

            {/* Logout Button */}
            <button onClick={logout} className="btn-secondary py-2 px-4 text-xs font-semibold">
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </header>

        {/* Dashboard Title & Navigation Tabs */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">
              Surplus Food Claim & Checkout Portal
            </h2>
            <p className="text-xs text-slate-500">
              Browse listings, review donor ratings, checkout, and complete secure food claims.
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex flex-wrap gap-1 bg-slate-200/60 dark:bg-slate-800/60 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-750 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <button
              onClick={() => setActiveTab('marketplace')}
              className={`py-1.5 px-3 rounded-xl transition-all ${
                activeTab === 'marketplace'
                  ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 font-bold shadow-md'
                  : 'hover:text-slate-850 dark:hover:text-white'
              }`}
            >
              Surplus Marketplace
            </button>
            <button
              onClick={() => setActiveTab('matches')}
              className={`py-1.5 px-3 rounded-xl transition-all ${
                activeTab === 'matches'
                  ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 font-bold shadow-md'
                  : 'hover:text-slate-850 dark:hover:text-white'
              }`}
            >
              Requirements & Matches
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`py-1.5 px-3 rounded-xl transition-all ${
                activeTab === 'orders'
                  ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 font-bold shadow-md'
                  : 'hover:text-slate-850 dark:hover:text-white'
              }`}
            >
              Claims & Orders
            </button>
            <button
              onClick={() => setActiveTab('pickups')}
              className={`py-1.5 px-3 rounded-xl transition-all ${
                activeTab === 'pickups'
                  ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 font-bold shadow-md'
                  : 'hover:text-slate-850 dark:hover:text-white'
              }`}
            >
              Pickup Schedule
            </button>
            <button
              onClick={() => setActiveTab('impact')}
              className={`py-1.5 px-3 rounded-xl transition-all ${
                activeTab === 'impact'
                  ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 font-bold shadow-md'
                  : 'hover:text-slate-850 dark:hover:text-white'
              }`}
            >
              Beneficiary Impact
            </button>
          </div>
        </div>

        {/* Tab Panel Content */}
        {activeTab === 'marketplace' ? (
          <div className="space-y-5">
            {/* Filter Toolbar */}
            <div className="glass-panel p-4 flex flex-col md:flex-row justify-between items-center gap-3 border border-slate-200 dark:border-slate-800">
              <div className="relative w-full md:w-1/3">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search surplus products..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex gap-3 w-full md:w-auto text-xs font-semibold">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                >
                  <option value="">All Categories</option>
                  <option value="Fruits">Fruits</option>
                  <option value="Vegetables">Vegetables</option>
                  <option value="Dairy">Dairy</option>
                  <option value="Bakery">Bakery</option>
                  <option value="Meat">Meat</option>
                  <option value="Seafood">Seafood</option>
                  <option value="Grains">Grains</option>
                  <option value="Beverages">Beverages</option>
                  <option value="Prepared Foods">Prepared Foods</option>
                  <option value="Frozen">Frozen</option>
                  <option value="Canned">Canned</option>
                  <option value="Others">Others</option>
                </select>

                <select
                  value={listingType}
                  onChange={(e) => setListingType(e.target.value)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                >
                  <option value="">All Formats</option>
                  <option value="DONATION">Free Donation</option>
                  <option value="PAID_SURPLUS">Paid Surplus</option>
                  <option value="DISCOUNTED_SURPLUS">Discounted Surplus</option>
                </select>

                <select
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(e.target.value)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                >
                  <option value="">Any Expiry</option>
                  <option value="1">Expiring in 24h</option>
                  <option value="3">Expiring in 3 Days</option>
                  <option value="7">Expiring in 7 Days</option>
                </select>

                <select
                  value={maxDistance}
                  onChange={(e) => setMaxDistance(e.target.value)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                >
                  <option value="">Any Distance</option>
                  <option value="5">Within 5 km</option>
                  <option value="15">Within 15 km</option>
                  <option value="30">Within 30 km</option>
                </select>
              </div>
            </div>

            {/* List Listings */}
            {loading ? (
              <div className="flex justify-center p-12">
                <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
              </div>
            ) : listings.length === 0 ? (
              <div className="glass-panel p-12 text-center text-slate-500 border border-slate-200 dark:border-slate-800">
                <ShoppingBag className="w-12 h-12 mx-auto text-slate-400 mb-3 opacity-60" />
                <h4 className="text-sm font-bold text-slate-800 dark:text-white">No surplus food listings active</h4>
                <p className="text-xs text-slate-500 mt-1">There are no food items listed at this moment. Check back soon!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {listings.map((l) => (
                  <div key={l.id} className="glass-card p-5 border border-slate-200 dark:border-slate-800 space-y-4 hover:border-orange-500/30 transition-all flex flex-col justify-between">
                    
                    {/* Header product info */}
                    <div className="space-y-3.5">
                      <div className="flex justify-between items-start">
                        <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded-full border ${
                          l.listing_type === 'DONATION'
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                            : 'bg-orange-500/10 text-orange-655 border-orange-500/20'
                        }`}>
                          {l.listing_type === 'DONATION' ? 'FREE DONATION' : 'PAID SURPLUS'}
                        </span>
                        
                        <span className="text-xs font-black text-slate-900 dark:text-white">
                          {l.listing_type === 'DONATION' ? '₹0 / unit' : `₹${l.price_per_unit} / ${l.unit}`}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-base">{l.product_name}</h4>
                        <p className="text-[10px] text-slate-500 font-semibold">{l.category} • {l.quantity_available} {l.unit} remaining</p>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-350 line-clamp-2">{l.description || 'No description provided.'}</p>

                      <div className="space-y-1.5 text-[10px] text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Expires: {l.expiry_date}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-orange-500" />
                          <span className="truncate">Pickup: {l.pickup_location}</span>
                        </div>
                      </div>

                      {/* Smart Match Display */}
                      {l.smart_match_score !== undefined && l.smart_match_score !== null && (
                        <div className="p-2.5 bg-orange-500/5 rounded-xl border border-orange-500/20 space-y-1 text-left">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-orange-700 dark:text-orange-400 font-extrabold flex items-center gap-1">
                              ✨ Smart Match Compatibility
                            </span>
                            <span className="text-xs font-black text-orange-700 dark:text-orange-400">
                              {l.smart_match_score}%
                            </span>
                          </div>
                          
                          <div className="text-[9px] text-slate-500 dark:text-slate-400 space-y-0.5 max-h-16 overflow-y-auto font-medium">
                            {l.smart_match_reasons?.map((reason, idx) => (
                              <div key={idx} className="truncate">
                                {reason}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Donor Card */}
                    <div className="p-3 bg-slate-100/70 dark:bg-slate-800/40 rounded-2xl border border-slate-150 dark:border-slate-850 space-y-2 mt-2">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="font-bold text-slate-850 dark:text-white truncate">🏪 {l.donor_name}</span>
                        {l.donor_verified && (
                          <span className="text-[9px] bg-emerald-500/10 text-emerald-600 px-1 py-0.5 rounded font-extrabold border border-emerald-500/20 flex items-center gap-0.5">
                            ✓ Verified
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-1.5 text-[9px] text-slate-500">
                        <div>
                          <span>Distance:</span>
                          <span className="font-bold text-slate-700 dark:text-slate-300 ml-1">
                            {l.distance_km !== null && l.distance_km !== undefined ? `${l.distance_km} km` : 'Not available'}
                          </span>
                        </div>
                        <div>
                          <span>Donations:</span>
                          <span className="font-bold text-slate-700 dark:text-slate-300 ml-1">
                            {l.donor_completed_donations || 0} completed
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={() => handleOpenDetails(l)}
                        className="py-2 px-3 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 rounded-xl transition-all"
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => handleStartCheckout(l)}
                        className="btn-primary py-2 px-3 text-xs font-semibold flex items-center justify-center gap-1 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 border-none shadow-orange-500/20"
                      >
                        {l.listing_type === 'DONATION' ? 'Claim Free' : 'Buy Surplus'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'matches' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Requirements section */}
            <div className="lg:col-span-5 space-y-6">
              {/* Add requirement form */}
              <div className="glass-panel p-5 border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="text-left">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">Post NGO Requirement</h3>
                  <p className="text-xs text-slate-500">Specify your food need to trigger smart matching recommendations.</p>
                </div>
                
                <form onSubmit={handleAddRequirement} className="space-y-3.5 text-xs font-semibold">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1 text-left">
                      <label className="text-slate-500">Category</label>
                      <select
                        value={reqCategory}
                        onChange={(e) => setReqCategory(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                      >
                        <option value="Fruits">Fruits</option>
                        <option value="Vegetables">Vegetables</option>
                        <option value="Dairy">Dairy</option>
                        <option value="Bakery">Bakery</option>
                        <option value="Meat">Meat</option>
                        <option value="Seafood">Seafood</option>
                        <option value="Grains">Grains</option>
                        <option value="Beverages">Beverages</option>
                        <option value="Prepared Foods">Prepared Foods</option>
                        <option value="Frozen">Frozen</option>
                        <option value="Canned">Canned</option>
                        <option value="Others">Others</option>
                      </select>
                    </div>

                    <div className="space-y-1 text-left">
                      <label className="text-slate-500">Urgency</label>
                      <select
                        value={reqUrgency}
                        onChange={(e) => setReqUrgency(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                      >
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="CRITICAL">Critical</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1 text-left">
                      <label className="text-slate-500">Quantity Needed</label>
                      <input
                        type="number"
                        min="0.1"
                        step="any"
                        value={reqQuantity || ''}
                        onChange={(e) => setReqQuantity(parseFloat(e.target.value) || 0)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                        placeholder="e.g. 50"
                      />
                    </div>

                    <div className="space-y-1 text-left">
                      <label className="text-slate-500">Unit</label>
                      <input
                        type="text"
                        value={reqUnit}
                        onChange={(e) => setReqUnit(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                        placeholder="e.g. kg or units"
                      />
                    </div>
                  </div>

                  <div className="space-y-1 text-left">
                    <label className="text-slate-500">Your Location / Delivery Address</label>
                    <input
                      type="text"
                      value={reqLocation}
                      onChange={(e) => setReqLocation(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                      placeholder="e.g. 15 NGO Way, Metro City"
                    />
                  </div>

                  <div className="space-y-1 text-left">
                    <label className="text-slate-500">Dietary Restrictions (Optional)</label>
                    <input
                      type="text"
                      value={reqDietary}
                      onChange={(e) => setReqDietary(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                      placeholder="e.g. Vegetarian, Halal, Nut-free"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingReq}
                    className="w-full btn-primary py-2 text-xs font-bold bg-gradient-to-r from-orange-500 to-amber-600 border-none rounded-xl"
                  >
                    {submittingReq ? 'Adding...' : 'Post Requirement'}
                  </button>
                </form>
              </div>

              {/* Current Requirements List */}
              <div className="glass-panel p-5 border border-slate-200 dark:border-slate-800 space-y-4">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider text-left">Your Current Requirements</h3>
                <div className="space-y-2.5 max-h-80 overflow-y-auto">
                  {requirements.length === 0 ? (
                    <p className="text-slate-500 text-xs py-4 text-center">No requirement posts active.</p>
                  ) : (
                    requirements.map((req) => (
                      <div key={req.id} className="p-3 bg-slate-100/70 dark:bg-slate-800/40 border border-slate-150 dark:border-slate-850 rounded-xl flex justify-between items-center text-xs">
                        <div className="text-left">
                          <div className="flex items-center gap-1.5 font-bold">
                            <span className="text-slate-900 dark:text-white">{req.category}</span>
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-black ${
                              req.urgency === 'CRITICAL'
                                ? 'bg-rose-500/10 text-rose-600'
                                : req.urgency === 'HIGH'
                                ? 'bg-orange-500/10 text-orange-655'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-605 dark:text-slate-300'
                            }`}>
                              {req.urgency}
                            </span>
                          </div>
                          <p className="text-slate-500 font-medium text-[11px] mt-0.5">
                            Needed: {req.quantity} {req.unit} at {req.location}
                          </p>
                          {req.dietary_requirement && (
                            <p className="text-[10px] text-emerald-600 font-bold mt-0.5">🥗 {req.dietary_requirement}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteRequirement(req.id)}
                          className="p-1.5 hover:bg-rose-500/15 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Recommendations section */}
            <div className="lg:col-span-7 space-y-4">
              <div className="text-left">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  Recommended Surplus for You <Award className="w-5 h-5 text-amber-500" />
                </h3>
                <p className="text-xs text-slate-500">
                  AI-assisted matching based on your location, category needs, quantity, and urgency.
                </p>
              </div>

              {loading ? (
                <div className="flex justify-center p-12">
                  <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
                </div>
              ) : recommendations.length === 0 ? (
                <div className="glass-panel p-12 text-center text-slate-550 border border-slate-200 dark:border-slate-800">
                  <Info className="w-12 h-12 mx-auto text-slate-400 mb-3 opacity-60" />
                  <h4 className="text-sm font-bold text-slate-850 dark:text-white">No recommended surplus matches</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Try adding more requirements or broadening your location parameters.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {recommendations.map((l) => (
                    <div key={l.id} className="glass-card p-4 border border-orange-500/20 bg-orange-500/[0.01] hover:border-orange-500/40 transition-all flex flex-col justify-between space-y-3">
                      <div className="space-y-2.5">
                        <div className="flex justify-between items-start">
                          <span className={`px-1.5 py-0.2 text-[9px] font-extrabold rounded border ${
                            l.listing_type === 'DONATION'
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                              : 'bg-orange-500/10 text-orange-655 border-orange-500/20'
                          }`}>
                            {l.listing_type === 'DONATION' ? 'FREE DONATION' : 'PAID SURPLUS'}
                          </span>
                          
                          <span className="text-xs font-black text-slate-900 dark:text-white">
                            {l.listing_type === 'DONATION' ? '₹0 / unit' : `₹${l.price_per_unit} / ${l.unit}`}
                          </span>
                        </div>

                        <div className="text-left">
                          <h4 className="font-bold text-slate-900 dark:text-white text-sm">{l.product_name}</h4>
                          <p className="text-[10px] text-slate-500 font-semibold">{l.category} • {l.quantity_available} {l.unit} available</p>
                        </div>

                        {l.smart_match_score !== undefined && l.smart_match_score !== null && (
                          <div className="p-2 bg-orange-500/5 rounded-xl border border-orange-500/20 space-y-1 text-left">
                            <div className="flex justify-between items-center text-[10px] font-extrabold text-orange-700 dark:text-orange-400">
                              <span>✨ Smart Match Compatibility</span>
                              <span>{l.smart_match_score}%</span>
                            </div>
                            <div className="text-[9px] text-slate-555 dark:text-slate-400 space-y-0.5 max-h-12 overflow-y-auto font-medium">
                              {l.smart_match_reasons?.map((reason, idx) => (
                                <div key={idx} className="truncate">{reason}</div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="space-y-1 text-[10px] text-slate-500 text-left">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>Expires: {l.expiry_date}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-orange-500" />
                            <span className="truncate">Donor: {l.donor_name} {l.distance_km ? `(${l.distance_km} km)` : ''}</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <button
                          onClick={() => handleOpenDetails(l)}
                          className="py-1.5 px-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 rounded-lg transition-all"
                        >
                          Details
                        </button>
                        <button
                          onClick={() => handleStartCheckout(l)}
                          className="btn-primary py-1.5 px-2 text-xs font-semibold flex items-center justify-center gap-1 bg-gradient-to-r from-orange-500 to-amber-600 border-none shadow-sm shadow-orange-500/10"
                        >
                          {l.listing_type === 'DONATION' ? 'Claim' : 'Buy'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'orders' ? (
          <div className="space-y-4">
            <div className="text-left">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">NGO Claims History</h3>
              <p className="text-xs text-slate-505">Track claim statuses, download invoices, and schedule food pickups.</p>
            </div>

            {loading ? (
              <div className="flex justify-center p-12">
                <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
              </div>
            ) : orders.length === 0 ? (
              <div className="glass-panel p-12 text-center text-slate-500 border border-slate-200 dark:border-slate-800">
                <HeartHandshake className="w-12 h-12 mx-auto text-slate-400 mb-3 opacity-60" />
                <h4 className="text-sm font-bold text-slate-850 dark:text-white">No claims log found</h4>
                <p className="text-xs text-slate-555 mt-1">You haven't claimed any listings yet. Browse listings to get started.</p>
              </div>
            ) : (
              <div className="glass-panel overflow-hidden border border-slate-200 dark:border-slate-800 text-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100/70 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700 font-bold text-slate-655 dark:text-slate-350">
                        <th className="py-3 px-4">Item Name</th>
                        <th className="py-3 px-4">Donor Business</th>
                        <th className="py-3 px-4">Quantity</th>
                        <th className="py-3 px-4">Amount</th>
                        <th className="py-3 px-4">Payment Status</th>
                        <th className="py-3 px-4">Order Status</th>
                        <th className="py-3 px-4">Claim Date</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {orders.map((o) => (
                        <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{o.product_name}</td>
                          <td className="py-3 px-4 text-left">{o.donor_name}</td>
                          <td className="py-3 px-4 text-left">{o.quantity} {o.unit}</td>
                          <td className="py-3 px-4 font-bold text-left">{o.payment_required ? `₹${o.total_amount}` : 'Free'}</td>
                          <td className="py-3 px-4 text-left">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${
                              o.payment_status === 'PAYMENT_SUCCESS'
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                : o.payment_status === 'PENDING' || o.payment_status === 'PAYMENT_INITIATED'
                                ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                : o.payment_status === 'NOT_REQUIRED'
                                ? 'bg-slate-100 text-slate-600 border-slate-200'
                                : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                            }`}>
                              {o.payment_status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-left">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${
                              o.order_status === 'COMPLETED'
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                : o.order_status === 'PICKUP_SCHEDULED'
                                ? 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20'
                                : o.order_status === 'ORDER_CONFIRMED'
                                ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                                : o.order_status === 'PENDING'
                                ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                            }`}>
                              {o.order_status === 'PICKUP_SCHEDULED' ? 'PICKUP SCHEDULED' : o.order_status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-505 text-left">{new Date(o.created_at).toLocaleDateString()}</td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex justify-end gap-2">
                              {o.order_status === 'ORDER_CONFIRMED' && (
                                <button
                                  onClick={() => setSchedulingOrder(o)}
                                  className="px-2.5 py-1 text-[10px] bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1 font-bold shadow border-none"
                                >
                                  <Truck className="w-3 h-3" /> Schedule
                                </button>
                              )}
                              {o.order_status === 'PICKUP_SCHEDULED' && (
                                <button
                                  onClick={() => handleConfirmPickup(o.id)}
                                  className="px-2.5 py-1 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1 font-bold shadow border-none"
                                >
                                  ✓ Collected
                                </button>
                              )}
                              {['PENDING', 'ORDER_CONFIRMED', 'PICKUP_SCHEDULED'].includes(o.order_status) && (
                                <button
                                  onClick={() => handleCancelOrder(o.id)}
                                  className="px-2 py-1 text-[10px] hover:bg-rose-500/10 text-rose-500 rounded-lg"
                                >
                                  Cancel
                                </button>
                              )}
                              {o.order_status === 'COMPLETED' && (
                                <button
                                  onClick={() => setActiveReceipt(o)}
                                  className="px-2.5 py-1 text-[10px] bg-slate-205 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-lg flex items-center gap-1"
                                >
                                  <FileText className="w-3 h-3" /> Receipt
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'pickups' ? (
          <div className="space-y-6">
            {/* Upcoming Pickups */}
            <div className="glass-panel p-5 border border-slate-205 dark:border-slate-800 space-y-4">
              <div className="text-left">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">Scheduled Upcoming Pickups</h3>
                <p className="text-xs text-slate-500">Pick up coordinates, windows, and donor store details for scheduled rescues.</p>
              </div>

              {orders.filter(o => o.order_status === 'PICKUP_SCHEDULED').length === 0 ? (
                <p className="text-slate-500 text-xs py-4 text-center">No upcoming scheduled pickups.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {orders.filter(o => o.order_status === 'PICKUP_SCHEDULED').map(o => (
                    <div key={o.id} className="p-4 bg-indigo-500/[0.02] border border-indigo-500/20 rounded-xl space-y-3">
                      <div className="flex justify-between items-start text-xs text-left">
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-white">{o.product_name}</h4>
                          <p className="text-slate-500 font-semibold">{o.quantity} {o.unit} from {o.donor_name}</p>
                        </div>
                        <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-600 rounded font-extrabold text-[9px] border border-indigo-500/20">
                          SCHEDULED
                        </span>
                      </div>

                      <div className="p-2.5 bg-slate-100/60 dark:bg-slate-800/40 rounded-xl space-y-1.5 text-[11px] text-slate-655 dark:text-slate-350 text-left">
                        <div className="flex items-center gap-1.5 font-bold text-indigo-600 dark:text-indigo-400">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Pickup Time: {o.pickup_date ? new Date(o.pickup_date).toLocaleString() : 'Not set'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-orange-500" />
                          <span className="truncate">Address: {o.pickup_location}</span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleConfirmPickup(o.id)}
                          className="flex-1 btn-primary py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg border-none"
                        >
                          Mark as Rescued/Picked Up
                        </button>
                        <button
                          onClick={() => handleCancelOrder(o.id)}
                          className="px-3 py-1.5 text-xs font-semibold border border-rose-500/30 hover:bg-rose-500/10 text-rose-605 rounded-lg"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Complete Pickup History */}
            <div className="glass-panel p-5 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="text-left">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">Pickup & Claims History</h3>
                <p className="text-xs text-slate-500">Historical archive of all completed, cancelled, or pending claims.</p>
              </div>

              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 font-bold text-slate-500 dark:text-slate-400">
                      <th className="py-2.5 px-3">Item Name</th>
                      <th className="py-2.5 px-3">Donor</th>
                      <th className="py-2.5 px-3">Quantity</th>
                      <th className="py-2.5 px-3">Scheduled On</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-slate-500">No records found.</td>
                      </tr>
                    ) : (
                      orders.map(o => (
                        <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/10 font-medium">
                          <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white text-left">{o.product_name}</td>
                          <td className="py-2.5 px-3 text-left">{o.donor_name}</td>
                          <td className="py-2.5 px-3 text-left">{o.quantity} {o.unit}</td>
                          <td className="py-2.5 px-3 text-left">{o.pickup_date ? new Date(o.pickup_date).toLocaleDateString() : 'Not scheduled'}</td>
                          <td className="py-2.5 px-3 text-left">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black border ${
                              o.order_status === 'COMPLETED'
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                : o.order_status === 'CANCELLED'
                                ? 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                                : 'bg-slate-100 text-slate-655 border-slate-200'
                            }`}>
                              {o.order_status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-left">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Your Beneficiary & Sustainability Impact <HeartHandshake className="w-5 h-5 text-orange-500 animate-pulse" />
              </h3>
              <p className="text-xs text-slate-500">
                Rescuing food translates directly to carbon footprint reduction and food security support.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Rescues completed */}
              <div className="glass-panel p-5 border border-slate-200 dark:border-slate-800 space-y-2 text-left">
                <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Food Rescues Completed</span>
                <h4 className="text-3xl font-black text-slate-900 dark:text-white">{impactData?.completed_pickups || 0}</h4>
                <p className="text-[10px] text-slate-500">Total successful pickup completions</p>
              </div>

              {/* Volume Rescued */}
              <div className="glass-panel p-5 border border-slate-200 dark:border-slate-800 space-y-2 text-left">
                <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Volume Rescued</span>
                <h4 className="text-3xl font-black text-slate-900 dark:text-white">{impactData?.total_units_received || 0} <span className="text-xs font-semibold text-slate-500">units</span></h4>
                <p className="text-[10px] text-slate-500">Total food quantity diverted from landfill</p>
              </div>

              {/* Meals Supported */}
              <div className="glass-panel p-5 border border-indigo-500/20 bg-indigo-500/[0.02] space-y-2 text-left">
                <span className="text-[10px] text-indigo-700 dark:text-indigo-400 font-extrabold uppercase tracking-wider">Estimated Meals Supported</span>
                <h4 className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
                  {impactData?.meals_supported || 0} <span className="text-xs font-semibold">meals</span>
                </h4>
                <p className="text-[10px] text-slate-555 mt-1">
                  *ESTIMATED value based on {impactData?.meals_per_unit_factor || 2.0} meals supported per unit of food rescued.
                </p>
              </div>

              {/* CO2 Saved */}
              <div className="glass-panel p-5 border border-emerald-500/20 bg-emerald-500/[0.02] space-y-2 text-left">
                <span className="text-[10px] text-emerald-700 dark:text-emerald-450 font-extrabold uppercase tracking-wider">Estimated CO2 Saved</span>
                <h4 className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                  {impactData?.estimated_co2_savings || 0} <span className="text-xs font-semibold">kg CO₂e</span>
                </h4>
                <p className="text-[10px] text-slate-555 mt-1">
                  *ESTIMATED value based on {impactData?.co2_per_unit_factor || 2.5} kg CO₂ saved per unit of food rescued.
                </p>
              </div>
            </div>

            <div className="glass-panel p-6 border border-orange-500/25 bg-orange-500/[0.02] text-xs space-y-2.5 text-left">
              <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">How We Calculate Impact</h4>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                We work with standard sustainability models to estimate the positive contribution of your food rescue operations:
              </p>
              <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-655 dark:text-slate-350">
                <li>
                  <span className="font-bold text-slate-805 dark:text-white">Meals supported multiplier:</span> Rescued food is converted to estimated meals assuming 1 unit of rescued food supports approximately {impactData?.meals_per_unit_factor || 2.0} standard portions.
                </li>
                <li>
                  <span className="font-bold text-slate-808 dark:text-white">Carbon reduction calculation:</span> Rescuing surplus food avoids anaerobic landfill decomposition. Every unit of rescued food is estimated to save {impactData?.co2_per_unit_factor || 2.5} kilograms of carbon dioxide equivalent (CO₂e).
                </li>
              </ul>
            </div>
          </div>
        )}

      </div>

      {/* 1. View Donor & Listing Details Modal */}
      {isDetailsOpen && selectedListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-2xl bg-white dark:bg-slate-900 p-6 space-y-4 border border-orange-500/30 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Surplus Listing & Donor Transparency Details</h3>
              <button onClick={() => setIsDetailsOpen(false)} className="text-slate-400 hover:text-slate-655 font-bold">✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Product Food Details */}
              <div className="space-y-3.5">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-orange-600">Product Specifications</h4>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-slate-500 block">Food Name</span>
                    <span className="font-bold text-slate-905 dark:text-white text-base">{selectedListing.product_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Quantity Available</span>
                    <span className="font-bold text-slate-850 dark:text-white">{selectedListing.quantity_available} {selectedListing.unit}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Price / unit</span>
                    <span className="font-bold text-slate-850 dark:text-white">
                      {selectedListing.listing_type === 'DONATION' ? 'Free Donation' : `₹${selectedListing.price_per_unit}`}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Description</span>
                    <p className="text-slate-600 dark:text-slate-350 mt-0.5">{selectedListing.description || 'No description provided.'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Expiry Date</span>
                    <span className="font-bold text-rose-500 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {selectedListing.expiry_date}</span>
                  </div>
                </div>
              </div>

              {/* Public Donor Details card */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-150 dark:border-slate-850 rounded-2xl space-y-4">
                <div className="flex items-center gap-2 pb-2.5 border-b border-slate-200 dark:border-slate-800">
                  <div className="w-10 h-10 bg-orange-500/10 text-orange-500 rounded-xl flex items-center justify-center font-bold">
                    {selectedListing.donor_name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">{selectedListing.donor_name}</h4>
                    <p className="text-[10px] text-slate-500 font-semibold uppercase">{selectedListing.donor_type || 'Supermarket'}</p>
                  </div>
                </div>

                {donorProfile ? (
                  <div className="space-y-3.5 text-[11px]">
                    <div className="space-y-1.5 text-slate-600 dark:text-slate-350">
                      <div className="flex justify-between">
                        <span>Verification Status:</span>
                        <span className="font-bold text-emerald-600">✓ Verified Business</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Joined Platform:</span>
                        <span>{donorProfile.joined_date}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Completed Donations:</span>
                        <span className="font-bold text-slate-900 dark:text-white">{donorProfile.completed_donations}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Surplus Sales:</span>
                        <span className="font-bold text-slate-900 dark:text-white">{donorProfile.completed_surplus_transactions}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Quantity Shared:</span>
                        <span className="font-bold text-emerald-600">{donorProfile.total_units_redistributed} units</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Location:</span>
                        <span className="text-right truncate max-w-[150px]">{donorProfile.address}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <p className="font-bold text-slate-500 text-[10px]">DONOR TRUST INDICATORS</p>
                      <div className="flex flex-wrap gap-1">
                        {donorProfile.trust_indicators.map((t, idx) => (
                          <span key={idx} className="bg-orange-500/10 text-orange-655 px-1.5 py-0.5 rounded text-[9px] font-bold">
                            ✓ {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-center py-6">
                    <RefreshCw className="w-5 h-5 animate-spin text-orange-500" />
                  </div>
              )}
              </div>
            </div>

            {/* Proximity Map Visualization */}
            {donorProfile && (
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <h4 className="font-bold text-slate-500 uppercase text-[10px] text-left">Pickup Location Map</h4>
                <MapComponent
                  donorLat={donorProfile.latitude}
                  donorLon={donorProfile.longitude}
                  donorName={donorProfile.organization_name || selectedListing.donor_name}
                  ngoLat={user?.latitude}
                  ngoLon={user?.longitude}
                  ngoName={user?.full_name}
                  distanceKm={selectedListing.distance_km}
                />
              </div>
            )}

            {/* Public donor history table */}
            {donorProfile && donorProfile.history && donorProfile.history.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px]">
                <h4 className="font-bold text-slate-500 uppercase">Recent Food Contributions</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-100 dark:border-slate-800 font-bold">
                        <th className="pb-1">Product Category</th>
                        <th className="pb-1">Quantity</th>
                        <th className="pb-1">Redistribution Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {donorProfile.history.map((h, i) => (
                        <tr key={i} className="text-slate-600 dark:text-slate-350 font-medium">
                          <td className="py-1">🍲 {h.product_name} ({h.category})</td>
                          <td className="py-1">{h.quantity} {h.unit}</td>
                          <td className="py-1">{h.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setIsDetailsOpen(false)}
                className="px-4 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Close Details
              </button>
              <button
                onClick={() => {
                  setIsDetailsOpen(false);
                  handleStartCheckout(selectedListing);
                }}
                className="btn-primary py-2 px-4 text-xs font-semibold bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 border-none"
              >
                Claim surplus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Checkout Modal & Sandbox Payment */}
      {isCheckoutOpen && selectedListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md bg-white dark:bg-slate-900 p-6 space-y-4 border border-orange-500/30 overflow-y-auto max-h-[95vh]">
            
            {paymentResult.status === null ? (
              // Checkout Screen
              <>
                <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Checkout Claim Summary
                  </h3>
                  <button onClick={() => setIsCheckoutOpen(false)} className="text-slate-400 hover:text-slate-655 font-bold">✕</button>
                </div>

                <div className="space-y-4 text-xs font-semibold">
                  {/* Order particulars */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-150 dark:border-slate-850 space-y-2">
                    <div className="flex justify-between text-slate-500 text-[10px] uppercase font-bold">
                      <span>Food Item</span>
                      <span>Donor</span>
                    </div>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white text-sm">{selectedListing.product_name}</p>
                        <p className="text-[10px] text-slate-500">Unit Price: {selectedListing.listing_type === 'DONATION' ? 'Free' : `₹${selectedListing.price_per_unit}`}</p>
                      </div>
                      <p className="font-bold text-slate-850 dark:text-white truncate max-w-[120px]">{selectedListing.donor_name}</p>
                    </div>

                    <div className="pt-2 flex justify-between items-center border-t border-slate-200/50 dark:border-slate-800">
                      <span className="text-slate-500">Select Claim Quantity ({selectedListing.unit})</span>
                      <input
                        type="number"
                        min="1"
                        max={selectedListing.quantity_available}
                        value={quantityToClaim}
                        onChange={(e) => setQuantityToClaim(Math.min(selectedListing.quantity_available, Math.max(1, parseInt(e.target.value) || 1)))}
                        className="w-16 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 p-1 text-center font-bold text-slate-900 dark:text-white text-xs"
                      />
                    </div>
                  </div>

                  {/* Calculations */}
                  <div className="space-y-1.5 p-1 text-slate-600 dark:text-slate-350">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>{selectedListing.listing_type === 'DONATION' ? 'Free' : `₹${subtotal.toFixed(2)}`}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Platform/Service Fee:</span>
                      <span>₹0.00</span>
                    </div>
                    <div className="flex justify-between text-slate-900 dark:text-white font-bold text-sm pt-1 border-t border-slate-100 dark:border-slate-800">
                      <span>Total Amount:</span>
                      <span>{selectedListing.listing_type === 'DONATION' ? 'Free' : `₹${totalAmount.toFixed(2)}`}</span>
                    </div>
                  </div>

                  {/* Delivery Location Info */}
                  <div className="text-[10px] text-slate-500 p-2.5 bg-slate-100/50 dark:bg-slate-800/20 rounded-xl space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <MapPin className="w-3.5 h-3.5 text-orange-500" />
                      <span>Pickup Address</span>
                    </div>
                    <p className="pl-5 truncate">{selectedListing.pickup_location}</p>
                    <p className="pl-5">Availability Window: {selectedListing.availability_window}</p>
                  </div>

                  {/* Sandbox simulation panel */}
                  {selectedListing.payment_required ? (
                    <div className="p-4 bg-orange-500/10 rounded-2xl border border-orange-500/30 space-y-3">
                      <div className="flex items-center gap-2 text-orange-655 font-bold text-xs">
                        <Shield className="w-4 h-4" />
                        <span>TEST/SANDBOX PAYMENT GATEWAY</span>
                      </div>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400 font-semibold leading-relaxed">
                        To demonstrate the idempotent transaction flow, select either of the test simulation behaviors below. No real card details are stored or required.
                      </p>

                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => handleProcessCheckout(true)}
                          disabled={isPaying}
                          className="py-2 px-3 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md transition-colors disabled:opacity-40"
                        >
                          {isPaying ? 'Processing...' : 'Simulate Success'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleProcessCheckout(false)}
                          disabled={isPaying}
                          className="py-2 px-3 text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md transition-colors disabled:opacity-40"
                        >
                          {isPaying ? 'Processing...' : 'Simulate Failure'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Free donation claim action
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => handleProcessCheckout(true)}
                        disabled={isPaying}
                        className="w-full btn-primary py-2.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-755 border-none shadow-emerald-500/20 text-xs"
                      >
                        {isPaying ? 'Processing Claim...' : 'Confirm Free Donation Claim'}
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : paymentResult.status === 'SUCCESS' && paymentResult.order ? (
              // 3. Payment SUCCESS state Screen
              <div className="text-center space-y-5 py-4">
                <div className="w-16 h-16 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle className="w-10 h-10" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-emerald-600 dark:text-emerald-400">✓ PAYMENT SUCCESSFUL</h3>
                  <p className="text-xs text-slate-500 font-bold mt-1">Order Confirmed Successfully</p>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-150 dark:border-slate-850 text-xs font-semibold text-left space-y-2.5">
                  <div className="flex justify-between border-b border-slate-200/50 dark:border-slate-850 pb-2">
                    <span className="text-slate-500">Transaction ID</span>
                    <span className="font-mono text-[10px] font-bold text-slate-800 dark:text-white">
                      {paymentResult.order.payment_id || paymentResult.order.id.slice(0, 8).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Food Item:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{selectedListing.product_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Quantity Claimed:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{paymentResult.order.quantity} {selectedListing.unit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Amount Charged:</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {paymentResult.order.payment_required ? `₹${paymentResult.order.total_amount}` : 'Free Donation'}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-200/50 dark:border-slate-850 text-[10px] text-slate-500">
                    <span>Pickup address:</span>
                    <span className="font-bold truncate max-w-[200px]">{selectedListing.pickup_location}</span>
                  </div>
                </div>

                <div className="flex gap-3 justify-center pt-2">
                  <button
                    onClick={() => {
                      setIsCheckoutOpen(false);
                      setActiveTab('orders');
                      fetchOrders();
                    }}
                    className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 rounded-xl"
                  >
                    View My Orders
                  </button>
                  <button
                    onClick={() => {
                      setIsCheckoutOpen(false);
                      fetchListings();
                    }}
                    className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              // 4. Payment FAILURE Screen
              <div className="text-center space-y-5 py-4">
                <div className="w-16 h-16 bg-rose-500/10 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <XCircle className="w-10 h-10" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-rose-600 dark:text-rose-400">✕ PAYMENT FAILED</h3>
                  <p className="text-xs text-slate-500 mt-1">Your payment could not be completed.</p>
                  <p className="text-xs text-slate-500">The order has not been confirmed.</p>
                </div>

                <div className="flex gap-3 justify-center pt-4">
                  <button
                    onClick={() => setIsCheckoutOpen(false)}
                    className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setPaymentResult({ status: null })}
                    className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* 5. Pickup Scheduling Modal */}
      {schedulingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-sm bg-white dark:bg-slate-900 p-6 space-y-4 border border-blue-500/30 text-xs font-semibold">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Schedule Food Pickup</h3>
              <button onClick={() => setSchedulingOrder(null)} className="text-slate-400 hover:text-slate-655 font-bold">✕</button>
            </div>

            <form onSubmit={handleSchedulePickupSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-slate-500">Select Date & Time Window</label>
                <input
                  type="datetime-local"
                  required
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 p-2.5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="text-[10px] text-slate-500 leading-normal p-2.5 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-150 dark:border-slate-850">
                <p className="font-bold">Item: {schedulingOrder.product_name}</p>
                <p>Quantity: {schedulingOrder.quantity} {schedulingOrder.unit}</p>
                <p className="mt-1">Please confirm that your logistical staff is ready to pick up the items within the donor's listed availability window.</p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSchedulingOrder(null)}
                  className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md font-bold"
                >
                  Schedule Pickup
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Receipt Modal */}
      {activeReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-sm bg-white dark:bg-slate-900 p-6 space-y-5 border border-emerald-500/30">
            <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-905 dark:text-white">SURPLUS FOOD RECEIPT</h3>
              <p className="text-[10px] text-slate-500">Transaction ID: {activeReceipt.payment_id || activeReceipt.id.slice(0, 12).toUpperCase()}</p>
            </div>

            <div className="space-y-3.5 text-xs font-semibold">
              <div className="flex justify-between">
                <span className="text-slate-500">Business / Donor</span>
                <span className="font-bold text-slate-900 dark:text-white">{activeReceipt.donor_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Recipient / NGO</span>
                <span className="font-bold text-slate-900 dark:text-white">{user?.organization_name || user?.full_name}</span>
              </div>
              
              <div className="flex justify-between border-t border-slate-100 dark:border-slate-850 pt-2">
                <span className="text-slate-500">Listed Food Item</span>
                <span className="font-bold text-slate-900 dark:text-white">{activeReceipt.product_name}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-slate-500">Quantity Claimed</span>
                <span className="font-bold text-slate-900 dark:text-white">{activeReceipt.quantity} {activeReceipt.unit}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-500">Payment Status</span>
                <span className="font-extrabold text-emerald-600">PAID SUCCESS</span>
              </div>

              <div className="flex justify-between border-t border-slate-150 dark:border-slate-800 pt-2.5 text-slate-900 dark:text-white text-sm font-black">
                <span>Total Amount Charged</span>
                <span>{activeReceipt.payment_required ? `₹${activeReceipt.total_amount.toFixed(2)}` : '₹0.00 (Donation)'}</span>
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-[10px] text-slate-500 leading-normal space-y-1">
              <p className="font-bold">📍 Pickup Location Details</p>
              <p>{activeReceipt.pickup_location}</p>
              {activeReceipt.pickup_date && (
                <p>Scheduled Pickup Date: {new Date(activeReceipt.pickup_date).toLocaleString()}</p>
              )}
            </div>

            <div className="flex justify-center pt-2">
              <button
                onClick={() => setActiveReceipt(null)}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl"
              >
                Close Receipt
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default NgoDashboardShell;
