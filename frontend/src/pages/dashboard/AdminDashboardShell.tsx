import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { adminService, AdminStats } from '@/services/admin';
import { User } from '@/types';
import { ShieldCheck, LogOut, Users, Building2, HandHeart, ClipboardCheck, Store, ShoppingBag, Search, CheckCircle2, Ban, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

const emptyStats: AdminStats = { total_users: 0, businesses: 0, ngos: 0, pending_ngos: 0, active_listings: 0, total_orders: 0 };

export const AdminDashboardShell: React.FC = () => {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<AdminStats>(emptyStats);
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [statsRes, usersRes] = await Promise.all([
        adminService.getStats(),
        adminService.getUsers(search ? { search } : undefined),
      ]);
      if (statsRes.success && statsRes.data) setStats(statsRes.data);
      if (usersRes.success && usersRes.data) setUsers(usersRes.data);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load admin data.');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const updateVerification = async (target: User, verified: boolean) => {
    try {
      await adminService.setNgoVerification(target.id, verified);
      toast.success(verified ? 'NGO verified.' : 'NGO verification removed.');
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Unable to update verification.');
    }
  };

  const updateStatus = async (target: User, active: boolean) => {
    try {
      await adminService.setUserStatus(target.id, active);
      toast.success(active ? 'User activated.' : 'User deactivated.');
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Unable to update account.');
    }
  };

  const cards = [
    { label: 'Total Users', value: stats.total_users, icon: Users },
    { label: 'Businesses', value: stats.businesses, icon: Building2 },
    { label: 'NGOs', value: stats.ngos, icon: HandHeart },
    { label: 'Pending NGOs', value: stats.pending_ngos, icon: ClipboardCheck },
    { label: 'Active Listings', value: stats.active_listings, icon: Store },
    { label: 'Orders', value: stats.total_orders, icon: ShoppingBag },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 transition-colors">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="glass-panel p-6 flex flex-wrap gap-4 justify-between items-center border border-blue-500/30">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl"><ShieldCheck className="w-6 h-6" /></div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Admin Operations Portal</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">System Administration • Logged in as {user?.full_name} ({user?.email})</p>
            </div>
          </div>
          <button onClick={logout} className="btn-secondary py-2 px-4 text-xs font-semibold"><LogOut className="w-4 h-4" /> Sign Out</button>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {cards.map(({ label, value, icon: Icon }) => (
            <div key={label} className="glass-card p-4 border border-blue-500/10">
              <Icon className="w-4 h-4 text-blue-500 mb-2" />
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
              <div className="text-[11px] text-slate-500">{label}</div>
            </div>
          ))}
        </div>

        <section className="glass-card p-5 border border-blue-500/20">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">User & NGO Verification</h2>
              <p className="text-xs text-slate-500">Approve NGO registrations and manage account access.</p>
            </div>
            <div className="flex gap-2">
              <div className="relative"><Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..." className="pl-9 pr-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white" /></div>
              <button onClick={load} className="btn-secondary px-3 py-2 text-xs"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <tr><th className="py-3 pr-4">User</th><th className="py-3 pr-4">Role</th><th className="py-3 pr-4">Verification</th><th className="py-3 pr-4">Status</th><th className="py-3 text-right">Actions</th></tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100 dark:border-slate-800/70">
                    <td className="py-3 pr-4"><div className="font-semibold text-slate-800 dark:text-white">{u.organization_name || u.full_name}</div><div className="text-slate-500">{u.email}</div></td>
                    <td className="py-3 pr-4"><span className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 font-semibold">{u.role}</span></td>
                    <td className="py-3 pr-4"><span className={u.is_verified ? 'text-emerald-600 font-semibold' : 'text-amber-600 font-semibold'}>{u.is_verified ? 'Verified' : 'Pending'}</span></td>
                    <td className="py-3 pr-4"><span className={u.is_active ? 'text-emerald-600' : 'text-rose-600'}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {u.role === 'NGO' && !u.is_verified && <button onClick={() => updateVerification(u, true)} className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 font-semibold inline-flex gap-1 items-center"><CheckCircle2 className="w-3.5 h-3.5" /> Verify</button>}
                        {u.role === 'NGO' && u.is_verified && <button onClick={() => updateVerification(u, false)} className="px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-600 font-semibold">Unverify</button>}
                        {u.id !== user?.id && <button onClick={() => updateStatus(u, !u.is_active)} className={`px-3 py-1.5 rounded-lg font-semibold inline-flex gap-1 items-center ${u.is_active ? 'bg-rose-500/10 text-rose-600' : 'bg-blue-500/10 text-blue-600'}`}><Ban className="w-3.5 h-3.5" /> {u.is_active ? 'Deactivate' : 'Activate'}</button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && users.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-slate-500">No users found.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};
