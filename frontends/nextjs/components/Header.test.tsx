import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Header from './Header';
import * as authContextModule from '@/context/AuthContext';

// Mock Next.js navigation
const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock the useAuth hook
jest.mock('@/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const mockUseAuth = authContextModule.useAuth as jest.MockedFunction<typeof authContextModule.useAuth>;

describe('Header Component', () => {
  const mockLogout = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('App Variant (default)', () => {
    describe('When user is not authenticated', () => {
      beforeEach(() => {
        mockUseAuth.mockReturnValue({
          user: null,
          isLoading: false,
          isAuthenticated: false,
          login: jest.fn(),
          register: jest.fn(),
          logout: mockLogout,
          updateUser: jest.fn(),
        });
      });

      it('should not render logout button', () => {
        render(<Header />);

        expect(screen.queryByRole('button', { name: /log out/i })).not.toBeInTheDocument();
      });

      it('should render app title', () => {
        render(<Header />);

        expect(screen.getByText(/habitcraft/i)).toBeInTheDocument();
      });

      it('should have logo linking to /dashboard', () => {
        render(<Header />);

        const logoLink = screen.getByRole('link', { name: /habitcraft/i });
        expect(logoLink).toHaveAttribute('href', '/dashboard');
      });
    });

    describe('When user is authenticated', () => {
      beforeEach(() => {
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
          logout: mockLogout,
          updateUser: jest.fn(),
        });
      });

      it('should render logout button', () => {
        render(<Header />);

        expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument();
      });

      it('should call logout when logout button is clicked', async () => {
        const user = userEvent.setup();
        mockLogout.mockResolvedValue(undefined);

        render(<Header />);

        const logoutButton = screen.getByRole('button', { name: /log out/i });
        await user.click(logoutButton);

        await waitFor(() => {
          expect(mockLogout).toHaveBeenCalledTimes(1);
        });
      });

      it('should redirect to login page after logout', async () => {
        const user = userEvent.setup();
        mockLogout.mockResolvedValue(undefined);

        render(<Header />);

        const logoutButton = screen.getByRole('button', { name: /log out/i });
        await user.click(logoutButton);

        await waitFor(() => {
          expect(mockPush).toHaveBeenCalledWith('/login');
        });
      });

      it('should disable logout button during logout', async () => {
        const user = userEvent.setup();

        // Create a promise that we can control
        let resolveLogout: () => void;
        const logoutPromise = new Promise<void>((resolve) => {
          resolveLogout = resolve;
        });
        mockLogout.mockReturnValue(logoutPromise);

        render(<Header />);

        const logoutButton = screen.getByRole('button', { name: /log out/i });
        await user.click(logoutButton);

        // Button should be disabled during logout
        expect(logoutButton).toBeDisabled();

        // Resolve the logout
        resolveLogout!();
        await waitFor(() => {
          expect(logoutButton).not.toBeDisabled();
        });
      });

      it('should show loading text during logout', async () => {
        const user = userEvent.setup();

        let resolveLogout: () => void;
        const logoutPromise = new Promise<void>((resolve) => {
          resolveLogout = resolve;
        });
        mockLogout.mockReturnValue(logoutPromise);

        render(<Header />);

        const logoutButton = screen.getByRole('button', { name: /log out/i });
        await user.click(logoutButton);

        // Button text should change during logout
        expect(screen.getByText(/logging out/i)).toBeInTheDocument();

        // Resolve the logout
        resolveLogout!();
        await waitFor(() => {
          expect(screen.queryByText(/logging out/i)).not.toBeInTheDocument();
        });
      });
    });

    describe('Profile Modal Trigger', () => {
      const mockOnOpenProfileModal = jest.fn();

      beforeEach(() => {
        mockOnOpenProfileModal.mockClear();
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
          logout: mockLogout,
          updateUser: jest.fn(),
        });
      });

      it('should render profile button when authenticated', () => {
        render(<Header onOpenProfileModal={mockOnOpenProfileModal} />);

        expect(screen.getByRole('button', { name: /profile/i })).toBeInTheDocument();
      });

      it('should not render profile button when not authenticated', () => {
        mockUseAuth.mockReturnValue({
          user: null,
          isLoading: false,
          isAuthenticated: false,
          login: jest.fn(),
          register: jest.fn(),
          logout: mockLogout,
          updateUser: jest.fn(),
        });

        render(<Header onOpenProfileModal={mockOnOpenProfileModal} />);

        expect(screen.queryByRole('button', { name: /profile/i })).not.toBeInTheDocument();
      });

      it('should call onOpenProfileModal when profile button is clicked', async () => {
        const user = userEvent.setup();
        render(<Header onOpenProfileModal={mockOnOpenProfileModal} />);

        const profileButton = screen.getByRole('button', { name: /profile/i });
        await user.click(profileButton);

        expect(mockOnOpenProfileModal).toHaveBeenCalledTimes(1);
      });

      it('should display user name on profile button', () => {
        render(<Header onOpenProfileModal={mockOnOpenProfileModal} />);

        const profileButton = screen.getByRole('button', { name: /profile/i });
        expect(profileButton).toHaveTextContent('Test User');
      });
    });

    describe('Error Handling', () => {
      beforeEach(() => {
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
          logout: mockLogout,
          updateUser: jest.fn(),
        });
      });

      it('should handle logout errors gracefully', async () => {
        const user = userEvent.setup();
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        mockLogout.mockRejectedValue(new Error('Logout failed'));

        render(<Header />);

        const logoutButton = screen.getByRole('button', { name: /log out/i });
        await user.click(logoutButton);

        await waitFor(() => {
          expect(consoleErrorSpy).toHaveBeenCalledWith('Logout error:', expect.any(Error));
        });

        // Should still redirect even on error
        expect(mockPush).toHaveBeenCalledWith('/login');

        consoleErrorSpy.mockRestore();
      });
    });
  });

  describe('Landing Variant', () => {
    describe('When user is not authenticated', () => {
      beforeEach(() => {
        mockUseAuth.mockReturnValue({
          user: null,
          isLoading: false,
          isAuthenticated: false,
          login: jest.fn(),
          register: jest.fn(),
          logout: mockLogout,
          updateUser: jest.fn(),
        });
      });

      it('should render Login link', () => {
        render(<Header variant="landing" />);

        const loginLink = screen.getByRole('link', { name: /log in/i });
        expect(loginLink).toBeInTheDocument();
        expect(loginLink).toHaveAttribute('href', '/login');
      });

      it('should render Sign Up link', () => {
        render(<Header variant="landing" />);

        const signUpLink = screen.getByRole('link', { name: /sign up/i });
        expect(signUpLink).toBeInTheDocument();
        expect(signUpLink).toHaveAttribute('href', '/register');
      });

      it('should not render logout button', () => {
        render(<Header variant="landing" />);

        expect(screen.queryByRole('button', { name: /log out/i })).not.toBeInTheDocument();
      });

      it('should not render Go to Dashboard link', () => {
        render(<Header variant="landing" />);

        expect(screen.queryByRole('link', { name: /go to dashboard/i })).not.toBeInTheDocument();
      });

      it('should have logo linking to /', () => {
        render(<Header variant="landing" />);

        const logoLink = screen.getByRole('link', { name: /habitcraft/i });
        expect(logoLink).toHaveAttribute('href', '/');
      });
    });

    describe('When user is authenticated', () => {
      const mockOnOpenProfileModal = jest.fn();

      beforeEach(() => {
        mockOnOpenProfileModal.mockClear();
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
          logout: mockLogout,
          updateUser: jest.fn(),
        });
      });

      it('should render Go to Dashboard link', () => {
        render(<Header variant="landing" />);

        const dashboardLink = screen.getByRole('link', { name: /go to dashboard/i });
        expect(dashboardLink).toBeInTheDocument();
        expect(dashboardLink).toHaveAttribute('href', '/dashboard');
      });

      it('should render logout button', () => {
        render(<Header variant="landing" />);

        expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument();
      });

      it('should render profile button when callback provided', () => {
        render(<Header variant="landing" onOpenProfileModal={mockOnOpenProfileModal} />);

        expect(screen.getByRole('button', { name: /profile/i })).toBeInTheDocument();
      });

      it('should call onOpenProfileModal when profile button is clicked', async () => {
        const user = userEvent.setup();
        render(<Header variant="landing" onOpenProfileModal={mockOnOpenProfileModal} />);

        const profileButton = screen.getByRole('button', { name: /profile/i });
        await user.click(profileButton);

        expect(mockOnOpenProfileModal).toHaveBeenCalledTimes(1);
      });

      it('should not render Login link', () => {
        render(<Header variant="landing" />);

        expect(screen.queryByRole('link', { name: /log in/i })).not.toBeInTheDocument();
      });

      it('should not render Sign Up link', () => {
        render(<Header variant="landing" />);

        expect(screen.queryByRole('link', { name: /sign up/i })).not.toBeInTheDocument();
      });

      it('should call logout when logout button is clicked', async () => {
        const user = userEvent.setup();
        mockLogout.mockResolvedValue(undefined);

        render(<Header variant="landing" />);

        const logoutButton = screen.getByRole('button', { name: /log out/i });
        await user.click(logoutButton);

        await waitFor(() => {
          expect(mockLogout).toHaveBeenCalledTimes(1);
        });
      });

      it('should redirect to login page after logout', async () => {
        const user = userEvent.setup();
        mockLogout.mockResolvedValue(undefined);

        render(<Header variant="landing" />);

        const logoutButton = screen.getByRole('button', { name: /log out/i });
        await user.click(logoutButton);

        await waitFor(() => {
          expect(mockPush).toHaveBeenCalledWith('/login');
        });
      });
    });
  });
});
