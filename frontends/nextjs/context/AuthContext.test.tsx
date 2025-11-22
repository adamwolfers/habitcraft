import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import React from 'react';
import * as apiModule from '@/lib/api';

// Mock fetch globally
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

// Mock the setOnAuthFailure function
jest.mock('@/lib/api', () => ({
  ...jest.requireActual('@/lib/api'),
  setOnAuthFailure: jest.fn(),
}));

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

describe('AuthContext', () => {
  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: '2025-01-01T00:00:00.000Z'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  describe('initial state', () => {
    it('should start with isLoading true', async () => {
      // Mock session check (no session)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' })
      } as Response);

      const { result } = renderHook(() => useAuth(), { wrapper });
      expect(result.current.isLoading).toBe(true);

      // Wait for async state updates to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should start with user as null', async () => {
      // Mock session check (no session)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' })
      } as Response);

      const { result } = renderHook(() => useAuth(), { wrapper });
      expect(result.current.user).toBeNull();

      // Wait for async state updates to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should start with isAuthenticated as false', async () => {
      // Mock session check (no session)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' })
      } as Response);

      const { result } = renderHook(() => useAuth(), { wrapper });
      expect(result.current.isAuthenticated).toBe(false);

      // Wait for async state updates to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('login', () => {
    it('should login successfully with credentials include', async () => {
      // Mock session check (no session)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' })
      } as Response);
      // Mock login
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser })
      } as Response);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/v1/auth/login`,
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'test@example.com', password: 'password123' })
        })
      );
    });

    it('should throw error on invalid credentials', async () => {
      // Mock session check (no session)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' })
      } as Response);
      // Mock failed login
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Invalid credentials' })
      } as Response);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

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
    it('should register successfully with credentials include', async () => {
      // Mock session check (no session)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' })
      } as Response);
      // Mock register
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser })
      } as Response);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.register('test@example.com', 'password123', 'Test User');
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/v1/auth/register`,
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'test@example.com', password: 'password123', name: 'Test User' })
        })
      );
    });

    it('should throw error if email already exists', async () => {
      // Mock session check (no session)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' })
      } as Response);
      // Mock failed register
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ error: 'User with this email already exists' })
      } as Response);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.register('test@example.com', 'password123', 'Test User');
        })
      ).rejects.toThrow('User with this email already exists');
    });
  });

  describe('logout', () => {
    it('should clear user and call logout endpoint', async () => {
      // Mock session check (no session)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' })
      } as Response);
      // Mock login
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser })
      } as Response);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      expect(result.current.isAuthenticated).toBe(true);

      // Mock logout endpoint
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Logged out successfully' })
      } as Response);

      // Then logout
      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(mockFetch).toHaveBeenLastCalledWith(
        `${API_BASE_URL}/api/v1/auth/logout`,
        expect.objectContaining({
          method: 'POST',
          credentials: 'include'
        })
      );
    });
  });

  describe('session persistence', () => {
    it('should restore session from cookies on mount', async () => {
      // Mock /auth/me returning user (cookie auth succeeds)
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
      expect(mockFetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/v1/auth/me`,
        expect.objectContaining({
          credentials: 'include'
        })
      );
    });

    it('should set isLoading to false when no session exists', async () => {
      // Mock /auth/me returning 401 (no valid cookie)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' })
      } as Response);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('auth failure callback', () => {
    it('should configure auth failure callback on mount', async () => {
      const mockSetOnAuthFailure = apiModule.setOnAuthFailure as jest.MockedFunction<typeof apiModule.setOnAuthFailure>;

      // Mock session check (no session)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' })
      } as Response);

      renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(mockSetOnAuthFailure).toHaveBeenCalledWith(expect.any(Function));
      });
    });

    it('should logout and clear user when auth failure callback is triggered', async () => {
      const mockSetOnAuthFailure = apiModule.setOnAuthFailure as jest.MockedFunction<typeof apiModule.setOnAuthFailure>;
      let authFailureCallback: (() => void) | null = null;

      // Capture the callback that's passed to setOnAuthFailure
      mockSetOnAuthFailure.mockImplementation((callback) => {
        authFailureCallback = callback;
      });

      // Mock session check (authenticated user)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser
      } as Response);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // User should be authenticated
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);

      // Mock the logout endpoint
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Logged out successfully' })
      } as Response);

      // Trigger the auth failure callback
      expect(authFailureCallback).not.toBeNull();
      await act(async () => {
        authFailureCallback!();
      });

      // User should be cleared
      await waitFor(() => {
        expect(result.current.user).toBeNull();
        expect(result.current.isAuthenticated).toBe(false);
      });

      // Logout endpoint should have been called
      expect(mockFetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/v1/auth/logout`,
        expect.objectContaining({
          method: 'POST',
          credentials: 'include'
        })
      );
    });
  });
});
