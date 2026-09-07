import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { RegisterScreen } from './RegisterScreen';
import { AuthProvider } from '@/context/AuthContext';
import { authApi } from '@/lib/auth';
import { storage } from '@/lib/storage';
import {
  NAME_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
} from '@/utils/authUtils';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('@/lib/auth', () => ({
  authApi: {
    register: jest.fn(),
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

const renderRegisterScreen = () =>
  render(
    <AuthProvider>
      <RegisterScreen />
    </AuthProvider>
  );

/** Fill every field with something valid, then override what a test is about. */
const fillForm = (
  utils: ReturnType<typeof renderRegisterScreen>,
  overrides: Partial<{ name: string; email: string; password: string }> = {}
) => {
  const values = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'password123',
    ...overrides,
  };
  fireEvent.changeText(utils.getByTestId('register-name-input'), values.name);
  fireEvent.changeText(utils.getByTestId('register-email-input'), values.email);
  fireEvent.changeText(utils.getByTestId('register-password-input'), values.password);
  return values;
};

describe('RegisterScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.hasTokens.mockResolvedValue(false);
  });

  describe('rendering', () => {
    it('renders the title', async () => {
      const { getByText } = renderRegisterScreen();
      await waitFor(() => expect(getByText('Create Account')).toBeTruthy());
    });

    it('asks for exactly three fields', async () => {
      const { getByTestId, queryByTestId } = renderRegisterScreen();

      await waitFor(() => expect(getByTestId('register-name-input')).toBeTruthy());
      expect(getByTestId('register-email-input')).toBeTruthy();
      expect(getByTestId('register-password-input')).toBeTruthy();
      // Replaced by the reveal toggle: on a phone, checking what you typed
      // beats typing it twice.
      expect(queryByTestId('register-confirm-password-input')).toBeNull();
    });

    it('offers a reveal toggle on the password', async () => {
      const { getByTestId } = renderRegisterScreen();

      await waitFor(() => expect(getByTestId('register-password-input-reveal')).toBeTruthy());
      expect(getByTestId('register-password-input').props.secureTextEntry).toBe(true);

      fireEvent.press(getByTestId('register-password-input-reveal'));
      expect(getByTestId('register-password-input').props.secureTextEntry).toBe(false);
    });

    it('states the password minimum before the user is rejected for it', async () => {
      const { getByTestId } = renderRegisterScreen();

      await waitFor(() =>
        expect(getByTestId('register-password-input-hint').props.children).toBe(
          `At least ${PASSWORD_MIN_LENGTH} characters`
        )
      );
    });

    it('caps the name input at the length the spec declares', async () => {
      const { getByTestId } = renderRegisterScreen();

      await waitFor(() =>
        expect(getByTestId('register-name-input').props.maxLength).toBe(NAME_MAX_LENGTH)
      );
    });
  });

  describe('autofill and keyboard', () => {
    // These props are the whole of the OS integration: without them iOS never
    // offers Strong Password nor saves to the Keychain, and Android never fills.
    it.each([
      ['register-name-input', 'name', 'name'],
      ['register-email-input', 'emailAddress', 'email'],
      ['register-password-input', 'newPassword', 'new-password'],
    ])('marks %s for autofill', async (testID, textContentType, autoComplete) => {
      const { getByTestId } = renderRegisterScreen();

      await waitFor(() => expect(getByTestId(testID).props.textContentType).toBe(textContentType));
      expect(getByTestId(testID).props.autoComplete).toBe(autoComplete);
    });

    it("describes the password rules so iOS's suggestion passes server validation", async () => {
      const { getByTestId } = renderRegisterScreen();

      await waitFor(() =>
        expect(getByTestId('register-password-input').props.passwordRules).toBe(
          `minlength: ${PASSWORD_MIN_LENGTH}; maxlength: ${PASSWORD_MAX_LENGTH};`
        )
      );
    });

    it('chains the return key through the fields and submits on the last', async () => {
      const { getByTestId } = renderRegisterScreen();

      await waitFor(() =>
        expect(getByTestId('register-name-input').props.returnKeyType).toBe('next')
      );
      expect(getByTestId('register-email-input').props.returnKeyType).toBe('next');
      expect(getByTestId('register-password-input').props.returnKeyType).toBe('go');
    });

    it('submits when the password field is submitted from the keyboard', async () => {
      mockAuthApi.register.mockResolvedValue({
        user: { id: '1', email: 'test@example.com', name: 'Test User', createdAt: '2024-01-01' },
        tokens: { accessToken: 'a', refreshToken: 'r' },
      });
      const utils = renderRegisterScreen();
      await waitFor(() => expect(utils.getByTestId('register-name-input')).toBeTruthy());
      fillForm(utils);

      fireEvent(utils.getByTestId('register-password-input'), 'submitEditing');

      await waitFor(() => expect(mockAuthApi.register).toHaveBeenCalled());
    });
  });

  describe('advancing between fields', () => {
    // returnKeyType 'next' must move to the following field, never submit --
    // otherwise the return key fires off a half-filled form.
    it.each(['register-name-input', 'register-email-input'])(
      'does not submit when %s is submitted from the keyboard',
      async (testID) => {
        const utils = renderRegisterScreen();
        await waitFor(() => expect(utils.getByTestId('register-name-input')).toBeTruthy());
        fillForm(utils);

        fireEvent(utils.getByTestId(testID), 'submitEditing');

        expect(mockAuthApi.register).not.toHaveBeenCalled();
      }
    );
  });

  describe('validation', () => {
    it.each([
      ['name', { name: '' }, 'register-name-input-error', 'Name is required'],
      ['email', { email: '' }, 'register-email-input-error', 'Email is required'],
      [
        'email format',
        { email: 'nope' },
        'register-email-input-error',
        'Please enter a valid email',
      ],
      ['password', { password: '' }, 'register-password-input-error', 'Password is required'],
    ])('reports a missing %s under its own field', async (_label, overrides, testID, message) => {
      const utils = renderRegisterScreen();
      await waitFor(() => expect(utils.getByTestId('register-name-input')).toBeTruthy());
      fillForm(utils, overrides);

      fireEvent.press(utils.getByTestId('register-button'));

      await waitFor(() => expect(utils.getByTestId(testID).props.children).toBe(message));
      expect(mockAuthApi.register).not.toHaveBeenCalled();
    });

    it("reports a password below the spec's minimum", async () => {
      const utils = renderRegisterScreen();
      await waitFor(() => expect(utils.getByTestId('register-name-input')).toBeTruthy());
      fillForm(utils, { password: 'a'.repeat(PASSWORD_MIN_LENGTH - 1) });

      fireEvent.press(utils.getByTestId('register-button'));

      await waitFor(() =>
        expect(utils.getByTestId('register-password-input-error').props.children).toBe(
          `Password must be at least ${PASSWORD_MIN_LENGTH} characters`
        )
      );
    });

    it("reports a password past the spec's maximum", async () => {
      const utils = renderRegisterScreen();
      await waitFor(() => expect(utils.getByTestId('register-name-input')).toBeTruthy());
      fillForm(utils, { password: 'a'.repeat(PASSWORD_MAX_LENGTH + 1) });

      fireEvent.press(utils.getByTestId('register-button'));

      await waitFor(() =>
        expect(utils.getByTestId('register-password-input-error').props.children).toBe(
          `Password must be ${PASSWORD_MAX_LENGTH} characters or less`
        )
      );
    });

    it("reports an email past the spec's maximum", async () => {
      const utils = renderRegisterScreen();
      await waitFor(() => expect(utils.getByTestId('register-name-input')).toBeTruthy());
      const longEmail = 'a'.repeat(EMAIL_MAX_LENGTH + 1 - '@example.com'.length) + '@example.com';
      fillForm(utils, { email: longEmail });

      fireEvent.press(utils.getByTestId('register-button'));

      await waitFor(() =>
        expect(utils.getByTestId('register-email-input-error').props.children).toBe(
          `Email must be ${EMAIL_MAX_LENGTH} characters or less`
        )
      );
    });

    it('shows every failure at once instead of one submit per mistake', async () => {
      const utils = renderRegisterScreen();
      await waitFor(() => expect(utils.getByTestId('register-name-input')).toBeTruthy());
      fillForm(utils, { name: '', email: 'nope', password: 'short' });

      fireEvent.press(utils.getByTestId('register-button'));

      await waitFor(() => expect(utils.getByTestId('register-name-input-error')).toBeTruthy());
      expect(utils.getByTestId('register-email-input-error')).toBeTruthy();
      expect(utils.getByTestId('register-password-input-error')).toBeTruthy();
    });

    it('clears a field error as soon as the user edits that field', async () => {
      const utils = renderRegisterScreen();
      await waitFor(() => expect(utils.getByTestId('register-name-input')).toBeTruthy());
      fillForm(utils, { name: '' });
      fireEvent.press(utils.getByTestId('register-button'));
      await waitFor(() => expect(utils.getByTestId('register-name-input-error')).toBeTruthy());

      fireEvent.changeText(utils.getByTestId('register-name-input'), 'T');

      expect(utils.queryByTestId('register-name-input-error')).toBeNull();
    });

    it('keeps the other fields filled in when one of them fails', async () => {
      const utils = renderRegisterScreen();
      await waitFor(() => expect(utils.getByTestId('register-name-input')).toBeTruthy());
      fillForm(utils, { password: 'short' });

      fireEvent.press(utils.getByTestId('register-button'));

      await waitFor(() => expect(utils.getByTestId('register-password-input-error')).toBeTruthy());
      expect(utils.getByTestId('register-name-input').props.value).toBe('Test User');
      expect(utils.getByTestId('register-email-input').props.value).toBe('test@example.com');
    });
  });

  describe('submission', () => {
    it('sends the trimmed name and email with the password', async () => {
      mockAuthApi.register.mockResolvedValue({
        user: { id: '1', email: 'test@example.com', name: 'Test User', createdAt: '2024-01-01' },
        tokens: { accessToken: 'a', refreshToken: 'r' },
      });
      const utils = renderRegisterScreen();
      await waitFor(() => expect(utils.getByTestId('register-name-input')).toBeTruthy());
      fillForm(utils, { name: '  Test User  ', email: '  test@example.com  ' });

      fireEvent.press(utils.getByTestId('register-button'));

      await waitFor(() =>
        expect(mockAuthApi.register).toHaveBeenCalledWith({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
        })
      );
    });

    it('shows the server message when registration fails', async () => {
      mockAuthApi.register.mockRejectedValue(new Error('Too many accounts created from this IP'));
      const utils = renderRegisterScreen();
      await waitFor(() => expect(utils.getByTestId('register-name-input')).toBeTruthy());
      fillForm(utils);

      fireEvent.press(utils.getByTestId('register-button'));

      await waitFor(() =>
        expect(utils.getByTestId('register-error').props.children).toBe(
          'Too many accounts created from this IP'
        )
      );
    });
  });

  describe('duplicate email', () => {
    const conflict = () => {
      const error = new Error('User with this email already exists') as Error & { status: number };
      error.status = 409;
      return error;
    };

    it('offers a way to log in instead', async () => {
      mockAuthApi.register.mockRejectedValue(conflict());
      const utils = renderRegisterScreen();
      await waitFor(() => expect(utils.getByTestId('register-name-input')).toBeTruthy());
      fillForm(utils);

      fireEvent.press(utils.getByTestId('register-button'));

      await waitFor(() => expect(utils.getByTestId('register-login-instead')).toBeTruthy());
      expect(utils.getByTestId('register-error').props.children).toBe(
        'User with this email already exists'
      );
    });

    it('carries the email over so the login form is already filled in', async () => {
      mockAuthApi.register.mockRejectedValue(conflict());
      const utils = renderRegisterScreen();
      await waitFor(() => expect(utils.getByTestId('register-name-input')).toBeTruthy());
      fillForm(utils);
      fireEvent.press(utils.getByTestId('register-button'));
      await waitFor(() => expect(utils.getByTestId('register-login-instead')).toBeTruthy());

      fireEvent.press(utils.getByTestId('register-login-instead'));

      expect(mockNavigate).toHaveBeenCalledWith('Login', { email: 'test@example.com' });
    });

    it('does not offer it for a failure that is not a conflict', async () => {
      mockAuthApi.register.mockRejectedValue(new Error('Internal server error'));
      const utils = renderRegisterScreen();
      await waitFor(() => expect(utils.getByTestId('register-name-input')).toBeTruthy());
      fillForm(utils);

      fireEvent.press(utils.getByTestId('register-button'));

      await waitFor(() => expect(utils.getByTestId('register-error')).toBeTruthy());
      expect(utils.queryByTestId('register-login-instead')).toBeNull();
    });

    it('withdraws the offer once the user changes the email', async () => {
      mockAuthApi.register.mockRejectedValue(conflict());
      const utils = renderRegisterScreen();
      await waitFor(() => expect(utils.getByTestId('register-name-input')).toBeTruthy());
      fillForm(utils);
      fireEvent.press(utils.getByTestId('register-button'));
      await waitFor(() => expect(utils.getByTestId('register-login-instead')).toBeTruthy());

      fireEvent.changeText(utils.getByTestId('register-email-input'), 'other@example.com');

      expect(utils.queryByTestId('register-login-instead')).toBeNull();
      expect(utils.queryByTestId('register-error')).toBeNull();
    });
  });

  describe('navigation', () => {
    it('navigates to Login rather than going back, since Welcome sits underneath', async () => {
      const { getByTestId } = renderRegisterScreen();
      await waitFor(() => expect(getByTestId('register-login-link')).toBeTruthy());

      fireEvent.press(getByTestId('register-login-link'));

      expect(mockNavigate).toHaveBeenCalledWith('Login', { email: undefined });
    });
  });
});
