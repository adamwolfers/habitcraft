'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { setOnAuthFailure } from '@/lib/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: { name?: string; email?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = user !== null;

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        let response = await fetch(`${API_BASE_URL}/api/v1/users/me`, {
          credentials: 'include'
        });

        // If 401, try to refresh the token and retry
        if (response.status === 401) {
          const refreshResponse = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
            method: 'POST',
            credentials: 'include'
          });

          if (refreshResponse.ok) {
            // Retry the original request with new token
            response = await fetch(`${API_BASE_URL}/api/v1/users/me`, {
              credentials: 'include'
            });
          }
        }

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        }
      } catch {
        // No valid session
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    setUser(data.user);
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    });

    setUser(null);
  }, []);

  const updateUser = useCallback(async (updates: { name?: string; email?: string }) => {
    const response = await fetch(`${API_BASE_URL}/api/v1/users/me`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Update failed');
    }

    setUser(data);
  }, []);

  // Configure auth failure callback to handle token refresh failures
  useEffect(() => {
    setOnAuthFailure(() => {
      logout();
    });

    // Cleanup: remove the callback when component unmounts
    return () => {
      setOnAuthFailure(null);
    };
  }, [logout]);

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
