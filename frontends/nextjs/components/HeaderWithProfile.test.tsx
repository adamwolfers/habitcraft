import { render, screen } from '@testing-library/react';
import HeaderWithProfile from './HeaderWithProfile';
import * as authContextModule from '@/context/AuthContext';

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

// Mock the useAuth hook
jest.mock('@/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const mockUseAuth = authContextModule.useAuth as jest.MockedFunction<typeof authContextModule.useAuth>;

describe('HeaderWithProfile Component', () => {
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

  describe('Variant prop', () => {
    it('should pass variant="landing" to Header - logo links to /', () => {
      render(<HeaderWithProfile variant="landing" />);

      const logoLink = screen.getByRole('link', { name: /habitcraft/i });
      expect(logoLink).toHaveAttribute('href', '/');
    });

    it('should default to app variant - logo links to /dashboard', () => {
      render(<HeaderWithProfile />);

      const logoLink = screen.getByRole('link', { name: /habitcraft/i });
      expect(logoLink).toHaveAttribute('href', '/dashboard');
    });

    it('should show Login/Sign Up links for landing variant when unauthenticated', () => {
      render(<HeaderWithProfile variant="landing" />);

      expect(screen.getByRole('link', { name: /log in/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /sign up/i })).toBeInTheDocument();
    });

    it('should show Go to Dashboard for landing variant when authenticated', () => {
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

      render(<HeaderWithProfile variant="landing" />);

      expect(screen.getByRole('link', { name: /go to dashboard/i })).toBeInTheDocument();
    });
  });
});
