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

    it('should display user name', () => {
      render(<Header />);

      expect(screen.getByText(/test user/i)).toBeInTheDocument();
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

  describe('Name Edit', () => {
    const mockUpdateUser = jest.fn();

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
        updateUser: mockUpdateUser,
      });
    });

    it('should show edit button next to user name', () => {
      render(<Header />);

      expect(screen.getByRole('button', { name: /edit name/i })).toBeInTheDocument();
    });

    it('should show input field when edit button is clicked', async () => {
      const user = userEvent.setup();
      render(<Header />);

      const editButton = screen.getByRole('button', { name: /edit name/i });
      await user.click(editButton);

      expect(screen.getByRole('textbox', { name: /name/i })).toBeInTheDocument();
    });

    it('should pre-fill input with current name', async () => {
      const user = userEvent.setup();
      render(<Header />);

      const editButton = screen.getByRole('button', { name: /edit name/i });
      await user.click(editButton);

      const input = screen.getByRole('textbox', { name: /name/i });
      expect(input).toHaveValue('Test User');
    });

    it('should show save and cancel buttons in edit mode', async () => {
      const user = userEvent.setup();
      render(<Header />);

      const editButton = screen.getByRole('button', { name: /edit name/i });
      await user.click(editButton);

      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('should call updateUser with new name when save is clicked', async () => {
      const user = userEvent.setup();
      mockUpdateUser.mockResolvedValue(undefined);
      render(<Header />);

      const editButton = screen.getByRole('button', { name: /edit name/i });
      await user.click(editButton);

      const input = screen.getByRole('textbox', { name: /name/i });
      await user.clear(input);
      await user.type(input, 'New Name');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateUser).toHaveBeenCalledWith({ name: 'New Name' });
      });
    });

    it('should exit edit mode after successful save', async () => {
      const user = userEvent.setup();
      mockUpdateUser.mockResolvedValue(undefined);
      render(<Header />);

      const editButton = screen.getByRole('button', { name: /edit name/i });
      await user.click(editButton);

      const input = screen.getByRole('textbox', { name: /name/i });
      await user.clear(input);
      await user.type(input, 'New Name');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.queryByRole('textbox', { name: /name/i })).not.toBeInTheDocument();
      });
    });

    it('should exit edit mode without saving when cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<Header />);

      const editButton = screen.getByRole('button', { name: /edit name/i });
      await user.click(editButton);

      const input = screen.getByRole('textbox', { name: /name/i });
      await user.clear(input);
      await user.type(input, 'New Name');

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(screen.queryByRole('textbox', { name: /name/i })).not.toBeInTheDocument();
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    it('should show error message when save fails', async () => {
      const user = userEvent.setup();
      mockUpdateUser.mockRejectedValue(new Error('Update failed'));
      render(<Header />);

      const editButton = screen.getByRole('button', { name: /edit name/i });
      await user.click(editButton);

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/update failed/i)).toBeInTheDocument();
      });
    });

    it('should disable save button when name is empty', async () => {
      const user = userEvent.setup();
      render(<Header />);

      const editButton = screen.getByRole('button', { name: /edit name/i });
      await user.click(editButton);

      const input = screen.getByRole('textbox', { name: /name/i });
      await user.clear(input);

      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).toBeDisabled();
    });
  });

  describe('Email Edit', () => {
    const mockUpdateUser = jest.fn();

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
        updateUser: mockUpdateUser,
      });
    });

    it('should display user email', () => {
      render(<Header />);

      expect(screen.getByText(/test@example.com/i)).toBeInTheDocument();
    });

    it('should show edit button next to user email', () => {
      render(<Header />);

      expect(screen.getByRole('button', { name: /edit email/i })).toBeInTheDocument();
    });

    it('should show input field when email edit button is clicked', async () => {
      const user = userEvent.setup();
      render(<Header />);

      const editButton = screen.getByRole('button', { name: /edit email/i });
      await user.click(editButton);

      expect(screen.getByRole('textbox', { name: /email/i })).toBeInTheDocument();
    });

    it('should pre-fill input with current email', async () => {
      const user = userEvent.setup();
      render(<Header />);

      const editButton = screen.getByRole('button', { name: /edit email/i });
      await user.click(editButton);

      const input = screen.getByRole('textbox', { name: /email/i });
      expect(input).toHaveValue('test@example.com');
    });

    it('should show save and cancel buttons in email edit mode', async () => {
      const user = userEvent.setup();
      render(<Header />);

      const editButton = screen.getByRole('button', { name: /edit email/i });
      await user.click(editButton);

      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('should call updateUser with new email when save is clicked', async () => {
      const user = userEvent.setup();
      mockUpdateUser.mockResolvedValue(undefined);
      render(<Header />);

      const editButton = screen.getByRole('button', { name: /edit email/i });
      await user.click(editButton);

      const input = screen.getByRole('textbox', { name: /email/i });
      await user.clear(input);
      await user.type(input, 'newemail@example.com');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateUser).toHaveBeenCalledWith({ email: 'newemail@example.com' });
      });
    });

    it('should exit email edit mode after successful save', async () => {
      const user = userEvent.setup();
      mockUpdateUser.mockResolvedValue(undefined);
      render(<Header />);

      const editButton = screen.getByRole('button', { name: /edit email/i });
      await user.click(editButton);

      const input = screen.getByRole('textbox', { name: /email/i });
      await user.clear(input);
      await user.type(input, 'newemail@example.com');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.queryByRole('textbox', { name: /email/i })).not.toBeInTheDocument();
      });
    });

    it('should exit email edit mode without saving when cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<Header />);

      const editButton = screen.getByRole('button', { name: /edit email/i });
      await user.click(editButton);

      const input = screen.getByRole('textbox', { name: /email/i });
      await user.clear(input);
      await user.type(input, 'newemail@example.com');

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(screen.queryByRole('textbox', { name: /email/i })).not.toBeInTheDocument();
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    it('should show error message when email save fails', async () => {
      const user = userEvent.setup();
      mockUpdateUser.mockRejectedValue(new Error('Email is already in use'));
      render(<Header />);

      const editButton = screen.getByRole('button', { name: /edit email/i });
      await user.click(editButton);

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/email is already in use/i)).toBeInTheDocument();
      });
    });

    it('should disable save button when email is empty', async () => {
      const user = userEvent.setup();
      render(<Header />);

      const editButton = screen.getByRole('button', { name: /edit email/i });
      await user.click(editButton);

      const input = screen.getByRole('textbox', { name: /email/i });
      await user.clear(input);

      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).toBeDisabled();
    });

    it('should disable save button for invalid email format', async () => {
      const user = userEvent.setup();
      render(<Header />);

      const editButton = screen.getByRole('button', { name: /edit email/i });
      await user.click(editButton);

      const input = screen.getByRole('textbox', { name: /email/i });
      await user.clear(input);
      await user.type(input, 'not-an-email');

      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).toBeDisabled();
    });
  });

  describe('Profile Modal Trigger', () => {
    const mockUpdateUser = jest.fn();
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
        updateUser: mockUpdateUser,
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
