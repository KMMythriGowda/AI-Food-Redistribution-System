import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, UserRole } from '@/types';
import { authService, LoginPayload, RegisterPayload } from '@/services/auth';
import toast from 'react-hot-toast';

export interface RegistrationResult {
  role: UserRole;
  requiresVerification: boolean;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  role: UserRole | null;
  login: (payload: LoginPayload) => Promise<UserRole>;
  register: (payload: RegisterPayload) => Promise<RegistrationResult>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(() => localStorage.getItem('access_token'));
  const [refreshToken, setRefreshToken] = useState<string | null>(() => localStorage.getItem('refresh_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const isAuthenticated = Boolean(user && accessToken);
  const role = user?.role || null;

  const clearLocalSession = () => {
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  };

  const loadUser = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await authService.getCurrentUser();
      if (response.success && response.data?.user) {
        setUser(response.data.user);
      } else {
        clearLocalSession();
      }
    } catch {
      clearLocalSession();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  const login = async (payload: LoginPayload): Promise<UserRole> => {
    setIsLoading(true);
    try {
      const response = await authService.login(payload);
      const data = response.data;
      if (response.success && data?.user && data.access_token && data.refresh_token) {
        setUser(data.user);
        setAccessToken(data.access_token);
        setRefreshToken(data.refresh_token);
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
        toast.success(`Welcome back, ${data.user.full_name}!`);
        return data.user.role;
      }
      throw new Error(response.message || 'Login failed');
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || 'Invalid email or password.';
      toast.error(msg);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload: RegisterPayload): Promise<RegistrationResult> => {
    setIsLoading(true);
    try {
      const response = await authService.register(payload);
      const data = response.data;
      if (!response.success || !data?.user) {
        throw new Error(response.message || 'Registration failed');
      }

      const requiresVerification = Boolean(data.requires_verification || !data.user.is_verified);
      if (requiresVerification) {
        clearLocalSession();
        toast.success('Registration complete. Your NGO account is waiting for admin verification.');
        return { role: data.user.role, requiresVerification: true };
      }

      if (!data.access_token || !data.refresh_token) {
        throw new Error('Registration succeeded but authentication tokens were not returned.');
      }

      setUser(data.user);
      setAccessToken(data.access_token);
      setRefreshToken(data.refresh_token);
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      toast.success(`Account created successfully! Welcome, ${data.user.full_name}.`);
      return { role: data.user.role, requiresVerification: false };
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || 'Registration failed.';
      toast.error(msg);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    const storedRefresh = localStorage.getItem('refresh_token');
    // Fire the server-side revocation while the access token still exists, then clear locally.
    authService.logout(storedRefresh).catch(() => undefined);
    clearLocalSession();
    toast.success('Logged out successfully.');
  };

  const refreshUser = async () => {
    await loadUser();
  };

  return (
    <AuthContext.Provider value={{
      user, accessToken, refreshToken, isAuthenticated, isLoading, role,
      login, register, logout, refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
