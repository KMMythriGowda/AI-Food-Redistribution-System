import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { 
  Store, 
  Receipt, 
  User, 
  Plus, 
  RefreshCw, 
  Clock, 
  MapPin, 
  CheckCircle, 
  Calendar,
  Building2,
  TrendingUp,
  Award
} from 'lucide-react';
import { marketplaceService, SurplusListing, MarketplaceOrder, BusinessStats } from '@/services/marketplace';
import { InventoryItem } from '@/types';

interface BusinessMarketplaceTabProps {
  inventoryItems: InventoryItem[];
}

export const BusinessMarketplaceTab: React.FC<BusinessMarketplaceTabProps> = ({ inventoryItems }) => {
  const [subTab, setSubTab] = useState<'listings' | 'transactions' | 'profile'>('listings');
  
  // Data states
  const [listings, setListings] = useState<SurplusListing[]>([]);
  const [transactions, setTransactions] = useState<MarketplaceOrder[]>([]);
  const [stats, setStats] = useState<BusinessStats | null>(null);
  
  // Profile edit states
  const [profileName, setProfileName] = useState('');
  const [businessType, setBusinessType] = useState('Supermarket');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [profileStats, setProfileStats] = useState<any>(null);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Modal listing form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInvItem, setSelectedInvItem] = useState<string>('');
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState('Others');
  const [listingType, setListingType] = useState<'DONATION' | 'PAID_SURPLUS' | 'DISCOUNTED_SURPLUS'>('DONATION');
  const [quantity, setQuantity] = useState(0);
  const [unit, setUnit] = useState('units');
  const [price, setPrice] = useState(0);
  const [expiryDate, setExpiryDate] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [availabilityWindow, setAvailabilityWindow] = useState('9 AM - 5 PM');
  const [description, setDescription] = useState('');

  const fetchListings = async () => {
    try {
      setLoading(true);
      const res = await marketplaceService.getBusinessListings();
      if (res.success && res.data) {
        setListings(res.data);
      }
    } catch (err: any) {
      toast.error('Failed to load listings');
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactionsAndStats = async () => {
    try {
      setLoading(true);
      const [txRes, statsRes] = await Promise.all([
        marketplaceService.getBusinessTransactions(),
        marketplaceService.getBusinessStats()
      ]);
      
      if (txRes.success && txRes.data) {
        setTransactions(txRes.data);
      }
      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
      }
    } catch (err: any) {
      toast.error('Failed to load transaction data');
    } finally {
      setLoading(false);
    }
  };

  const fetchProfile = async () => {
    try {
      setLoading(true);
      // Fetch stats to get dynamic metrics
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        setProfileName(user.organization_name || user.full_name || '');
        setBusinessType(user.business_type || 'Supermarket');
        setPhone(user.phone || '');
        setAddress(user.address || '');

        const profRes = await marketplaceService.getDonorProfile(user.id);
        if (profRes.success && profRes.data) {
          setProfileStats(profRes.data);
        }
      }
    } catch (err) {
      toast.error('Failed to load profile details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (subTab === 'listings') {
      fetchListings();
    } else if (subTab === 'transactions') {
      fetchTransactionsAndStats();
    } else if (subTab === 'profile') {
      fetchProfile();
    }
  }, [subTab]);

  // Handle auto-prefill when selecting inventory item
  const handleInvItemChange = (itemId: string) => {
    setSelectedInvItem(itemId);
    const item = inventoryItems.find(i => i.id === itemId);
    if (item) {
      setProductName(item.product_name);
      setCategory(typeof item.category === 'string' ? item.category : 'Others');
      setQuantity(item.quantity);
      setUnit(item.unit);
      setPrice(item.selling_price);
      setExpiryDate(item.expiry_date ? item.expiry_date.split('T')[0] : '');
      setPickupLocation(item.supplier || '');
    }
  };

  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName || quantity <= 0 || !expiryDate || !pickupLocation || !availabilityWindow) {
      toast.error('Please fill in all required fields.');
      return;
    }
    if (listingType !== 'DONATION' && price <= 0) {
      toast.error('Paid listings must have price greater than 0.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await marketplaceService.createListing({
        inventory_item_id: selectedInvItem || null,
        product_name: productName,
        category,
        listing_type: listingType,
        quantity_available: quantity,
        unit,
        price_per_unit: price,
        expiry_date: expiryDate,
        pickup_location: pickupLocation,
        availability_window: availabilityWindow,
        description
      });

      if (res.success) {
        toast.success('Food listed on marketplace successfully!');
        setIsModalOpen(false);
        // Reset form
        setSelectedInvItem('');
        setProductName('');
        setQuantity(0);
        setPrice(0);
        setExpiryDate('');
        setPickupLocation('');
        setDescription('');
        fetchListings();
      } else {
        toast.error(res.error || 'Failed to list food.');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error occurred while listing food.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await marketplaceService.updateDonorProfile({
        organization_name: profileName,
        business_type: businessType,
        phone,
        address
      });

      if (res.success) {
        toast.success('Profile updated successfully!');
        // Update user session cache
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          user.organization_name = profileName;
          user.business_type = businessType;
          user.phone = phone;
          user.address = address;
          localStorage.setItem('user', JSON.stringify(user));
        }
        fetchProfile();
      } else {
        toast.error(res.error || 'Failed to update profile.');
      }
    } catch (err: any) {
      toast.error('Error updating profile');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub tabs navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4 text-xs font-semibold">
        <button
          onClick={() => setSubTab('listings')}
          className={`pb-2.5 px-1 border-b-2 flex items-center gap-1.5 transition-all ${
            subTab === 'listings'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Store className="w-4 h-4" /> My Listed Surplus
        </button>
        <button
          onClick={() => setSubTab('transactions')}
          className={`pb-2.5 px-1 border-b-2 flex items-center gap-1.5 transition-all ${
            subTab === 'transactions'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Receipt className="w-4 h-4" /> Sales & Transactions
        </button>
        <button
          onClick={() => setSubTab('profile')}
          className={`pb-2.5 px-1 border-b-2 flex items-center gap-1.5 transition-all ${
            subTab === 'profile'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <User className="w-4 h-4" /> My Public Donor Profile
        </button>
      </div>

      {subTab === 'listings' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Active Redistribution Listings</h3>
              <p className="text-xs text-slate-500">Food listed for claiming or purchase by community partners & NGOs.</p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn-primary flex items-center gap-1.5 py-2 px-3 text-xs"
            >
              <Plus className="w-4 h-4" /> List Surplus Food
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center p-12">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
            </div>
          ) : listings.length === 0 ? (
            <div className="glass-panel p-12 text-center text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
              <Store className="w-12 h-12 mx-auto text-slate-400 mb-3 opacity-60" />
              <h4 className="text-sm font-bold text-slate-800 dark:text-white">No active listings found</h4>
              <p className="text-xs text-slate-500 mt-1">You haven't listed any surplus items yet. Click the button above to start.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {listings.map((l) => (
                <div key={l.id} className="glass-card p-5 border border-slate-200 dark:border-slate-800 relative space-y-3">
                  <span className={`absolute top-4 right-4 px-2 py-0.5 text-[10px] font-extrabold rounded-full border ${
                    l.listing_type === 'DONATION'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                  }`}>
                    {l.listing_type === 'DONATION' ? 'FREE DONATION' : 'PAID SURPLUS'}
                  </span>

                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm pr-20">{l.product_name}</h4>
                    <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded font-semibold mt-1 inline-block">
                      {l.category}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{l.description || 'No description provided.'}</p>

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <p className="text-slate-500">Remaining Qty</p>
                      <p className="font-bold text-slate-850 dark:text-white">{l.quantity_available} {l.unit}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Unit Price</p>
                      <p className="font-bold text-slate-850 dark:text-white">{l.listing_type === 'DONATION' ? 'Free' : `₹${l.price_per_unit}`}</p>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-[10px] text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Expires: {l.expiry_date}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="truncate">Pickup: {l.pickup_location}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === 'transactions' && (
        <div className="space-y-6">
          {/* Key Metrics cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card p-4 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
              <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Total Revenue</p>
                <p className="text-lg font-black text-slate-900 dark:text-white">₹{stats?.total_sales_revenue.toFixed(2) || '0.00'}</p>
              </div>
            </div>

            <div className="glass-card p-4 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
              <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Successful Sales</p>
                <p className="text-lg font-black text-slate-900 dark:text-white">{stats?.successful_transactions || 0}</p>
              </div>
            </div>

            <div className="glass-card p-4 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
              <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Pending Checkout</p>
                <p className="text-lg font-black text-slate-900 dark:text-white">{stats?.pending_transactions || 0}</p>
              </div>
            </div>

            <div className="glass-card p-4 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
              <div className="p-3 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Qty Sold (Surplus)</p>
                <p className="text-lg font-black text-slate-900 dark:text-white">{stats?.quantity_redistributed || 0} units</p>
              </div>
            </div>
          </div>

          {/* Refunded & Failed counts info */}
          {stats && (stats.failed_transactions > 0 || stats.refunded_transactions > 0) && (
            <div className="p-3 bg-slate-100 dark:bg-slate-800/50 rounded-xl flex gap-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
              {stats.refunded_transactions > 0 && (
                <span>🔄 Refunded Claims: <span className="font-bold text-indigo-600">{stats.refunded_transactions}</span></span>
              )}
              {stats.failed_transactions > 0 && (
                <span>✕ Failed Payments: <span className="font-bold text-rose-500">{stats.failed_transactions}</span></span>
              )}
            </div>
          )}

          {/* Transaction listings */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Transaction Logs</h4>
            
            {loading ? (
              <div className="flex justify-center p-8">
                <RefreshCw className="w-5 h-5 animate-spin text-emerald-500" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                No payment transactions yet.
              </div>
            ) : (
              <div className="glass-panel overflow-hidden border border-slate-200 dark:border-slate-800 text-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100/70 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-350">
                        <th className="py-2.5 px-3">Transaction ID</th>
                        <th className="py-2.5 px-3">Recipient NGO</th>
                        <th className="py-2.5 px-3">Food Item</th>
                        <th className="py-2.5 px-3">Quantity</th>
                        <th className="py-2.5 px-3">Amount</th>
                        <th className="py-2.5 px-3">Payment Status</th>
                        <th className="py-2.5 px-3">Order Status</th>
                        <th className="py-2.5 px-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {transactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500">
                            {tx.payment_id || tx.id.slice(0, 8).toUpperCase()}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-white">
                            {tx.recipient_name}
                          </td>
                          <td className="py-2.5 px-3 font-medium">
                            {tx.product_name}
                          </td>
                          <td className="py-2.5 px-3">
                            {tx.quantity} {tx.unit}
                          </td>
                          <td className="py-2.5 px-3 font-bold">
                            {tx.payment_required ? `₹${tx.total_amount}` : 'Free'}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${
                              tx.payment_status === 'PAYMENT_SUCCESS'
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                : tx.payment_status === 'PENDING' || tx.payment_status === 'PAYMENT_INITIATED'
                                ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                : tx.payment_status === 'NOT_REQUIRED'
                                ? 'bg-slate-100 text-slate-655 border-slate-200'
                                : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                            }`}>
                              {tx.payment_status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${
                              tx.order_status === 'COMPLETED'
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                : tx.order_status === 'ORDER_CONFIRMED' || tx.order_status === 'PICKUP_SCHEDULED'
                                ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                                : tx.order_status === 'PENDING'
                                ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                            }`}>
                              {tx.order_status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-[10px] text-slate-500">
                            {new Date(tx.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile form */}
          <div className="lg:col-span-2 glass-card p-6 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-850">
              <Building2 className="w-5 h-5 text-emerald-500" />
              <h4 className="font-bold text-slate-900 dark:text-white">Profile Customization Details</h4>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs font-semibold">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-500">Business / Organization Name</label>
                  <input
                    type="text"
                    required
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 p-2.5 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-500">Business Classification Type</label>
                  <select
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 p-2.5 text-xs text-slate-900 dark:text-white"
                  >
                    <option value="Supermarket">Supermarket</option>
                    <option value="Restaurant">Restaurant</option>
                    <option value="Hotel">Hotel</option>
                    <option value="Bakery">Bakery</option>
                    <option value="Other Wholesale">Other Wholesale</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-500">Contact Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 p-2.5 text-xs text-slate-900 dark:text-white"
                  placeholder="+91 XXXXX XXXXX"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-500">Public Location Address</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 p-2.5 text-xs text-slate-900 dark:text-white min-h-[80px]"
                  placeholder="Street, City, Postal Code"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary py-2 px-4 text-xs font-semibold"
                >
                  {submitting ? 'Updating...' : 'Save Public Profile'}
                </button>
              </div>
            </form>
          </div>

          {/* Readonly stats sidebar */}
          <div className="glass-card p-6 border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto text-emerald-500 font-bold text-xl">
                {profileName.charAt(0).toUpperCase()}
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-base">{profileName}</h4>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">{businessType}</p>
              </div>
              <div className="inline-flex px-2 py-0.5 bg-emerald-500/10 text-emerald-600 rounded-full border border-emerald-500/30 text-[10px] font-bold">
                ✓ Verified Business
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-850 text-xs">
              <h5 className="font-bold text-slate-900 dark:text-white">Redistribution Statistics</h5>
              
              <div className="space-y-2 text-slate-600 dark:text-slate-350 font-medium">
                <div className="flex justify-between">
                  <span>Completed Donations</span>
                  <span className="font-black text-slate-900 dark:text-white">{profileStats?.completed_donations || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Surplus Sales</span>
                  <span className="font-black text-slate-900 dark:text-white">{profileStats?.completed_surplus_transactions || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Qty Redistributed</span>
                  <span className="font-black text-slate-900 dark:text-white">{profileStats?.total_units_redistributed || 0} units</span>
                </div>
                <div className="flex justify-between">
                  <span>Active Listings</span>
                  <span className="font-black text-slate-900 dark:text-white">{profileStats?.active_listings_count || 0}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-850 text-xs">
              <h5 className="font-bold text-slate-900 dark:text-white">Trust Badges</h5>
              <div className="flex flex-wrap gap-1.5">
                {profileStats?.trust_indicators.map((badge: string, i: number) => (
                  <span key={i} className="px-2 py-0.5 bg-indigo-500/10 text-indigo-600 rounded text-[9px] font-bold">
                    ✓ {badge}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Listing Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-lg bg-white dark:bg-slate-900 p-6 space-y-4 border border-emerald-500/30 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-950 dark:text-white">List Surplus Food on Marketplace</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-655 font-bold">✕</button>
            </div>

            <form onSubmit={handleCreateListing} className="space-y-4 text-xs font-semibold">
              <div className="space-y-1.5">
                <label className="text-slate-500">Prefill from Existing Inventory Stock Item (Optional)</label>
                <select
                  value={selectedInvItem}
                  onChange={(e) => handleInvItemChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 p-2 text-xs text-slate-900 dark:text-white"
                >
                  <option value="">-- Choose inventory item --</option>
                  {inventoryItems.map(item => (
                    <option key={item.id} value={item.id}>{item.product_name} ({item.quantity} {item.unit} available)</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-500">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 p-2 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-500">Category *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 p-2 text-xs text-slate-900 dark:text-white"
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
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-500">Listing Type *</label>
                  <select
                    value={listingType}
                    onChange={(e) => setListingType(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 p-2 text-xs text-slate-900 dark:text-white"
                  >
                    <option value="DONATION">DONATION (Free)</option>
                    <option value="PAID_SURPLUS">PAID SURPLUS</option>
                    <option value="DISCOUNTED_SURPLUS">DISCOUNTED SURPLUS</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-500">Quantity to List *</label>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      required
                      min="0.1"
                      step="any"
                      value={quantity}
                      onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                      className="w-2/3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 p-2 text-xs text-slate-900 dark:text-white"
                    />
                    <input
                      type="text"
                      required
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-1/3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 p-2 text-xs text-slate-900 dark:text-white"
                      placeholder="kg/packs"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-500">Price per Unit (₹) *</label>
                  <input
                    type="number"
                    disabled={listingType === 'DONATION'}
                    value={listingType === 'DONATION' ? 0 : price}
                    onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 p-2 text-xs text-slate-900 dark:text-white disabled:opacity-40"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-500">Expiry Date *</label>
                  <input
                    type="date"
                    required
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 p-2 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-500">Availability Window *</label>
                  <input
                    type="text"
                    required
                    value={availabilityWindow}
                    onChange={(e) => setAvailabilityWindow(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 p-2 text-xs text-slate-900 dark:text-white"
                    placeholder="e.g. 9 AM - 5 PM"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-500">Pickup Location *</label>
                <input
                  type="text"
                  required
                  value={pickupLocation}
                  onChange={(e) => setPickupLocation(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 p-2 text-xs text-slate-900 dark:text-white"
                  placeholder="Business outlet address"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-500">Listing Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 p-2 text-xs text-slate-900 dark:text-white min-h-[60px]"
                  placeholder="Notes on packaging, condition, or pick-up"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-655 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary py-2 px-4 text-xs font-semibold"
                >
                  {submitting ? 'Listing...' : 'Confirm Listing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BusinessMarketplaceTab;
