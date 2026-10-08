import { UserRole } from '@/types';

export const getDashboardRouteForRole = (role?: UserRole): string => {
  switch (role) {
    case 'BUSINESS':
      return '/business/dashboard';
    case 'NGO':
      return '/ngo/dashboard';
    case 'ADMIN':
      return '/admin/dashboard';
    default:
      return '/login';
  }
};
