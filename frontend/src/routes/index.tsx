import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { LandingPage } from '@/pages/LandingPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { UnauthorizedPage } from '@/pages/auth/UnauthorizedPage';
import { BusinessDashboardShell } from '@/pages/dashboard/BusinessDashboardShell';
import { NgoDashboardShell } from '@/pages/dashboard/NgoDashboardShell';
import { AdminDashboardShell } from '@/pages/dashboard/AdminDashboardShell';

export const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        <Route
          path="/business/dashboard"
          element={
            <ProtectedRoute allowedRoles={['BUSINESS']}>
              <BusinessDashboardShell />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ngo/dashboard"
          element={
            <ProtectedRoute allowedRoles={['NGO']}>
              <NgoDashboardShell />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminDashboardShell />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
