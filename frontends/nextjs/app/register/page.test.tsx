import { render, screen, waitFor } from '@testing-library/react';
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

describe('Registration Page - Basic Form Structure', () => {
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
    it('should redirect to dashboard if user is already authenticated', () => {
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

      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });

    it('should not redirect if user is not authenticated', () => {
      render(<RegisterPage />);

      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});

describe('Registration Page - Form Validation', () => {
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

  describe('HTML5 Validation', () => {
    it('should have required attribute on name field', () => {
      render(<RegisterPage />);

      const nameInput = screen.getByLabelText(/name/i);
      expect(nameInput).toBeRequired();
    });

    it('should have required attribute on email field', () => {
      render(<RegisterPage />);

      const emailInput = screen.getByLabelText(/email/i);
      expect(emailInput).toBeRequired();
    });

    it('should have email type on email field', () => {
      render(<RegisterPage />);

      const emailInput = screen.getByLabelText(/email/i);
      expect(emailInput).toHaveAttribute('type', 'email');
    });

    it('should have required attribute on password field', () => {
      render(<RegisterPage />);

      const passwordInput = screen.getByLabelText(/^password$/i);
      expect(passwordInput).toBeRequired();
    });

    it('should have required attribute on confirm password field', () => {
      render(<RegisterPage />);

      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      expect(confirmPasswordInput).toBeRequired();
    });
  });

  describe('Password Matching Validation', () => {
    it('should show error when passwords do not match on submit', async () => {
      const user = userEvent.setup();
      render(<RegisterPage />);

      const nameInput = screen.getByLabelText(/name/i);
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

      await user.type(nameInput, 'Test User');
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'password456');

      const submitButton = screen.getByRole('button', { name: /sign up/i });
      await user.click(submitButton);

      expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
      expect(mockRegister).not.toHaveBeenCalled();
    });

    it('should not show error when passwords match', async () => {
      const user = userEvent.setup();
      mockRegister.mockResolvedValue(undefined);
      render(<RegisterPage />);

      const nameInput = screen.getByLabelText(/name/i);
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

      await user.type(nameInput, 'Test User');
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'password123');

      const submitButton = screen.getByRole('button', { name: /sign up/i });
      await user.click(submitButton);

      expect(screen.queryByText(/passwords do not match/i)).not.toBeInTheDocument();
    });
  });

  describe('Minimum Password Length Validation', () => {
    it('should show error when password is less than 8 characters', async () => {
      const user = userEvent.setup();
      render(<RegisterPage />);

      const nameInput = screen.getByLabelText(/name/i);
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

      await user.type(nameInput, 'Test User');
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'pass');
      await user.type(confirmPasswordInput, 'pass');

      const submitButton = screen.getByRole('button', { name: /sign up/i });
      await user.click(submitButton);

      expect(await screen.findByText(/password must be at least 8 characters/i)).toBeInTheDocument();
      expect(mockRegister).not.toHaveBeenCalled();
    });

    it('should not show error when password is 8 characters or more', async () => {
      const user = userEvent.setup();
      mockRegister.mockResolvedValue(undefined);
      render(<RegisterPage />);

      const nameInput = screen.getByLabelText(/name/i);
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

      await user.type(nameInput, 'Test User');
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password');
      await user.type(confirmPasswordInput, 'password');

      const submitButton = screen.getByRole('button', { name: /sign up/i });
      await user.click(submitButton);

      expect(screen.queryByText(/password must be at least 8 characters/i)).not.toBeInTheDocument();
    });

    it('should clear validation error when user types again', async () => {
      const user = userEvent.setup();
      render(<RegisterPage />);

      const nameInput = screen.getByLabelText(/name/i);
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

      await user.type(nameInput, 'Test User');
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'pass');
      await user.type(confirmPasswordInput, 'pass');

      const submitButton = screen.getByRole('button', { name: /sign up/i });
      await user.click(submitButton);

      expect(await screen.findByText(/password must be at least 8 characters/i)).toBeInTheDocument();

      // Type more characters
      await user.type(passwordInput, 'word');

      expect(screen.queryByText(/password must be at least 8 characters/i)).not.toBeInTheDocument();
    });
  });
});

describe('Registration Page - Form Submission', () => {
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

  describe('Successful Registration', () => {
    it('should call register with correct data on valid submission', async () => {
      const user = userEvent.setup();
      mockRegister.mockResolvedValue(undefined);

      render(<RegisterPage />);

      const nameInput = screen.getByLabelText(/name/i);
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

      await user.type(nameInput, 'Test User');
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'password123');

      const submitButton = screen.getByRole('button', { name: /sign up/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockRegister).toHaveBeenCalledWith('test@example.com', 'password123', 'Test User');
      });
    });

    it('should redirect to dashboard on successful registration', async () => {
      const user = userEvent.setup();
      mockRegister.mockResolvedValue(undefined);

      render(<RegisterPage />);

      const nameInput = screen.getByLabelText(/name/i);
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

      await user.type(nameInput, 'Test User');
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'password123');

      const submitButton = screen.getByRole('button', { name: /sign up/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('should not call register when validation fails', async () => {
      const user = userEvent.setup();
      mockRegister.mockResolvedValue(undefined);

      render(<RegisterPage />);

      const nameInput = screen.getByLabelText(/name/i);
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

      await user.type(nameInput, 'Test User');
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'different');

      const submitButton = screen.getByRole('button', { name: /sign up/i });
      await user.click(submitButton);

      // Should show validation error
      expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();

      // Should not call register
      expect(mockRegister).not.toHaveBeenCalled();

      // Should not redirect
      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});

describe('Registration Page - Error Handling', () => {
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

  describe('API Error Display', () => {
    it('should display error message when registration fails with a message', async () => {
      const user = userEvent.setup();
      mockRegister.mockRejectedValue(new Error('Email already exists'));

      render(<RegisterPage />);

      const nameInput = screen.getByLabelText(/name/i);
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

      await user.type(nameInput, 'Test User');
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'password123');

      const submitButton = screen.getByRole('button', { name: /sign up/i });
      await user.click(submitButton);

      expect(await screen.findByText('Email already exists')).toBeInTheDocument();
    });

    it('should display generic error message when registration fails without a message', async () => {
      const user = userEvent.setup();
      mockRegister.mockRejectedValue(new Error());

      render(<RegisterPage />);

      const nameInput = screen.getByLabelText(/name/i);
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

      await user.type(nameInput, 'Test User');
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'password123');

      const submitButton = screen.getByRole('button', { name: /sign up/i });
      await user.click(submitButton);

      expect(await screen.findByText('Registration failed. Please try again.')).toBeInTheDocument();
    });

    it('should display generic error message when registration fails with non-Error object', async () => {
      const user = userEvent.setup();
      mockRegister.mockRejectedValue('Unknown error');

      render(<RegisterPage />);

      const nameInput = screen.getByLabelText(/name/i);
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

      await user.type(nameInput, 'Test User');
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'password123');

      const submitButton = screen.getByRole('button', { name: /sign up/i });
      await user.click(submitButton);

      expect(await screen.findByText('Registration failed. Please try again.')).toBeInTheDocument();
    });

    it('should not redirect to home page when registration fails', async () => {
      const user = userEvent.setup();
      mockRegister.mockRejectedValue(new Error('Email already exists'));

      render(<RegisterPage />);

      const nameInput = screen.getByLabelText(/name/i);
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

      await user.type(nameInput, 'Test User');
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'password123');

      const submitButton = screen.getByRole('button', { name: /sign up/i });
      await user.click(submitButton);

      await screen.findByText('Email already exists');

      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('Clearing Errors on Input Change', () => {
    it('should clear API error when user types in name field', async () => {
      const user = userEvent.setup();
      mockRegister.mockRejectedValue(new Error('Email already exists'));

      render(<RegisterPage />);

      const nameInput = screen.getByLabelText(/name/i);
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

      await user.type(nameInput, 'Test User');
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'password123');

      const submitButton = screen.getByRole('button', { name: /sign up/i });
      await user.click(submitButton);

      expect(await screen.findByText('Email already exists')).toBeInTheDocument();

      await user.type(nameInput, ' 2');

      expect(screen.queryByText('Email already exists')).not.toBeInTheDocument();
    });

    it('should clear API error when user types in email field', async () => {
      const user = userEvent.setup();
      mockRegister.mockRejectedValue(new Error('Email already exists'));

      render(<RegisterPage />);

      const nameInput = screen.getByLabelText(/name/i);
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

      await user.type(nameInput, 'Test User');
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'password123');

      const submitButton = screen.getByRole('button', { name: /sign up/i });
      await user.click(submitButton);

      expect(await screen.findByText('Email already exists')).toBeInTheDocument();

      await user.clear(emailInput);
      await user.type(emailInput, 'newemail@example.com');

      expect(screen.queryByText('Email already exists')).not.toBeInTheDocument();
    });

    it('should clear API error when user types in password field', async () => {
      const user = userEvent.setup();
      mockRegister.mockRejectedValue(new Error('Email already exists'));

      render(<RegisterPage />);

      const nameInput = screen.getByLabelText(/name/i);
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

      await user.type(nameInput, 'Test User');
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'password123');

      const submitButton = screen.getByRole('button', { name: /sign up/i });
      await user.click(submitButton);

      expect(await screen.findByText('Email already exists')).toBeInTheDocument();

      await user.type(passwordInput, '4');

      expect(screen.queryByText('Email already exists')).not.toBeInTheDocument();
    });

    it('should clear API error when user types in confirm password field', async () => {
      const user = userEvent.setup();
      mockRegister.mockRejectedValue(new Error('Email already exists'));

      render(<RegisterPage />);

      const nameInput = screen.getByLabelText(/name/i);
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

      await user.type(nameInput, 'Test User');
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'password123');

      const submitButton = screen.getByRole('button', { name: /sign up/i });
      await user.click(submitButton);

      expect(await screen.findByText('Email already exists')).toBeInTheDocument();

      await user.type(confirmPasswordInput, '4');

      expect(screen.queryByText('Email already exists')).not.toBeInTheDocument();
    });
  });
});
