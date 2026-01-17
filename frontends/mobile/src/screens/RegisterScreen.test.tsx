import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { RegisterScreen } from './RegisterScreen';
import { AuthProvider } from '@/context/AuthContext';
import { authApi } from '@/lib/auth';
import { storage } from '@/lib/storage';

// Mock navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
  }),
}));

// Mock auth API
jest.mock('@/lib/auth', () => ({
  authApi: {
    register: jest.fn(),
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

const renderRegisterScreen = () => {
  return render(
    <AuthProvider>
      <RegisterScreen />
    </AuthProvider>
  );
};

describe('RegisterScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.hasTokens.mockResolvedValue(false);
  });

  describe('rendering', () => {
    it('renders the title', async () => {
      const { getByText } = renderRegisterScreen();

      await waitFor(() => {
        expect(getByText('Create Account')).toBeTruthy();
      });
    });

    it('renders email input field', async () => {
      const { getByPlaceholderText } = renderRegisterScreen();

      await waitFor(() => {
        expect(getByPlaceholderText('Email')).toBeTruthy();
      });
    });

    it('renders password input field', async () => {
      const { getByPlaceholderText } = renderRegisterScreen();

      await waitFor(() => {
        expect(getByPlaceholderText('Password')).toBeTruthy();
      });
    });

    it('renders confirm password input field', async () => {
      const { getByPlaceholderText } = renderRegisterScreen();

      await waitFor(() => {
        expect(getByPlaceholderText('Confirm Password')).toBeTruthy();
      });
    });

    it('renders sign up button', async () => {
      const { getByText } = renderRegisterScreen();

      await waitFor(() => {
        expect(getByText('Sign Up')).toBeTruthy();
      });
    });

    it('renders link to login screen', async () => {
      const { getByText } = renderRegisterScreen();

      await waitFor(() => {
        expect(getByText('Already have an account? Log in')).toBeTruthy();
      });
    });
  });

  describe('form validation', () => {
    it('shows error when submitting with empty email', async () => {
      const { getByText, getByPlaceholderText } = renderRegisterScreen();

      await waitFor(() => {
        fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
        fireEvent.changeText(getByPlaceholderText('Confirm Password'), 'password123');
        fireEvent.press(getByText('Sign Up'));
      });

      await waitFor(() => {
        expect(getByText('Email is required')).toBeTruthy();
      });
    });

    it('shows error for invalid email format', async () => {
      const { getByText, getByPlaceholderText } = renderRegisterScreen();

      await waitFor(() => {
        fireEvent.changeText(getByPlaceholderText('Email'), 'invalid-email');
        fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
        fireEvent.changeText(getByPlaceholderText('Confirm Password'), 'password123');
        fireEvent.press(getByText('Sign Up'));
      });

      await waitFor(() => {
        expect(getByText('Please enter a valid email')).toBeTruthy();
      });
    });

    it('shows error when submitting with empty password', async () => {
      const { getByText, getByPlaceholderText } = renderRegisterScreen();

      await waitFor(() => {
        fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
        fireEvent.press(getByText('Sign Up'));
      });

      await waitFor(() => {
        expect(getByText('Password is required')).toBeTruthy();
      });
    });

    it('shows error when password is too short', async () => {
      const { getByText, getByPlaceholderText } = renderRegisterScreen();

      await waitFor(() => {
        fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
        fireEvent.changeText(getByPlaceholderText('Password'), '12345');
        fireEvent.changeText(getByPlaceholderText('Confirm Password'), '12345');
        fireEvent.press(getByText('Sign Up'));
      });

      await waitFor(() => {
        expect(getByText('Password must be at least 6 characters')).toBeTruthy();
      });
    });

    it('shows error when passwords do not match', async () => {
      const { getByText, getByPlaceholderText } = renderRegisterScreen();

      await waitFor(() => {
        fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
        fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
        fireEvent.changeText(getByPlaceholderText('Confirm Password'), 'different123');
        fireEvent.press(getByText('Sign Up'));
      });

      await waitFor(() => {
        expect(getByText('Passwords do not match')).toBeTruthy();
      });
    });
  });

  describe('registration submission', () => {
    const validData = {
      email: 'new@example.com',
      password: 'password123',
    };

    it('calls register API with correct data', async () => {
      const mockUser = { id: '1', email: 'new@example.com', created_at: '2024-01-01' };
      mockAuthApi.register.mockResolvedValue({
        user: mockUser,
        tokens: { accessToken: 'token', refreshToken: 'refresh' },
      });

      const { getByText, getByPlaceholderText } = renderRegisterScreen();

      await waitFor(() => {
        fireEvent.changeText(getByPlaceholderText('Email'), validData.email);
        fireEvent.changeText(getByPlaceholderText('Password'), validData.password);
        fireEvent.changeText(getByPlaceholderText('Confirm Password'), validData.password);
        fireEvent.press(getByText('Sign Up'));
      });

      await waitFor(() => {
        expect(mockAuthApi.register).toHaveBeenCalledWith(validData);
      });
    });

    it('shows error message on registration failure', async () => {
      mockAuthApi.register.mockRejectedValue(new Error('Email already exists'));

      const { getByText, getByPlaceholderText } = renderRegisterScreen();

      await waitFor(() => {
        fireEvent.changeText(getByPlaceholderText('Email'), validData.email);
        fireEvent.changeText(getByPlaceholderText('Password'), validData.password);
        fireEvent.changeText(getByPlaceholderText('Confirm Password'), validData.password);
        fireEvent.press(getByText('Sign Up'));
      });

      await waitFor(() => {
        expect(getByText('Email already exists')).toBeTruthy();
      });
    });
  });

  describe('navigation', () => {
    it('navigates to login screen when log in link is pressed', async () => {
      const { getByText } = renderRegisterScreen();

      await waitFor(() => {
        fireEvent.press(getByText('Already have an account? Log in'));
      });

      expect(mockGoBack).toHaveBeenCalled();
    });
  });
});
