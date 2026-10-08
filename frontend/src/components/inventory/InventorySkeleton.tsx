import React from 'react';

export const InventorySkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Metric Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass-card p-5 space-y-3">
            <div className="flex justify-between items-center">
              <div className="h-4 bg-slate-300 dark:bg-slate-700 rounded w-1/2"></div>
              <div className="w-9 h-9 bg-slate-300 dark:bg-slate-700 rounded-xl"></div>
            </div>
            <div className="h-8 bg-slate-300 dark:bg-slate-700 rounded w-3/4"></div>
            <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-2/3"></div>
          </div>
        ))}
      </div>

      {/* Filter Bar Skeleton */}
      <div className="glass-panel p-4 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="h-10 bg-slate-300 dark:bg-slate-700 rounded-xl w-full md:w-80"></div>
        <div className="flex gap-2 w-full md:w-auto">
          <div className="h-10 bg-slate-300 dark:bg-slate-700 rounded-xl w-32"></div>
          <div className="h-10 bg-slate-300 dark:bg-slate-700 rounded-xl w-32"></div>
          <div className="h-10 bg-slate-300 dark:bg-slate-700 rounded-xl w-24"></div>
        </div>
      </div>

      {/* Table / Grid Skeleton */}
      <div className="glass-panel p-6">
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-slate-200/50 dark:border-slate-800/50">
              <div className="flex items-center gap-3 w-1/3">
                <div className="w-10 h-10 bg-slate-300 dark:bg-slate-700 rounded-xl"></div>
                <div className="space-y-2 w-full">
                  <div className="h-4 bg-slate-300 dark:bg-slate-700 rounded w-3/4"></div>
                  <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2"></div>
                </div>
              </div>
              <div className="h-4 bg-slate-300 dark:bg-slate-700 rounded w-20"></div>
              <div className="h-4 bg-slate-300 dark:bg-slate-700 rounded w-24"></div>
              <div className="h-6 bg-slate-300 dark:bg-slate-700 rounded-full w-20"></div>
              <div className="h-8 bg-slate-300 dark:bg-slate-700 rounded-xl w-16"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
