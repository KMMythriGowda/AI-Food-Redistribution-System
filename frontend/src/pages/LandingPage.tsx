import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, BrainCircuit, HeartHandshake, Leaf, PackageCheck, ShieldCheck, Truck } from 'lucide-react';

const features = [
  {
    icon: PackageCheck,
    title: 'Smart Inventory',
    text: 'Track stock, expiry dates, low-stock items and surplus food in one place.',
  },
  {
    icon: BrainCircuit,
    title: 'AI Insights',
    text: 'Use demand forecasts, waste-risk analysis and reorder recommendations.',
  },
  {
    icon: HeartHandshake,
    title: 'NGO Redistribution',
    text: 'Connect surplus food from businesses with verified NGOs for redistribution.',
  },
  {
    icon: Truck,
    title: 'Pickup Management',
    text: 'Manage requests, orders and pickup activities through a simple workflow.',
  },
  {
    icon: BarChart3,
    title: 'Impact Analytics',
    text: 'View redistribution activity and sustainability indicators from the dashboard.',
  },
  {
    icon: ShieldCheck,
    title: 'Role-Based Access',
    text: 'Separate and secure experiences for businesses, NGOs and administrators.',
  },
];

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white">
      <header className="border-b border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto h-20 px-5 sm:px-6 lg:px-8 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Leaf className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xl font-bold leading-tight">FoodSave AI</div>
              <div className="text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400">
                Redistribution & Inventory
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="px-4 py-2.5 rounded-xl font-semibold text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Sign In
            </Link>
            <Link to="/register" className="btn-primary px-5 py-2.5 text-sm">
              Register
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute -top-28 -left-28 w-96 h-96 rounded-full bg-emerald-300/20 blur-3xl pointer-events-none" />
          <div className="absolute top-16 -right-32 w-[28rem] h-[28rem] rounded-full bg-blue-300/15 blur-3xl pointer-events-none" />

          <div className="relative max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 py-20 lg:py-28">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20 text-sm font-semibold">
                  <Leaf className="w-4 h-4" />
                  Infosys Springboard Project
                </div>

                <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.08] text-slate-900 dark:text-white">
                  AI-Based Food Redistribution
                  <span className="block text-emerald-600 dark:text-emerald-400 mt-2">for Waste Reduction</span>
                </h1>

                <p className="mt-6 text-base sm:text-lg leading-8 text-slate-600 dark:text-slate-300 max-w-2xl">
                  A user-friendly platform that helps businesses manage inventory, identify surplus food and connect with NGOs so usable food reaches people instead of becoming waste.
                </p>

                <div className="mt-8 flex flex-wrap gap-4">
                  <Link to="/login" className="btn-primary px-6 py-3 text-base">
                    Sign In
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                  <Link
                    to="/register"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    Create Account
                  </Link>
                </div>
              </div>

              <div className="glass-card p-6 sm:p-8 shadow-2xl">
                <div className="flex items-center justify-between gap-4 mb-6">
                  <div>
                    <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Simple workflow</p>
                    <h2 className="text-2xl font-bold mt-1">From inventory to impact</h2>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                    <HeartHandshake className="w-6 h-6" />
                  </div>
                </div>

                <div className="space-y-3">
                  {[
                    ['1', 'Business adds inventory', 'Track quantity, expiry and low-stock items.'],
                    ['2', 'System identifies risk', 'AI and rules highlight demand and waste risk.'],
                    ['3', 'Surplus is redistributed', 'NGOs can discover and request suitable food.'],
                    ['4', 'Impact is monitored', 'Dashboards summarize activity and outcomes.'],
                  ].map(([number, title, text]) => (
                    <div key={number} className="flex gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-700/60">
                      <div className="w-9 h-9 shrink-0 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                        {number}
                      </div>
                      <div>
                        <h3 className="font-semibold">{title}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 border-y border-slate-200 dark:border-slate-800">
          <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 py-20">
            <div className="text-center max-w-2xl mx-auto">
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Core System Capabilities</p>
              <h2 className="mt-3 text-3xl sm:text-4xl font-bold">One platform, three connected roles</h2>
              <p className="mt-4 text-slate-500 dark:text-slate-400">The technical complexity stays behind the scenes while users get a clear and simple experience.</p>
            </div>

            <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {features.map(({ icon: Icon, title, text }) => (
                <div key={title} className="glass-card p-6">
                  <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="mt-5 text-lg font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-5 sm:px-6 lg:px-8 py-20">
          <div className="rounded-3xl bg-slate-900 dark:bg-slate-800 text-white px-6 py-10 sm:p-12 text-center shadow-2xl">
            <h2 className="text-3xl font-bold">Ready to reduce food waste?</h2>
            <p className="mt-3 text-slate-300 max-w-2xl mx-auto">Sign in to access your dashboard or register your organization to join the redistribution network.</p>
            <div className="mt-7 flex flex-wrap justify-center gap-4">
              <Link to="/login" className="btn-primary px-6 py-3">Sign In</Link>
              <Link to="/register" className="px-6 py-3 rounded-xl bg-white text-slate-900 font-semibold hover:bg-slate-100 transition">Register</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 py-7 flex flex-col sm:flex-row gap-3 items-center justify-between text-sm text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
            <Leaf className="w-4 h-4 text-emerald-600" />
            FoodSave AI
          </div>
          <span>AI-Based Food Redistribution System for Waste Reduction</span>
        </div>
      </footer>
    </div>
  );
};
