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

      it('should show logout in profile menu when authenticated', async () => {
        const user = userEvent.setup();
        render(<Header onOpenProfileModal={mockOnOpenProfileModal} />);

        // Open profile menu
        const profileButton = screen.getByRole('button', { name: /profile/i });
        await user.click(profileButton);

        expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument();
      });
    });

    describe('Profile Menu', () => {
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

      it('should display profile icon on profile button', () => {
        render(<Header onOpenProfileModal={mockOnOpenProfileModal} />);

        const profileButton = screen.getByRole('button', { name: /profile/i });
        expect(profileButton.querySelector('svg')).toBeInTheDocument();
      });

      it('should show dropdown menu when profile button is clicked', async () => {
        const user = userEvent.setup();
        render(<Header onOpenProfileModal={mockOnOpenProfileModal} />);

        const profileButton = screen.getByRole('button', { name: /profile/i });
        await user.click(profileButton);

        expect(screen.getByRole('button', { name: /edit profile/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument();
      });

      it('should not show dropdown menu initially', () => {
        render(<Header onOpenProfileModal={mockOnOpenProfileModal} />);

        expect(screen.queryByRole('button', { name: /edit profile/i })).not.toBeInTheDocument();
      });

      it('should call onOpenProfileModal when Edit Profile is clicked', async () => {
        const user = userEvent.setup();
        render(<Header onOpenProfileModal={mockOnOpenProfileModal} />);

        const profileButton = screen.getByRole('button', { name: /profile/i });
        await user.click(profileButton);

        const editProfileButton = screen.getByRole('button', { name: /edit profile/i });
        await user.click(editProfileButton);

        expect(mockOnOpenProfileModal).toHaveBeenCalledTimes(1);
      });

      it('should close menu after Edit Profile is clicked', async () => {
        const user = userEvent.setup();
        render(<Header onOpenProfileModal={mockOnOpenProfileModal} />);

        const profileButton = screen.getByRole('button', { name: /profile/i });
        await user.click(profileButton);

        const editProfileButton = screen.getByRole('button', { name: /edit profile/i });
        await user.click(editProfileButton);

        expect(screen.queryByRole('button', { name: /edit profile/i })).not.toBeInTheDocument();
      });

      it('should call logout when Log Out menu item is clicked', async () => {
        const user = userEvent.setup();
        mockLogout.mockResolvedValue(undefined);
        render(<Header onOpenProfileModal={mockOnOpenProfileModal} />);

        const profileButton = screen.getByRole('button', { name: /profile/i });
        await user.click(profileButton);

        const logoutButton = screen.getByRole('button', { name: /log out/i });
        await user.click(logoutButton);

        await waitFor(() => {
          expect(mockLogout).toHaveBeenCalledTimes(1);
        });
      });

      it('should redirect to login after logout from menu', async () => {
        const user = userEvent.setup();
        mockLogout.mockResolvedValue(undefined);
        render(<Header onOpenProfileModal={mockOnOpenProfileModal} />);

        const profileButton = screen.getByRole('button', { name: /profile/i });
        await user.click(profileButton);

        const logoutButton = screen.getByRole('button', { name: /log out/i });
        await user.click(logoutButton);

        await waitFor(() => {
          expect(mockPush).toHaveBeenCalledWith('/login');
        });
      });

      it('should close menu when clicking outside', async () => {
        const user = userEvent.setup();
        render(<Header onOpenProfileModal={mockOnOpenProfileModal} />);

        const profileButton = screen.getByRole('button', { name: /profile/i });
        await user.click(profileButton);

        expect(screen.getByRole('button', { name: /edit profile/i })).toBeInTheDocument();

        // Click outside the menu
        await user.click(document.body);

        await waitFor(() => {
          expect(screen.queryByRole('button', { name: /edit profile/i })).not.toBeInTheDocument();
        });
      });

      it('should toggle menu open/closed on profile button click', async () => {
        const user = userEvent.setup();
        render(<Header onOpenProfileModal={mockOnOpenProfileModal} />);

        const profileButton = screen.getByRole('button', { name: /profile/i });

        // Open menu
        await user.click(profileButton);
        expect(screen.getByRole('button', { name: /edit profile/i })).toBeInTheDocument();

        // Close menu
        await user.click(profileButton);
        expect(screen.queryByRole('button', { name: /edit profile/i })).not.toBeInTheDocument();
      });
    });

    describe('Error Handling', () => {
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

      it('should handle logout errors gracefully', async () => {
        const user = userEvent.setup();
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        mockLogout.mockRejectedValue(new Error('Logout failed'));

        render(<Header onOpenProfileModal={mockOnOpenProfileModal} />);

        // Open profile menu and click logout
        const profileButton = screen.getByRole('button', { name: /profile/i });
        await user.click(profileButton);

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

      it('should render profile button when callback provided', () => {
        render(<Header variant="landing" onOpenProfileModal={mockOnOpenProfileModal} />);

        expect(screen.getByRole('button', { name: /profile/i })).toBeInTheDocument();
      });

      it('should show profile menu with logout when profile button is clicked', async () => {
        const user = userEvent.setup();
        render(<Header variant="landing" onOpenProfileModal={mockOnOpenProfileModal} />);

        const profileButton = screen.getByRole('button', { name: /profile/i });
        await user.click(profileButton);

        expect(screen.getByRole('button', { name: /edit profile/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument();
      });

      it('should call onOpenProfileModal when Edit Profile is clicked', async () => {
        const user = userEvent.setup();
        render(<Header variant="landing" onOpenProfileModal={mockOnOpenProfileModal} />);

        const profileButton = screen.getByRole('button', { name: /profile/i });
        await user.click(profileButton);

        const editProfileButton = screen.getByRole('button', { name: /edit profile/i });
        await user.click(editProfileButton);

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

      it('should call logout when Log Out menu item is clicked', async () => {
        const user = userEvent.setup();
        mockLogout.mockResolvedValue(undefined);

        render(<Header variant="landing" onOpenProfileModal={mockOnOpenProfileModal} />);

        const profileButton = screen.getByRole('button', { name: /profile/i });
        await user.click(profileButton);

        const logoutButton = screen.getByRole('button', { name: /log out/i });
        await user.click(logoutButton);

        await waitFor(() => {
          expect(mockLogout).toHaveBeenCalledTimes(1);
        });
      });

      it('should redirect to login page after logout from menu', async () => {
        const user = userEvent.setup();
        mockLogout.mockResolvedValue(undefined);

        render(<Header variant="landing" onOpenProfileModal={mockOnOpenProfileModal} />);

        const profileButton = screen.getByRole('button', { name: /profile/i });
        await user.click(profileButton);

        const logoutButton = screen.getByRole('button', { name: /log out/i });
        await user.click(logoutButton);

        await waitFor(() => {
          expect(mockPush).toHaveBeenCalledWith('/login');
        });
      });
    });
  });
});
