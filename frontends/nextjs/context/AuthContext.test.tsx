import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import React from 'react';

// Mock fetch globally
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: jest.fn((key: string) => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; })
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('AuthContext', () => {
  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: '2025-01-01T00:00:00.000Z'
  };

  const mockTokens = {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  describe('initial state', () => {
    it('should start with isLoading true', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      expect(result.current.isLoading).toBe(true);
    });

    it('should start with user as null', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      expect(result.current.user).toBeNull();
    });

    it('should start with isAuthenticated as false', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('login', () => {
    it('should login successfully and store tokens', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser, ...mockTokens })
      } as Response);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('accessToken', mockTokens.accessToken);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('refreshToken', mockTokens.refreshToken);
    });

    it('should throw error on invalid credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Invalid credentials' })
      } as Response);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await expect(
        act(async () => {
          await result.current.login('test@example.com', 'wrongpassword');
        })
      ).rejects.toThrow('Invalid credentials');

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('register', () => {
    it('should register successfully and store tokens', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser, ...mockTokens })
      } as Response);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.register('test@example.com', 'password123', 'Test User');
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('accessToken', mockTokens.accessToken);
    });

    it('should throw error if email already exists', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ error: 'User with this email already exists' })
      } as Response);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await expect(
        act(async () => {
          await result.current.register('test@example.com', 'password123', 'Test User');
        })
      ).rejects.toThrow('User with this email already exists');
    });
  });

  describe('logout', () => {
    it('should clear user and tokens on logout', async () => {
      // First login
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser, ...mockTokens })
      } as Response);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      expect(result.current.isAuthenticated).toBe(true);

      // Then logout
      act(() => {
        result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('accessToken');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('refreshToken');
    });
  });

  describe('token persistence', () => {
    it('should restore session from localStorage on mount', async () => {
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'accessToken') return mockTokens.accessToken;
        if (key === 'refreshToken') return mockTokens.refreshToken;
        return null;
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser
      } as Response);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should set isLoading to false when no tokens exist', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });
});
