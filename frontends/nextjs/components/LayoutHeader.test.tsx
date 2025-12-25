import { render, screen } from '@testing-library/react';
import LayoutHeader from './LayoutHeader';
import * as authContextModule from '@/context/AuthContext';
import * as navigationModule from 'next/navigation';

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
  usePathname: jest.fn(),
}));

// Mock the useAuth hook
jest.mock('@/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const mockUseAuth = authContextModule.useAuth as jest.MockedFunction<typeof authContextModule.useAuth>;
const mockUsePathname = navigationModule.usePathname as jest.MockedFunction<typeof navigationModule.usePathname>;

describe('LayoutHeader Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      updateUser: jest.fn(),
    });
  });

  describe('Route-based variant detection', () => {
    it('should use landing variant on root path /', () => {
      mockUsePathname.mockReturnValue('/');

      render(<LayoutHeader />);

      // Landing variant shows Login/Sign Up links
      expect(screen.getByRole('link', { name: /log in/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /sign up/i })).toBeInTheDocument();
    });

    it('should use app variant on /dashboard', () => {
      mockUsePathname.mockReturnValue('/dashboard');
      mockUseAuth.mockReturnValue({
        user: {
          id: '123',
          email: 'test@example.com',
          name: 'Test User',
          createdAt: '2025-01-01T00:00:00.000Z',
        },
        isLoading: false,
        isAuthenticated: true,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        updateUser: jest.fn(),
      });

      render(<LayoutHeader />);

      // App variant shows logout button, not Login/Sign Up
      expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /log in/i })).not.toBeInTheDocument();
    });

    it('should use app variant on other paths', () => {
      mockUsePathname.mockReturnValue('/some-other-path');
      mockUseAuth.mockReturnValue({
        user: {
          id: '123',
          email: 'test@example.com',
          name: 'Test User',
          createdAt: '2025-01-01T00:00:00.000Z',
        },
        isLoading: false,
        isAuthenticated: true,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        updateUser: jest.fn(),
      });

      render(<LayoutHeader />);

      // Should use app variant (default for non-landing pages)
      expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument();
    });

    it('should show Go to Dashboard on landing when authenticated', () => {
      mockUsePathname.mockReturnValue('/');
      mockUseAuth.mockReturnValue({
        user: {
          id: '123',
          email: 'test@example.com',
          name: 'Test User',
          createdAt: '2025-01-01T00:00:00.000Z',
        },
        isLoading: false,
        isAuthenticated: true,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        updateUser: jest.fn(),
      });

      render(<LayoutHeader />);

      expect(screen.getByRole('link', { name: /go to dashboard/i })).toBeInTheDocument();
    });
  });
});
