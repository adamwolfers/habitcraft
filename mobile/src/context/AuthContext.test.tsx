import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import { Text } from 'react-native';
import { AuthProvider, useAuthContext } from './AuthContext';
import { authApi } from '@/lib/auth';
import { storage } from '@/lib/storage';

// Mock auth API
jest.mock('@/lib/auth', () => ({
  authApi: {
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    getCurrentUser: jest.fn(),
  },
}));

// Mock storage
jest.mock('@/lib/storage', () => ({
  storage: {
    hasTokens: jest.fn(),
    getTokens: jest.fn(),
    clearTokens: jest.fn(),
  },
}));

// Mock offline modules
jest.mock('@/lib/offline', () => ({
  mutationQueue: {
    clear: jest.fn(),
  },
  offlineStorage: {
    remove: jest.fn(),
  },
}));

import { mutationQueue, offlineStorage } from '@/lib/offline';

const mockAuthApi = authApi as jest.Mocked<typeof authApi>;
const mockStorage = storage as jest.Mocked<typeof storage>;
const mockMutationQueue = mutationQueue as jest.Mocked<typeof mutationQueue>;
const mockOfflineStorage = offlineStorage as jest.Mocked<typeof offlineStorage>;

// Test component that uses the context
const TestConsumer: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuthContext();
  return (
    <>
      <Text testID="loading">{isLoading ? 'loading' : 'not-loading'}</Text>
      <Text testID="authenticated">{isAuthenticated ? 'yes' : 'no'}</Text>
      <Text testID="user">{user ? user.email : 'no-user'}</Text>
    </>
  );
};

describe('AuthContext', () => {
  const mockUser = {
    id: '1',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: '2024-01-01',
  };
  const mockTokens = { accessToken: 'access', refreshToken: 'refresh' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('starts with loading true while checking auth', async () => {
      mockStorage.hasTokens.mockResolvedValue(false);

      const { getByTestId } = render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      expect(getByTestId('loading').props.children).toBe('loading');

      await waitFor(() => {
        expect(getByTestId('loading').props.children).toBe('not-loading');
      });
    });

    it('sets isAuthenticated to false when no tokens exist', async () => {
      mockStorage.hasTokens.mockResolvedValue(false);

      const { getByTestId } = render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(getByTestId('authenticated').props.children).toBe('no');
      });
    });

    it('fetches user and sets isAuthenticated to true when tokens exist', async () => {
      mockStorage.hasTokens.mockResolvedValue(true);
      mockAuthApi.getCurrentUser.mockResolvedValue(mockUser);

      const { getByTestId } = render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(getByTestId('authenticated').props.children).toBe('yes');
        expect(getByTestId('user').props.children).toBe('test@example.com');
      });
    });

    it('clears tokens and sets isAuthenticated to false when getCurrentUser fails', async () => {
      mockStorage.hasTokens.mockResolvedValue(true);
      mockAuthApi.getCurrentUser.mockRejectedValue(new Error('Unauthorized'));

      const { getByTestId } = render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(getByTestId('authenticated').props.children).toBe('no');
        expect(mockStorage.clearTokens).toHaveBeenCalled();
      });
    });
  });

  describe('login', () => {
    const LoginTestComponent: React.FC = () => {
      const { login, user, isAuthenticated, isLoading, error } = useAuthContext();
      return (
        <>
          <Text testID="loading">{isLoading ? 'loading' : 'not-loading'}</Text>
          <Text testID="authenticated">{isAuthenticated ? 'yes' : 'no'}</Text>
          <Text testID="user">{user ? user.email : 'no-user'}</Text>
          <Text testID="error">{error || 'no-error'}</Text>
          <Text
            testID="login-button"
            onPress={() => login({ email: 'test@example.com', password: 'password' })}
          >
            Login
          </Text>
        </>
      );
    };

    it('sets user and isAuthenticated on successful login', async () => {
      mockStorage.hasTokens.mockResolvedValue(false);
      mockAuthApi.login.mockResolvedValue({ user: mockUser, tokens: mockTokens });

      const { getByTestId } = render(
        <AuthProvider>
          <LoginTestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(getByTestId('authenticated').props.children).toBe('no');
      });

      await act(async () => {
        getByTestId('login-button').props.onPress();
      });

      await waitFor(() => {
        expect(getByTestId('authenticated').props.children).toBe('yes');
        expect(getByTestId('user').props.children).toBe('test@example.com');
      });
    });

    it('sets error on failed login', async () => {
      mockStorage.hasTokens.mockResolvedValue(false);
      mockAuthApi.login.mockRejectedValue(new Error('Invalid credentials'));

      const { getByTestId } = render(
        <AuthProvider>
          <LoginTestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(getByTestId('loading').props.children).toBe('not-loading');
      });

      await act(async () => {
        try {
          await getByTestId('login-button').props.onPress();
        } catch {
          // Expected to throw
        }
      });

      await waitFor(() => {
        expect(getByTestId('error').props.children).toBe('Invalid credentials');
      });
    });
  });

  describe('register', () => {
    const RegisterTestComponent: React.FC = () => {
      const { register, user, isAuthenticated, isLoading, error } = useAuthContext();
      return (
        <>
          <Text testID="loading">{isLoading ? 'loading' : 'not-loading'}</Text>
          <Text testID="authenticated">{isAuthenticated ? 'yes' : 'no'}</Text>
          <Text testID="user">{user ? user.email : 'no-user'}</Text>
          <Text testID="error">{error || 'no-error'}</Text>
          <Text
            testID="register-button"
            onPress={() => register({ email: 'new@example.com', password: 'password' })}
          >
            Register
          </Text>
        </>
      );
    };

    it('sets user and isAuthenticated on successful registration', async () => {
      mockStorage.hasTokens.mockResolvedValue(false);
      mockAuthApi.register.mockResolvedValue({
        user: { ...mockUser, email: 'new@example.com' },
        tokens: mockTokens,
      });

      const { getByTestId } = render(
        <AuthProvider>
          <RegisterTestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(getByTestId('authenticated').props.children).toBe('no');
      });

      await act(async () => {
        getByTestId('register-button').props.onPress();
      });

      await waitFor(() => {
        expect(getByTestId('authenticated').props.children).toBe('yes');
        expect(getByTestId('user').props.children).toBe('new@example.com');
      });
    });

    it('sets error on failed registration', async () => {
      mockStorage.hasTokens.mockResolvedValue(false);
      mockAuthApi.register.mockRejectedValue(new Error('Email already exists'));

      const { getByTestId } = render(
        <AuthProvider>
          <RegisterTestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(getByTestId('loading').props.children).toBe('not-loading');
      });

      await act(async () => {
        try {
          await getByTestId('register-button').props.onPress();
        } catch {
          // Expected to throw
        }
      });

      await waitFor(() => {
        expect(getByTestId('error').props.children).toBe('Email already exists');
      });
    });
  });

  describe('logout', () => {
    const LogoutTestComponent: React.FC = () => {
      const { logout, user, isAuthenticated } = useAuthContext();
      return (
        <>
          <Text testID="authenticated">{isAuthenticated ? 'yes' : 'no'}</Text>
          <Text testID="user">{user ? user.email : 'no-user'}</Text>
          <Text testID="logout-button" onPress={logout}>
            Logout
          </Text>
        </>
      );
    };

    it('clears user and sets isAuthenticated to false on logout', async () => {
      mockStorage.hasTokens.mockResolvedValue(true);
      mockAuthApi.getCurrentUser.mockResolvedValue(mockUser);
      mockAuthApi.logout.mockResolvedValue(undefined);

      const { getByTestId } = render(
        <AuthProvider>
          <LogoutTestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(getByTestId('authenticated').props.children).toBe('yes');
      });

      await act(async () => {
        getByTestId('logout-button').props.onPress();
      });

      await waitFor(() => {
        expect(getByTestId('authenticated').props.children).toBe('no');
        expect(getByTestId('user').props.children).toBe('no-user');
      });
    });

    it('clears mutation queue and offline cache on logout', async () => {
      mockStorage.hasTokens.mockResolvedValue(true);
      mockAuthApi.getCurrentUser.mockResolvedValue(mockUser);
      mockAuthApi.logout.mockResolvedValue(undefined);
      mockMutationQueue.clear.mockResolvedValue(undefined);
      mockOfflineStorage.remove.mockResolvedValue(undefined);

      const { getByTestId } = render(
        <AuthProvider>
          <LogoutTestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(getByTestId('authenticated').props.children).toBe('yes');
      });

      await act(async () => {
        getByTestId('logout-button').props.onPress();
      });

      await waitFor(() => {
        expect(mockMutationQueue.clear).toHaveBeenCalled();
        expect(mockOfflineStorage.remove).toHaveBeenCalledWith('query-cache');
      });
    });
  });

  describe('useAuthContext', () => {
    it('throws error when used outside AuthProvider', () => {
      // Suppress console.error for this test
      const originalError = console.error;
      console.error = jest.fn();

      expect(() => {
        render(<TestConsumer />);
      }).toThrow('useAuthContext must be used within an AuthProvider');

      console.error = originalError;
    });
  });
});
