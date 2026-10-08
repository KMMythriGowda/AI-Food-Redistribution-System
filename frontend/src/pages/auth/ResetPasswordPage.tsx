import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { authService } from '@/services/auth';

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error('This password reset link is missing its token. Request a new link.');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await authService.resetPassword(token, password);
      if (!response.success) throw new Error(response.message || 'Password reset failed.');
      toast.success('Password updated successfully! Please sign in.');
      navigate('/login', { replace: true });
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Password reset failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-900 transition-colors">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md glass-card p-8 shadow-2xl border border-slate-200/80 dark:border-slate-800">
        <div className="text-center mb-6">
          <div className="inline-flex p-3 rounded-2xl bg-blue-500/10 text-blue-500 mb-3"><ShieldCheck className="w-8 h-8" /></div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reset Password</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Choose a strong new password for your account</p>
        </div>

        {!token && (
          <div className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300">
            No reset token was found. Please request a new password reset link.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">New Password</label>
            <div className="relative"><Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-white" /></div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Confirm New Password</label>
            <div className="relative"><Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" /><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" required className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-white" /></div>
          </div>
          <button type="submit" disabled={!token || isSubmitting} className="w-full btn-primary py-2.5 text-sm font-semibold disabled:opacity-50">{isSubmitting ? 'Updating...' : 'Update Password'}</button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-500">Remember your password?{' '}<Link to="/login" className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">Sign In</Link></div>
      </motion.div>
    </div>
  );
};
