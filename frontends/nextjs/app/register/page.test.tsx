import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegisterPage from './page';
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

describe('Registration Page - Step 1: Basic Form Structure', () => {
  const mockRegister = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      login: jest.fn(),
      register: mockRegister,
      logout: jest.fn(),
    });
  });

  describe('Form Rendering', () => {
    it('should render registration form with name field', () => {
      render(<RegisterPage />);

      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    });

    it('should render email field', () => {
      render(<RegisterPage />);

      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    });

    it('should render password field', () => {
      render(<RegisterPage />);

      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    });

    it('should render confirm password field', () => {
      render(<RegisterPage />);

      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    });

    it('should render sign up button', () => {
      render(<RegisterPage />);

      expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
    });

    it('should render heading', () => {
      render(<RegisterPage />);

      expect(screen.getByRole('heading', { name: /sign up/i })).toBeInTheDocument();
    });

    it('should render link to login page', () => {
      render(<RegisterPage />);

      const loginLink = screen.getByRole('link', { name: /log in/i });
      expect(loginLink).toBeInTheDocument();
      expect(loginLink).toHaveAttribute('href', '/login');
    });
  });

  describe('Form Inputs', () => {
    it('should allow typing in name field', async () => {
      const user = userEvent.setup();
      render(<RegisterPage />);

      const nameInput = screen.getByLabelText(/name/i) as HTMLInputElement;
      await user.type(nameInput, 'Test User');

      expect(nameInput.value).toBe('Test User');
    });

    it('should allow typing in email field', async () => {
      const user = userEvent.setup();
      render(<RegisterPage />);

      const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement;
      await user.type(emailInput, 'test@example.com');

      expect(emailInput.value).toBe('test@example.com');
    });

    it('should allow typing in password field', async () => {
      const user = userEvent.setup();
      render(<RegisterPage />);

      const passwordInput = screen.getByLabelText(/^password$/i) as HTMLInputElement;
      await user.type(passwordInput, 'password123');

      expect(passwordInput.value).toBe('password123');
    });

    it('should allow typing in confirm password field', async () => {
      const user = userEvent.setup();
      render(<RegisterPage />);

      const confirmPasswordInput = screen.getByLabelText(/confirm password/i) as HTMLInputElement;
      await user.type(confirmPasswordInput, 'password123');

      expect(confirmPasswordInput.value).toBe('password123');
    });
  });

  describe('Auto-redirect for authenticated users', () => {
    it('should redirect to home if user is already authenticated', () => {
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
        register: mockRegister,
        logout: jest.fn(),
      });

      render(<RegisterPage />);

      expect(mockPush).toHaveBeenCalledWith('/');
    });

    it('should not redirect if user is not authenticated', () => {
      render(<RegisterPage />);

      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});
