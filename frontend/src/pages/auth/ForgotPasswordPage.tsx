import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { KeyRound, Mail, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { authService } from '@/services/auth';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [devResetPath, setDevResetPath] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter a valid email address');
      return;
    }
    try {
      setIsSubmitting(true);
      const response = await authService.forgotPassword(email);
      if (!response.success) throw new Error(response.message || 'Unable to prepare password reset.');
      const resetUrl = response.data?.reset_url;
      if (resetUrl) {
        try {
          const parsed = new URL(resetUrl);
          setDevResetPath(`${parsed.pathname}${parsed.search}`);
        } catch {
          setDevResetPath(resetUrl);
        }
      }
      setSubmitted(true);
      toast.success('Password reset instructions prepared.');
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Unable to process request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-900 transition-colors">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md glass-card p-8 shadow-2xl border border-slate-200/80 dark:border-slate-800">
        <div className="text-center mb-6">
          <div className="inline-flex p-3 rounded-2xl bg-orange-500/10 text-orange-500 mb-3"><KeyRound className="w-8 h-8" /></div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Forgot Password</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Enter your registered email to receive a password reset link</p>
        </div>

        {submitted ? (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-4 rounded-xl text-center space-y-3">
            <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
              If an account with <strong>{email}</strong> exists, instructions to reset your password have been prepared.
            </p>
            {devResetPath && (
              <Link to={devResetPath} className="btn-primary py-2 px-4 text-xs font-semibold inline-block">Continue to Reset Password</Link>
            )}
            <div><Link to="/login" className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:underline">Return to Login</Link></div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Registered Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@organization.com" required className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:text-white" />
              </div>
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full btn-primary py-2.5 text-sm font-semibold disabled:opacity-50">
              {isSubmitting ? 'Preparing Reset...' : 'Send Reset Link'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link to="/login" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white"><ArrowLeft className="w-3.5 h-3.5" /> Back to Login</Link>
        </div>
      </motion.div>
    </div>
  );
};
