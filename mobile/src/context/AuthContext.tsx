import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, LoginCredentials, RegisterData, ProfileUpdate, PasswordChange } from '@/types';
import { authApi } from '@/lib/auth';
import { storage } from '@/lib/storage';
import { seedE2ESession } from '@/lib/e2eSession';
import { mutationQueue, offlineStorage } from '@/lib/offline';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: ProfileUpdate) => Promise<void>;
  changePassword: (change: PasswordChange) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = !!user;

  // Check for existing auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Before the first read, so an E2E launch comes up already signed in.
        // No-op in every build that does not set EXPO_PUBLIC_E2E.
        await seedE2ESession();
        const hasTokens = await storage.hasTokens();
        if (hasTokens) {
          const currentUser = await authApi.getCurrentUser();
          setUser(currentUser);
        }
      } catch {
        await storage.clearTokens();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    try {
      setError(null);
      const result = await authApi.login(credentials);
      setUser(result.user);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      throw err;
    }
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    try {
      setError(null);
      const result = await authApi.register(data);
      setUser(result.user);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setError(message);
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      // Clear offline data on logout
      await mutationQueue.clear();
      await offlineStorage.remove('query-cache');
      setUser(null);
    }
  }, []);

  // Leaves `error` alone: that state is the auth screens' banner. A failed save
  // is rethrown for the Profile screen to show beside the field it concerns.
  const updateProfile = useCallback(async (updates: ProfileUpdate) => {
    const updatedUser = await authApi.updateProfile(updates);
    setUser(updatedUser);
  }, []);

  // On success the server revokes every refresh token, this device's too, so
  // the session would die at the next token refresh. Signing in again with
  // the new password replaces it. Should that fail, the user is signed out
  // cleanly instead -- the change itself succeeded, so nothing is thrown. A
  // failed change is rethrown for the Profile screen to show.
  const changePassword = useCallback(
    async (change: PasswordChange) => {
      await authApi.changePassword(change);
      try {
        const result = await authApi.login({
          email: user?.email ?? '',
          password: change.newPassword,
        });
        setUser(result.user);
      } catch {
        await logout();
      }
    },
    [user, logout]
  );

  // authApi.deleteAccount clears the tokens; this drops what logout drops, so
  // nothing queued or cached for the deleted account survives it. A failure
  // is rethrown with nothing cleared, so the Profile screen can show it and
  // the user can retry.
  const deleteAccount = useCallback(async (password: string) => {
    await authApi.deleteAccount(password);
    await mutationQueue.clear();
    await offlineStorage.remove('query-cache');
    setUser(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        error,
        login,
        register,
        logout,
        updateProfile,
        changePassword,
        deleteAccount,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};
