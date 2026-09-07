import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { LoginScreen } from './LoginScreen';
import { AuthProvider } from '@/context/AuthContext';
import { authApi } from '@/lib/auth';
import { storage } from '@/lib/storage';

const mockNavigate = jest.fn();
let mockRouteParams: { email?: string } | undefined;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('@/lib/auth', () => ({
  authApi: {
    login: jest.fn(),
    getCurrentUser: jest.fn(),
  },
}));

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

const renderLoginScreen = () =>
  render(
    <AuthProvider>
      <LoginScreen />
    </AuthProvider>
  );

const fillForm = (
  utils: ReturnType<typeof renderLoginScreen>,
  overrides: Partial<{ email: string; password: string }> = {}
) => {
  const values = { email: 'test@example.com', password: 'password123', ...overrides };
  fireEvent.changeText(utils.getByTestId('login-email-input'), values.email);
  fireEvent.changeText(utils.getByTestId('login-password-input'), values.password);
  return values;
};

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = undefined;
    mockStorage.hasTokens.mockResolvedValue(false);
  });

  describe('rendering', () => {
    it('renders both fields', async () => {
      const { getByTestId } = renderLoginScreen();

      await waitFor(() => expect(getByTestId('login-email-input')).toBeTruthy());
      expect(getByTestId('login-password-input')).toBeTruthy();
    });

    it('offers a reveal toggle on the password', async () => {
      const { getByTestId } = renderLoginScreen();

      await waitFor(() => expect(getByTestId('login-password-input')).toBeTruthy());
      expect(getByTestId('login-password-input').props.secureTextEntry).toBe(true);

      fireEvent.press(getByTestId('login-password-input-reveal'));
      expect(getByTestId('login-password-input').props.secureTextEntry).toBe(false);
    });
  });

  describe('autofill and keyboard', () => {
    it('asks the OS for the credential saved at sign-up', async () => {
      const { getByTestId } = renderLoginScreen();

      // `username`, not `emailAddress`: it is what pairs an email with a
      // password in the OS credential store.
      await waitFor(() =>
        expect(getByTestId('login-email-input').props.textContentType).toBe('username')
      );
      expect(getByTestId('login-password-input').props.textContentType).toBe('password');
      expect(getByTestId('login-password-input').props.autoComplete).toBe('current-password');
    });

    it('chains the return key and submits from the password field', async () => {
      const { getByTestId } = renderLoginScreen();

      await waitFor(() =>
        expect(getByTestId('login-email-input').props.returnKeyType).toBe('next')
      );
      expect(getByTestId('login-password-input').props.returnKeyType).toBe('go');
    });

    it('submits when the password field is submitted from the keyboard', async () => {
      mockAuthApi.login.mockResolvedValue({
        user: { id: '1', email: 'test@example.com', name: 'Test User', createdAt: '2024-01-01' },
        tokens: { accessToken: 'a', refreshToken: 'r' },
      });
      const utils = renderLoginScreen();
      await waitFor(() => expect(utils.getByTestId('login-email-input')).toBeTruthy());
      fillForm(utils);

      fireEvent(utils.getByTestId('login-password-input'), 'submitEditing');

      await waitFor(() => expect(mockAuthApi.login).toHaveBeenCalled());
    });
  });

  describe('email prefill', () => {
    it('starts empty with no route params', async () => {
      const { getByTestId } = renderLoginScreen();

      await waitFor(() => expect(getByTestId('login-email-input').props.value).toBe(''));
    });

    it('prefills the email Register handed over after a duplicate-email 409', async () => {
      mockRouteParams = { email: 'taken@example.com' };

      const { getByTestId } = renderLoginScreen();

      await waitFor(() =>
        expect(getByTestId('login-email-input').props.value).toBe('taken@example.com')
      );
    });
  });

  describe('advancing between fields', () => {
    // returnKeyType 'next' must move to the following field, never submit --
    // otherwise the return key fires off a half-filled form.
    it.each(['login-email-input'])(
      'does not submit when %s is submitted from the keyboard',
      async (testID) => {
        const utils = renderLoginScreen();
        await waitFor(() => expect(utils.getByTestId('login-email-input')).toBeTruthy());
        fillForm(utils);

        fireEvent(utils.getByTestId(testID), 'submitEditing');

        expect(mockAuthApi.login).not.toHaveBeenCalled();
      }
    );
  });

  describe('validation', () => {
    it.each([
      ['email', { email: '' }, 'login-email-input-error', 'Email is required'],
      ['email format', { email: 'nope' }, 'login-email-input-error', 'Please enter a valid email'],
      ['password', { password: '' }, 'login-password-input-error', 'Password is required'],
    ])('reports a missing %s under its own field', async (_label, overrides, testID, message) => {
      const utils = renderLoginScreen();
      await waitFor(() => expect(utils.getByTestId('login-email-input')).toBeTruthy());
      fillForm(utils, overrides);

      fireEvent.press(utils.getByTestId('login-button'));

      await waitFor(() => expect(utils.getByTestId(testID).props.children).toBe(message));
      expect(mockAuthApi.login).not.toHaveBeenCalled();
    });

    it('reports both failures at once', async () => {
      const utils = renderLoginScreen();
      await waitFor(() => expect(utils.getByTestId('login-email-input')).toBeTruthy());

      fireEvent.press(utils.getByTestId('login-button'));

      await waitFor(() => expect(utils.getByTestId('login-email-input-error')).toBeTruthy());
      expect(utils.getByTestId('login-password-input-error')).toBeTruthy();
    });

    it('clears a field error as soon as the user edits that field', async () => {
      const utils = renderLoginScreen();
      await waitFor(() => expect(utils.getByTestId('login-email-input')).toBeTruthy());
      fireEvent.press(utils.getByTestId('login-button'));
      await waitFor(() => expect(utils.getByTestId('login-email-input-error')).toBeTruthy());

      fireEvent.changeText(utils.getByTestId('login-email-input'), 'a');

      expect(utils.queryByTestId('login-email-input-error')).toBeNull();
    });

    it('does not apply the sign-up length limits to an existing credential', async () => {
      mockAuthApi.login.mockResolvedValue({
        user: { id: '1', email: 'test@example.com', name: 'Test User', createdAt: '2024-01-01' },
        tokens: { accessToken: 'a', refreshToken: 'r' },
      });
      const utils = renderLoginScreen();
      await waitFor(() => expect(utils.getByTestId('login-email-input')).toBeTruthy());
      fillForm(utils, { password: 'a'.repeat(200) });

      fireEvent.press(utils.getByTestId('login-button'));

      await waitFor(() => expect(mockAuthApi.login).toHaveBeenCalled());
    });
  });

  describe('submission', () => {
    it('sends the trimmed email with the password', async () => {
      mockAuthApi.login.mockResolvedValue({
        user: { id: '1', email: 'test@example.com', name: 'Test User', createdAt: '2024-01-01' },
        tokens: { accessToken: 'a', refreshToken: 'r' },
      });
      const utils = renderLoginScreen();
      await waitFor(() => expect(utils.getByTestId('login-email-input')).toBeTruthy());
      fillForm(utils, { email: '  test@example.com  ' });

      fireEvent.press(utils.getByTestId('login-button'));

      await waitFor(() =>
        expect(mockAuthApi.login).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        })
      );
    });

    it('shows the server message when login fails', async () => {
      mockAuthApi.login.mockRejectedValue(new Error('Invalid credentials'));
      const utils = renderLoginScreen();
      await waitFor(() => expect(utils.getByTestId('login-email-input')).toBeTruthy());
      fillForm(utils);

      fireEvent.press(utils.getByTestId('login-button'));

      await waitFor(() =>
        expect(utils.getByTestId('login-error').props.children).toBe('Invalid credentials')
      );
    });

    it('clears the server error once the user edits a field', async () => {
      mockAuthApi.login.mockRejectedValue(new Error('Invalid credentials'));
      const utils = renderLoginScreen();
      await waitFor(() => expect(utils.getByTestId('login-email-input')).toBeTruthy());
      fillForm(utils);
      fireEvent.press(utils.getByTestId('login-button'));
      await waitFor(() => expect(utils.getByTestId('login-error')).toBeTruthy());

      fireEvent.changeText(utils.getByTestId('login-password-input'), 'other-password');

      await waitFor(() => expect(utils.queryByTestId('login-error')).toBeNull());
    });
  });

  describe('navigation', () => {
    it('goes to Register from the sign-up link', async () => {
      const { getByTestId } = renderLoginScreen();
      await waitFor(() => expect(getByTestId('login-signup-link')).toBeTruthy());

      fireEvent.press(getByTestId('login-signup-link'));

      expect(mockNavigate).toHaveBeenCalledWith('Register');
    });
  });
});
