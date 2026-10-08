import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getDashboardRouteForRole } from '@/utils/navigation';

export const UnauthorizedPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleReturn = () => {
    if (user) {
      navigate(getDashboardRouteForRole(user.role), { replace: true });
    } else {
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-900 transition-colors">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md glass-card p-8 text-center shadow-2xl border border-rose-200 dark:border-rose-900/50"
      >
        <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-9 h-9" />
        </div>

        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">403 - Access Forbidden</h1>

        <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
          You do not have the required permissions to view this portal. Access is restricted to authorized roles.
        </p>

        <button
          onClick={handleReturn}
          className="btn-primary py-2.5 px-6 text-sm font-semibold inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Dashboard
        </button>
      </motion.div>
    </div>
  );
};
