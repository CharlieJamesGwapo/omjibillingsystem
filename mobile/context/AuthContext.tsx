import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { User } from '../types';
import { login as loginApi } from '../services/auth';
import { getUser as getUserApi } from '../services/users';
import {
  saveTokens,
  saveUser as saveUserToStorage,
  getUser as getUserFromStorage,
  getAccessToken,
  clearAll,
} from '../utils/storage';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    (async () => {
      try {
        const token = await getAccessToken();
        if (token) {
          const storedUser = await getUserFromStorage();
          if (storedUser) {
            setUser(storedUser);
          }
        }
      } catch {
        // Token or user retrieval failed; start fresh
        await clearAll();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (phone: string, password: string) => {
    const response = await loginApi(phone, password);
    await saveTokens(response.tokens.access_token, response.tokens.refresh_token);
    await saveUserToStorage(response.user);
    setUser(response.user);
  }, []);

  const logout = useCallback(async () => {
    await clearAll();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!user) return;
    try {
      const updated = await getUserApi(user.id);
      await saveUserToStorage(updated);
      setUser(updated);
    } catch {
      // If fetch fails, keep existing user data
    }
  }, [user]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      logout,
      refreshUser,
    }),
    [user, isLoading, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
