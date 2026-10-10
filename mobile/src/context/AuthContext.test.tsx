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
    updateProfile: jest.fn(),
    deleteAccount: jest.fn(),
    changePassword: jest.fn(),
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
            onPress={() =>
              register({ email: 'new@example.com', password: 'password', name: 'Test User' })
            }
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

  describe('clearError', () => {
    // The error lives in the context, so it outlives the screen that caused it:
    // a failed login used to render above the Register screen's empty form
    // until this was wired up (habitcraft-tvro.2).
    const ClearErrorTestComponent: React.FC = () => {
      const { login, error, clearError } = useAuthContext();
      return (
        <>
          <Text testID="error">{error || 'no-error'}</Text>
          <Text
            testID="login-button"
            onPress={() => login({ email: 'test@example.com', password: 'password' })}
          >
            Login
          </Text>
          <Text testID="clear-button" onPress={() => clearError()}>
            Clear
          </Text>
        </>
      );
    };

    it('clears an error the previous screen left behind', async () => {
      mockStorage.hasTokens.mockResolvedValue(false);
      mockAuthApi.login.mockRejectedValue(new Error('Invalid credentials'));

      const { getByTestId } = render(
        <AuthProvider>
          <ClearErrorTestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(getByTestId('error').props.children).toBe('no-error');
      });

      await act(async () => {
        try {
          await getByTestId('login-button').props.onPress();
        } catch {
          // The screen swallows this; the error state is what matters.
        }
      });

      await waitFor(() => {
        expect(getByTestId('error').props.children).toBe('Invalid credentials');
      });

      await act(async () => {
        getByTestId('clear-button').props.onPress();
      });

      expect(getByTestId('error').props.children).toBe('no-error');
    });
  });

  describe('updateProfile', () => {
    const UpdateProfileTestComponent: React.FC = () => {
      const { updateProfile, user, error } = useAuthContext();
      return (
        <>
          <Text testID="user">{user ? `${user.name} <${user.email}>` : 'no-user'}</Text>
          <Text testID="error">{error || 'no-error'}</Text>
          <Text testID="update-button" onPress={() => updateProfile({ name: 'New Name' })}>
            Update
          </Text>
        </>
      );
    };

    const renderSignedIn = async () => {
      mockStorage.hasTokens.mockResolvedValue(true);
      mockAuthApi.getCurrentUser.mockResolvedValue(mockUser);

      const utils = render(
        <AuthProvider>
          <UpdateProfileTestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(utils.getByTestId('user').props.children).toBe('Test User <test@example.com>');
      });

      return utils;
    };

    it('replaces the user with the one the server returns', async () => {
      mockAuthApi.updateProfile.mockResolvedValue({ ...mockUser, name: 'New Name' });
      const { getByTestId } = await renderSignedIn();

      await act(async () => {
        await getByTestId('update-button').props.onPress();
      });

      expect(mockAuthApi.updateProfile).toHaveBeenCalledWith({ name: 'New Name' });
      expect(getByTestId('user').props.children).toBe('New Name <test@example.com>');
    });

    it('rethrows a failure and leaves the user and the auth error alone', async () => {
      // The auth-screen `error` is for login/register; a failed profile save
      // belongs to the Profile screen, which shows it under its own form.
      mockAuthApi.updateProfile.mockRejectedValue(new Error('Email is already in use'));
      const { getByTestId } = await renderSignedIn();

      let thrown: unknown;
      await act(async () => {
        try {
          await getByTestId('update-button').props.onPress();
        } catch (err) {
          thrown = err;
        }
      });

      expect((thrown as Error).message).toBe('Email is already in use');
      expect(getByTestId('user').props.children).toBe('Test User <test@example.com>');
      expect(getByTestId('error').props.children).toBe('no-error');
    });
  });

  describe('changePassword', () => {
    const change = {
      currentPassword: 'old-password',
      newPassword: 'new-password',
      confirmPassword: 'new-password',
    };

    const ChangePasswordTestComponent: React.FC = () => {
      const { changePassword, user, isAuthenticated } = useAuthContext();
      return (
        <>
          <Text testID="authenticated">{isAuthenticated ? 'yes' : 'no'}</Text>
          <Text testID="user">{user ? user.name : 'no-user'}</Text>
          <Text testID="change-button" onPress={() => changePassword(change)}>
            Change
          </Text>
        </>
      );
    };

    const renderSignedIn = async () => {
      mockStorage.hasTokens.mockResolvedValue(true);
      mockAuthApi.getCurrentUser.mockResolvedValue(mockUser);

      const utils = render(
        <AuthProvider>
          <ChangePasswordTestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(utils.getByTestId('authenticated').props.children).toBe('yes');
      });

      return utils;
    };

    const pressChange = async (utils: Awaited<ReturnType<typeof renderSignedIn>>) => {
      let thrown: unknown;
      await act(async () => {
        try {
          await utils.getByTestId('change-button').props.onPress();
        } catch (err) {
          thrown = err;
        }
      });
      return thrown;
    };

    it('changes the password, then signs back in with the new one', async () => {
      // The server revokes every refresh token on success, this device's
      // included, so without fresh tokens the next refresh would fail.
      mockAuthApi.changePassword.mockResolvedValue(undefined);
      mockAuthApi.login.mockResolvedValue({
        user: { ...mockUser, name: 'Fresh User' },
        tokens: mockTokens,
      });
      const utils = await renderSignedIn();

      expect(await pressChange(utils)).toBeUndefined();

      expect(mockAuthApi.changePassword).toHaveBeenCalledWith(change);
      expect(mockAuthApi.login).toHaveBeenCalledWith({
        email: mockUser.email,
        password: change.newPassword,
      });
      expect(utils.getByTestId('authenticated').props.children).toBe('yes');
      expect(utils.getByTestId('user').props.children).toBe('Fresh User');
      expect(mockAuthApi.logout).not.toHaveBeenCalled();
    });

    it('rethrows a failed change without signing in again or out', async () => {
      mockAuthApi.changePassword.mockRejectedValue(new Error('Invalid current password'));
      const utils = await renderSignedIn();

      const thrown = await pressChange(utils);

      expect((thrown as Error).message).toBe('Invalid current password');
      expect(mockAuthApi.login).not.toHaveBeenCalled();
      expect(mockAuthApi.logout).not.toHaveBeenCalled();
      expect(utils.getByTestId('authenticated').props.children).toBe('yes');
    });

    it('signs out if signing back in fails, since the old tokens are revoked', async () => {
      mockAuthApi.changePassword.mockResolvedValue(undefined);
      mockAuthApi.login.mockRejectedValue(new Error('Network Error'));
      mockAuthApi.logout.mockResolvedValue(undefined);
      const utils = await renderSignedIn();

      // The password did change, so this is not reported as a failure.
      expect(await pressChange(utils)).toBeUndefined();

      expect(mockAuthApi.logout).toHaveBeenCalled();
      expect(mockMutationQueue.clear).toHaveBeenCalled();
      expect(mockOfflineStorage.remove).toHaveBeenCalledWith('query-cache');
      expect(utils.getByTestId('authenticated').props.children).toBe('no');
    });
  });

  describe('deleteAccount', () => {
    const DeleteAccountTestComponent: React.FC = () => {
      const { deleteAccount, user, isAuthenticated } = useAuthContext();
      return (
        <>
          <Text testID="authenticated">{isAuthenticated ? 'yes' : 'no'}</Text>
          <Text testID="user">{user ? user.email : 'no-user'}</Text>
          <Text testID="delete-button" onPress={() => deleteAccount('password123')}>
            Delete
          </Text>
        </>
      );
    };

    const renderSignedIn = async () => {
      mockStorage.hasTokens.mockResolvedValue(true);
      mockAuthApi.getCurrentUser.mockResolvedValue(mockUser);

      const utils = render(
        <AuthProvider>
          <DeleteAccountTestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(utils.getByTestId('authenticated').props.children).toBe('yes');
      });

      return utils;
    };

    it('deletes the account with the password and signs the user out', async () => {
      mockAuthApi.deleteAccount.mockResolvedValue(undefined);
      const { getByTestId } = await renderSignedIn();

      await act(async () => {
        await getByTestId('delete-button').props.onPress();
      });

      expect(mockAuthApi.deleteAccount).toHaveBeenCalledWith('password123');
      expect(getByTestId('authenticated').props.children).toBe('no');
      expect(getByTestId('user').props.children).toBe('no-user');
    });

    it('clears the mutation queue and offline cache', async () => {
      // A queued mutation would replay against an account that no longer
      // exists, and the cached habits belong to it.
      mockAuthApi.deleteAccount.mockResolvedValue(undefined);
      const { getByTestId } = await renderSignedIn();

      await act(async () => {
        await getByTestId('delete-button').props.onPress();
      });

      expect(mockMutationQueue.clear).toHaveBeenCalled();
      expect(mockOfflineStorage.remove).toHaveBeenCalledWith('query-cache');
    });

    it('rethrows a failure and keeps the user signed in with their data', async () => {
      mockAuthApi.deleteAccount.mockRejectedValue(new Error('Invalid password'));
      const { getByTestId } = await renderSignedIn();

      let thrown: unknown;
      await act(async () => {
        try {
          await getByTestId('delete-button').props.onPress();
        } catch (err) {
          thrown = err;
        }
      });

      expect((thrown as Error).message).toBe('Invalid password');
      expect(getByTestId('authenticated').props.children).toBe('yes');
      expect(mockMutationQueue.clear).not.toHaveBeenCalled();
      expect(mockOfflineStorage.remove).not.toHaveBeenCalled();
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
