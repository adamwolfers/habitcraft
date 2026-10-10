import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HeaderWithProfile from './HeaderWithProfile';
import * as authContextModule from '@/context/AuthContext';
import { createMockAuth } from '@/test-utils/mockAuthContext';

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

const mockUseAuth = authContextModule.useAuth as jest.MockedFunction<
  typeof authContextModule.useAuth
>;

describe('HeaderWithProfile Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue(createMockAuth());
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
      mockUseAuth.mockReturnValue(
        createMockAuth({
          user: {
            id: '123',
            email: 'test@example.com',
            name: 'Test User',
            createdAt: '2025-01-01T00:00:00.000Z',
          },
        })
      );

      render(<HeaderWithProfile variant="landing" />);

      expect(screen.getByRole('link', { name: /go to dashboard/i })).toBeInTheDocument();
    });
  });
  describe('Delete account', () => {
    const user = {
      id: '123',
      email: 'test@example.com',
      name: 'Test User',
      createdAt: '2025-01-01T00:00:00.000Z',
    };

    const confirmDeletion = async (password: string) => {
      const u = userEvent.setup();
      render(<HeaderWithProfile />);
      await u.click(screen.getByRole('button', { name: 'Profile' }));
      await u.click(screen.getByRole('button', { name: 'Edit Profile' }));
      await u.click(screen.getByRole('button', { name: 'Delete Account' }));
      await u.type(screen.getByLabelText(/enter your password to confirm/i), password);
      await u.click(screen.getByRole('button', { name: 'Permanently Delete' }));
    };

    it('deletes the account through auth and redirects to login', async () => {
      const deleteAccount = jest.fn().mockResolvedValue(undefined);
      mockUseAuth.mockReturnValue(createMockAuth({ user, deleteAccount }));

      await confirmDeletion('mypassword');

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/login');
      });
      expect(deleteAccount).toHaveBeenCalledWith('mypassword');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('stays put and shows the error when deletion fails', async () => {
      const deleteAccount = jest.fn().mockRejectedValue(new Error('Invalid password'));
      mockUseAuth.mockReturnValue(createMockAuth({ user, deleteAccount }));

      await confirmDeletion('wrongpass');

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Invalid password');
      });
      expect(mockPush).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});
