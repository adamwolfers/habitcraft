import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { LoginScreen } from './LoginScreen';
import { AuthProvider, useAuthContext } from '@/context/AuthContext';
import { authApi } from '@/lib/auth';
import { storage } from '@/lib/storage';

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}));

// Mock auth API
jest.mock('@/lib/auth', () => ({
  authApi: {
    login: jest.fn(),
    getCurrentUser: jest.fn(),
  },
}));

// Mock storage
jest.mock('@/lib/storage', () => ({
  storage: {
    hasTokens: jest.fn(),
    getTokens: jest.fn(),
    clearTokens: jest.fn(),
    saveTokens: jest.fn(),
  },
}));

const mockAuthApi = authApi as jest.Mocked<typeof authApi>;
const mockStorage = storage as jest.Mocked<typeof storage>;

const renderLoginScreen = () => {
  return render(
    <AuthProvider>
      <LoginScreen />
    </AuthProvider>
  );
};

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.hasTokens.mockResolvedValue(false);
  });

  describe('rendering', () => {
    it('renders the app title', async () => {
      const { getByText } = renderLoginScreen();

      await waitFor(() => {
        expect(getByText('HabitCraft')).toBeTruthy();
      });
    });

    it('renders email input field', async () => {
      const { getByPlaceholderText } = renderLoginScreen();

      await waitFor(() => {
        expect(getByPlaceholderText('Email')).toBeTruthy();
      });
    });

    it('renders password input field', async () => {
      const { getByPlaceholderText } = renderLoginScreen();

      await waitFor(() => {
        expect(getByPlaceholderText('Password')).toBeTruthy();
      });
    });

    it('renders login button', async () => {
      const { getByText } = renderLoginScreen();

      await waitFor(() => {
        expect(getByText('Log In')).toBeTruthy();
      });
    });

    it('renders link to register screen', async () => {
      const { getByText } = renderLoginScreen();

      await waitFor(() => {
        expect(getByText("Don't have an account? Sign up")).toBeTruthy();
      });
    });
  });

  describe('form interaction', () => {
    it('allows user to enter email', async () => {
      const { getByPlaceholderText } = renderLoginScreen();

      await waitFor(() => {
        const emailInput = getByPlaceholderText('Email');
        fireEvent.changeText(emailInput, 'test@example.com');
        expect(emailInput.props.value).toBe('test@example.com');
      });
    });

    it('allows user to enter password', async () => {
      const { getByPlaceholderText } = renderLoginScreen();

      await waitFor(() => {
        const passwordInput = getByPlaceholderText('Password');
        fireEvent.changeText(passwordInput, 'password123');
        expect(passwordInput.props.value).toBe('password123');
      });
    });

    it('password input is secure (hidden)', async () => {
      const { getByPlaceholderText } = renderLoginScreen();

      await waitFor(() => {
        const passwordInput = getByPlaceholderText('Password');
        expect(passwordInput.props.secureTextEntry).toBe(true);
      });
    });
  });

  describe('form validation', () => {
    it('shows error when submitting with empty email', async () => {
      const { getByText, getByPlaceholderText } = renderLoginScreen();

      await waitFor(() => {
        fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
        fireEvent.press(getByText('Log In'));
      });

      await waitFor(() => {
        expect(getByText('Email is required')).toBeTruthy();
      });
    });

    it('shows error when submitting with empty password', async () => {
      const { getByText, getByPlaceholderText } = renderLoginScreen();

      await waitFor(() => {
        fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
        fireEvent.press(getByText('Log In'));
      });

      await waitFor(() => {
        expect(getByText('Password is required')).toBeTruthy();
      });
    });

    it('shows error for invalid email format', async () => {
      const { getByText, getByPlaceholderText } = renderLoginScreen();

      await waitFor(() => {
        fireEvent.changeText(getByPlaceholderText('Email'), 'invalid-email');
        fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
        fireEvent.press(getByText('Log In'));
      });

      await waitFor(() => {
        expect(getByText('Please enter a valid email')).toBeTruthy();
      });
    });
  });

  describe('login submission', () => {
    const validCredentials = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('calls login API with correct credentials', async () => {
      const mockUser = { id: '1', email: 'test@example.com', created_at: '2024-01-01' };
      mockAuthApi.login.mockResolvedValue({
        user: mockUser,
        tokens: { accessToken: 'token', refreshToken: 'refresh' },
      });

      const { getByText, getByPlaceholderText } = renderLoginScreen();

      await waitFor(() => {
        fireEvent.changeText(getByPlaceholderText('Email'), validCredentials.email);
        fireEvent.changeText(getByPlaceholderText('Password'), validCredentials.password);
        fireEvent.press(getByText('Log In'));
      });

      await waitFor(() => {
        expect(mockAuthApi.login).toHaveBeenCalledWith(validCredentials);
      });
    });

    it('shows error message on login failure', async () => {
      mockAuthApi.login.mockRejectedValue(new Error('Invalid credentials'));

      const { getByText, getByPlaceholderText } = renderLoginScreen();

      await waitFor(() => {
        fireEvent.changeText(getByPlaceholderText('Email'), validCredentials.email);
        fireEvent.changeText(getByPlaceholderText('Password'), validCredentials.password);
        fireEvent.press(getByText('Log In'));
      });

      await waitFor(() => {
        expect(getByText('Invalid credentials')).toBeTruthy();
      });
    });

    it('disables button while loading', async () => {
      // Make login take some time
      mockAuthApi.login.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      const { getByText, getByPlaceholderText, getByTestId } = renderLoginScreen();

      await waitFor(() => {
        fireEvent.changeText(getByPlaceholderText('Email'), validCredentials.email);
        fireEvent.changeText(getByPlaceholderText('Password'), validCredentials.password);
        fireEvent.press(getByText('Log In'));
      });

      await waitFor(() => {
        const button = getByTestId('login-button');
        // TouchableOpacity uses accessibilityState for disabled
        expect(
          button.props.disabled === true ||
          button.props.accessibilityState?.disabled === true
        ).toBe(true);
      });
    });
  });

  describe('navigation', () => {
    it('navigates to register screen when sign up link is pressed', async () => {
      const { getByText } = renderLoginScreen();

      await waitFor(() => {
        fireEvent.press(getByText("Don't have an account? Sign up"));
      });

      expect(mockNavigate).toHaveBeenCalledWith('Register');
    });
  });
});
