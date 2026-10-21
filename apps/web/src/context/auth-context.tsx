import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient, ApiClientError } from '../lib/api';

export interface AuthUser {
  publicId: string;
  username: string;
  displayName: string;
  role: 'RECEPTION' | 'CASHIER' | 'ADMIN';
  cubicleId: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, pass: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_STORAGE_KEY = 'cubiora_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const cached = sessionStorage.getItem(USER_STORAGE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const res = await apiClient<{ success: boolean; data: AuthUser }>('/auth/me');
      if (res.data) {
        setUser(res.data);
        sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(res.data));
      } else {
        setUser(null);
        sessionStorage.removeItem(USER_STORAGE_KEY);
      }
    } catch {
      setUser(null);
      sessionStorage.removeItem(USER_STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (username: string, pass: string): Promise<AuthUser> => {
    try {
      const res = await apiClient<{ success: boolean; data: AuthUser }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password: pass }),
      });

      setUser(res.data);
      sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(res.data));
      return res.data;
    } catch (err) {
      if (err instanceof ApiClientError) {
        throw new Error(err.message || 'Error al iniciar sesión');
      }
      throw err;
    }
  };

  const logout = async () => {
    try {
      await apiClient('/auth/logout', { method: 'POST' });
    } catch {
      // Ignorar error al cerrar sesión
    } finally {
      setUser(null);
      sessionStorage.removeItem(USER_STORAGE_KEY);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

const defaultAuthContext: AuthContextType = {
  user: null,
  isLoading: false,
  login: async () => ({ publicId: '', username: '', displayName: '', role: 'RECEPTION', cubicleId: null }),
  logout: async () => {},
  refreshUser: async () => {},
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    return defaultAuthContext;
  }
  return context;
};
