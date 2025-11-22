import { renderHook, waitFor } from '@testing-library/react';
import { useRequireAuth } from './useRequireAuth';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';

// Mock dependencies
jest.mock('../context/AuthContext');
jest.mock('next/navigation');

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;

describe('useRequireAuth', () => {
  const mockPush = jest.fn();
  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: '2025-01-01T00:00:00.000Z'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue({
      push: mockPush,
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
    } as any);
  });

  describe('when user is authenticated', () => {
    it('should return auth context without redirecting', () => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoading: false,
        isAuthenticated: true,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
      });

      const { result } = renderHook(() => useRequireAuth());

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('when user is not authenticated', () => {
    it('should redirect to /login when not authenticated and not loading', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
      });

      renderHook(() => useRequireAuth());

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/login');
      });
    });

    it('should not redirect when loading', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: true,
        isAuthenticated: false,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
      });

      renderHook(() => useRequireAuth());

      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should redirect after loading completes and user is not authenticated', async () => {
      const { rerender } = renderHook(() => useRequireAuth());

      // First render: loading
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: true,
        isAuthenticated: false,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
      });

      rerender();
      expect(mockPush).not.toHaveBeenCalled();

      // Second render: loading complete, not authenticated
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
      });

      rerender();

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/login');
      });
    });
  });

  describe('when auth context is unavailable', () => {
    it('should throw error from useAuth if used outside AuthProvider', () => {
      mockUseAuth.mockImplementation(() => {
        throw new Error('useAuth must be used within an AuthProvider');
      });

      expect(() => {
        renderHook(() => useRequireAuth());
      }).toThrow('useAuth must be used within an AuthProvider');
    });
  });
});
