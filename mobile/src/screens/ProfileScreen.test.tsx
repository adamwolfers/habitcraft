import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { ProfileScreen } from './ProfileScreen';
import { useAuthContext } from '@/context/AuthContext';
import {
  NEW_PASSWORD_MAX_LENGTH,
  NEW_PASSWORD_MIN_LENGTH,
  PROFILE_NAME_MAX_LENGTH,
} from '@/utils/authUtils';

jest.mock('@/context/AuthContext', () => ({
  useAuthContext: jest.fn(),
}));

const mockUseAuthContext = useAuthContext as jest.Mock;

describe('ProfileScreen', () => {
  const mockLogout = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders profile screen with user email', () => {
    mockUseAuthContext.mockReturnValue({
      user: { id: 'user-1', email: 'test@example.com' },
      logout: mockLogout,
    });

    const { getByTestId, getByText } = render(<ProfileScreen />);

    expect(getByTestId('profile-screen')).toBeTruthy();
    expect(getByText('Profile')).toBeTruthy();
    expect(getByTestId('profile-email')).toBeTruthy();
    expect(getByText('test@example.com')).toBeTruthy();
  });

  it('renders without email when user is null', () => {
    mockUseAuthContext.mockReturnValue({
      user: null,
      logout: mockLogout,
    });

    const { getByTestId, getByText, queryByTestId } = render(<ProfileScreen />);

    expect(getByTestId('profile-screen')).toBeTruthy();
    expect(getByText('Profile')).toBeTruthy();
    expect(queryByTestId('profile-email')).toBeNull();
  });

  it('renders logout button', () => {
    mockUseAuthContext.mockReturnValue({
      user: { id: 'user-1', email: 'test@example.com' },
      logout: mockLogout,
    });

    const { getByTestId, getByText } = render(<ProfileScreen />);

    expect(getByTestId('logout-button')).toBeTruthy();
    expect(getByText('Log Out')).toBeTruthy();
  });

  it('calls logout when button is pressed', async () => {
    mockLogout.mockResolvedValue(undefined);
    mockUseAuthContext.mockReturnValue({
      user: { id: 'user-1', email: 'test@example.com' },
      logout: mockLogout,
    });

    const { getByTestId } = render(<ProfileScreen />);

    fireEvent.press(getByTestId('logout-button'));

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
    });
  });

  it('has correct accessibility attributes on logout button', () => {
    mockUseAuthContext.mockReturnValue({
      user: { id: 'user-1', email: 'test@example.com' },
      logout: mockLogout,
    });

    const { getByTestId } = render(<ProfileScreen />);

    const button = getByTestId('logout-button');
    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityLabel).toBe('Log out');
  });

  describe('editing name and email', () => {
    const user = {
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      createdAt: '2024-01-01',
    };
    const mockUpdateProfile = jest.fn();

    const renderScreen = () => {
      mockUseAuthContext.mockReturnValue({
        user,
        logout: mockLogout,
        updateProfile: mockUpdateProfile,
      });
      return render(<ProfileScreen />);
    };

    const openEditor = (utils: ReturnType<typeof render>) => {
      fireEvent.press(utils.getByTestId('edit-profile-button'));
    };

    // Presses Save inside an async act, which flushes the mocked updateProfile
    // promise and the state updates after it before returning. The assertions
    // that follow are then synchronous. Polling with waitFor instead raced its
    // 1s default timeout and lost under test-all's load (habitcraft-r62m).
    const pressSave = async (utils: ReturnType<typeof render>) => {
      await act(async () => {
        fireEvent.press(utils.getByTestId('save-profile-button'));
      });
    };

    it('shows the user name alongside the email', () => {
      const { getByTestId } = renderScreen();

      expect(getByTestId('profile-name').props.children).toBe('Test User');
    });

    it('opens a form prefilled with the current name and email', () => {
      const utils = renderScreen();
      expect(utils.queryByTestId('profile-name-input')).toBeNull();

      openEditor(utils);

      expect(utils.getByTestId('profile-name-input').props.value).toBe('Test User');
      expect(utils.getByTestId('profile-email-input').props.value).toBe('test@example.com');
    });

    it('caps the name input at the spec limit', () => {
      const utils = renderScreen();
      openEditor(utils);

      expect(utils.getByTestId('profile-name-input').props.maxLength).toBe(PROFILE_NAME_MAX_LENGTH);
    });

    it('sends only the changed fields and closes the form on success', async () => {
      mockUpdateProfile.mockResolvedValue(undefined);
      const utils = renderScreen();
      openEditor(utils);

      fireEvent.changeText(utils.getByTestId('profile-name-input'), '  New Name ');
      await pressSave(utils);

      expect(utils.queryByTestId('profile-name-input')).toBeNull();
      expect(mockUpdateProfile).toHaveBeenCalledWith({ name: 'New Name' });
      expect(utils.getByTestId('profile-success')).toBeTruthy();
    });

    it('closes without a request when nothing changed', () => {
      const utils = renderScreen();
      openEditor(utils);

      fireEvent.press(utils.getByTestId('save-profile-button'));

      expect(mockUpdateProfile).not.toHaveBeenCalled();
      expect(utils.queryByTestId('profile-name-input')).toBeNull();
    });

    it('shows validation errors under each field without calling the server', () => {
      const utils = renderScreen();
      openEditor(utils);

      fireEvent.changeText(utils.getByTestId('profile-name-input'), ' ');
      fireEvent.changeText(utils.getByTestId('profile-email-input'), 'not-an-email');
      fireEvent.press(utils.getByTestId('save-profile-button'));

      expect(utils.getByTestId('profile-name-input-error').props.children).toBe('Name is required');
      expect(utils.getByTestId('profile-email-input-error').props.children).toBe(
        'Please enter a valid email'
      );
      expect(mockUpdateProfile).not.toHaveBeenCalled();
    });

    it('clears a field error once that field is edited', () => {
      const utils = renderScreen();
      openEditor(utils);

      fireEvent.changeText(utils.getByTestId('profile-name-input'), '');
      fireEvent.press(utils.getByTestId('save-profile-button'));
      expect(utils.getByTestId('profile-name-input-error')).toBeTruthy();

      fireEvent.changeText(utils.getByTestId('profile-name-input'), 'N');

      expect(utils.queryByTestId('profile-name-input-error')).toBeNull();
    });

    it('puts a duplicate-email 409 under the email field and keeps the form open', async () => {
      mockUpdateProfile.mockRejectedValue(
        Object.assign(new Error('Email is already in use'), { status: 409 })
      );
      const utils = renderScreen();
      openEditor(utils);

      fireEvent.changeText(utils.getByTestId('profile-email-input'), 'taken@example.com');
      await pressSave(utils);

      expect(utils.getByTestId('profile-email-input-error').props.children).toBe(
        'Email is already in use'
      );
      expect(mockUpdateProfile).toHaveBeenCalledWith({ email: 'taken@example.com' });
      expect(utils.queryByTestId('profile-form-error')).toBeNull();
      expect(utils.queryByTestId('profile-success')).toBeNull();
    });

    it('shows any other failure above the buttons', async () => {
      mockUpdateProfile.mockRejectedValue(new Error('Network Error'));
      const utils = renderScreen();
      openEditor(utils);

      fireEvent.changeText(utils.getByTestId('profile-name-input'), 'New Name');
      await pressSave(utils);

      expect(utils.getByTestId('profile-form-error').props.children).toBe('Network Error');
      expect(utils.getByTestId('profile-name-input')).toBeTruthy();
    });

    it('disables the save button while the request is in flight', async () => {
      let resolve: () => void = () => {};
      mockUpdateProfile.mockReturnValue(
        new Promise<void>((r) => {
          resolve = r;
        })
      );
      const utils = renderScreen();
      openEditor(utils);

      fireEvent.changeText(utils.getByTestId('profile-name-input'), 'New Name');
      // The promise stays pending, so the act returns with the request in flight.
      await pressSave(utils);

      expect(utils.getByTestId('save-profile-button').props.accessibilityState).toEqual({
        disabled: true,
      });

      await act(async () => {
        resolve();
      });
      expect(utils.queryByTestId('save-profile-button')).toBeNull();
    });

    it('cancel discards edits and errors', () => {
      const utils = renderScreen();
      openEditor(utils);

      fireEvent.changeText(utils.getByTestId('profile-name-input'), '');
      fireEvent.press(utils.getByTestId('save-profile-button'));
      fireEvent.press(utils.getByTestId('cancel-edit-profile-button'));

      expect(utils.queryByTestId('profile-name-input')).toBeNull();
      openEditor(utils);
      expect(utils.getByTestId('profile-name-input').props.value).toBe('Test User');
      expect(utils.queryByTestId('profile-name-input-error')).toBeNull();
    });
  });

  describe('changing the password', () => {
    const user = {
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      createdAt: '2024-01-01',
    };
    const mockChangePassword = jest.fn();
    const newPassword = 'n'.repeat(NEW_PASSWORD_MIN_LENGTH);

    const renderScreen = () => {
      mockUseAuthContext.mockReturnValue({
        user,
        logout: mockLogout,
        updateProfile: jest.fn(),
        changePassword: mockChangePassword,
        deleteAccount: jest.fn(),
      });
      return render(<ProfileScreen />);
    };

    const openForm = (utils: ReturnType<typeof render>) => {
      fireEvent.press(utils.getByTestId('change-password-button'));
    };

    const fillForm = (
      utils: ReturnType<typeof render>,
      values: { current?: string; next?: string; confirm?: string } = {}
    ) => {
      fireEvent.changeText(
        utils.getByTestId('current-password-input'),
        values.current ?? 'old-password'
      );
      fireEvent.changeText(utils.getByTestId('new-password-input'), values.next ?? newPassword);
      fireEvent.changeText(
        utils.getByTestId('confirm-new-password-input'),
        values.confirm ?? values.next ?? newPassword
      );
    };

    // Same reasoning as pressSave above: an async act flushes the mocked
    // promise and the state after it (habitcraft-r62m).
    const pressSubmit = async (utils: ReturnType<typeof render>) => {
      await act(async () => {
        fireEvent.press(utils.getByTestId('submit-password-button'));
      });
    };

    it('does not show the form until Change Password is pressed', () => {
      const utils = renderScreen();

      expect(utils.queryByTestId('current-password-input')).toBeNull();

      openForm(utils);

      expect(utils.getByTestId('current-password-input')).toBeTruthy();
      expect(utils.getByTestId('new-password-input')).toBeTruthy();
      expect(utils.getByTestId('confirm-new-password-input')).toBeTruthy();
    });

    it('caps the new password inputs at the spec limit', () => {
      const utils = renderScreen();
      openForm(utils);

      expect(utils.getByTestId('new-password-input').props.maxLength).toBe(NEW_PASSWORD_MAX_LENGTH);
      expect(utils.getByTestId('confirm-new-password-input').props.maxLength).toBe(
        NEW_PASSWORD_MAX_LENGTH
      );
    });

    it('changes the password, closes the form and confirms it', async () => {
      mockChangePassword.mockResolvedValue(undefined);
      const utils = renderScreen();
      openForm(utils);
      fillForm(utils);

      await pressSubmit(utils);

      expect(mockChangePassword).toHaveBeenCalledWith({
        currentPassword: 'old-password',
        newPassword,
        confirmPassword: newPassword,
      });
      expect(utils.queryByTestId('current-password-input')).toBeNull();
      expect(utils.getByTestId('password-success')).toBeTruthy();
    });

    it('shows validation errors under each field without calling the server', () => {
      const utils = renderScreen();
      openForm(utils);
      fillForm(utils, { current: '', next: 'short', confirm: 'other' });

      fireEvent.press(utils.getByTestId('submit-password-button'));

      expect(utils.getByTestId('current-password-input-error')).toBeTruthy();
      expect(utils.getByTestId('new-password-input-error')).toBeTruthy();
      expect(utils.getByTestId('confirm-new-password-input-error')).toBeTruthy();
      expect(mockChangePassword).not.toHaveBeenCalled();
    });

    it('clears a field error once that field is edited', () => {
      const utils = renderScreen();
      openForm(utils);
      fillForm(utils, { current: '' });
      fireEvent.press(utils.getByTestId('submit-password-button'));

      fireEvent.changeText(utils.getByTestId('current-password-input'), 'old-password');

      expect(utils.queryByTestId('current-password-input-error')).toBeNull();
    });

    it('puts a wrong-current-password 401 under the current password field', async () => {
      mockChangePassword.mockRejectedValue(
        Object.assign(new Error('Invalid current password'), { status: 401 })
      );
      const utils = renderScreen();
      openForm(utils);
      fillForm(utils, { current: 'wrong' });

      await pressSubmit(utils);

      expect(utils.getByTestId('current-password-input-error').props.children).toBe(
        'Invalid current password'
      );
      expect(utils.queryByTestId('password-form-error')).toBeNull();
      expect(utils.getByTestId('current-password-input')).toBeTruthy();
    });

    it('shows a rate-limit 429 above the buttons and keeps the form open', async () => {
      mockChangePassword.mockRejectedValue(
        Object.assign(new Error('Too many password change attempts, please try again later.'), {
          status: 429,
        })
      );
      const utils = renderScreen();
      openForm(utils);
      fillForm(utils);

      await pressSubmit(utils);

      expect(utils.getByTestId('password-form-error').props.children).toBe(
        'Too many password change attempts, please try again later.'
      );
      expect(utils.getByTestId('submit-password-button')).toBeTruthy();
    });

    it('disables submit while the request is in flight', async () => {
      let resolve: () => void = () => {};
      mockChangePassword.mockReturnValue(
        new Promise<void>((r) => {
          resolve = r;
        })
      );
      const utils = renderScreen();
      openForm(utils);
      fillForm(utils);

      await pressSubmit(utils);

      expect(utils.getByTestId('submit-password-button').props.accessibilityState).toEqual({
        disabled: true,
      });

      await act(async () => {
        resolve();
      });
      expect(utils.queryByTestId('submit-password-button')).toBeNull();
    });

    it('cancel closes the form and drops what was typed', () => {
      const utils = renderScreen();
      openForm(utils);
      fillForm(utils, { current: '' });
      fireEvent.press(utils.getByTestId('submit-password-button'));

      fireEvent.press(utils.getByTestId('cancel-password-button'));

      expect(utils.queryByTestId('current-password-input')).toBeNull();
      openForm(utils);
      expect(utils.getByTestId('new-password-input').props.value).toBe('');
      expect(utils.queryByTestId('current-password-input-error')).toBeNull();
      expect(mockChangePassword).not.toHaveBeenCalled();
    });

    it('hides the other profile actions while the form is open', () => {
      const utils = renderScreen();

      openForm(utils);

      expect(utils.queryByTestId('edit-profile-button')).toBeNull();
      expect(utils.queryByTestId('delete-account-button')).toBeNull();
    });

    it('hides Change Password while the profile is being edited', () => {
      const utils = renderScreen();

      fireEvent.press(utils.getByTestId('edit-profile-button'));

      expect(utils.queryByTestId('change-password-button')).toBeNull();
    });

    it('hides Change Password while deleting the account', () => {
      const utils = renderScreen();

      fireEvent.press(utils.getByTestId('delete-account-button'));

      expect(utils.queryByTestId('change-password-button')).toBeNull();
    });
  });

  describe('deleting the account', () => {
    const user = {
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      createdAt: '2024-01-01',
    };
    const mockDeleteAccount = jest.fn();
    let alertSpy: jest.SpyInstance;

    beforeEach(() => {
      alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    });

    afterEach(() => {
      alertSpy.mockRestore();
    });

    const renderScreen = () => {
      mockUseAuthContext.mockReturnValue({
        user,
        logout: mockLogout,
        updateProfile: jest.fn(),
        deleteAccount: mockDeleteAccount,
      });
      return render(<ProfileScreen />);
    };

    const openConfirmation = (utils: ReturnType<typeof render>) => {
      fireEvent.press(utils.getByTestId('delete-account-button'));
    };

    const pressPermanentlyDelete = (utils: ReturnType<typeof render>) => {
      fireEvent.press(utils.getByTestId('confirm-delete-account-button'));
    };

    // Presses the destructive button of the native Alert the screen raised,
    // inside an async act so the mocked deleteAccount promise and the state
    // updates after it are flushed before the assertions run.
    const confirmAlert = async () => {
      const buttons = alertSpy.mock.calls[0][2] as Array<{
        text: string;
        style?: string;
        onPress?: () => Promise<void>;
      }>;
      const destructive = buttons.find((button) => button.style === 'destructive');
      await act(async () => {
        await destructive?.onPress?.();
      });
    };

    it('does not ask for the password until Delete Account is pressed', () => {
      const utils = renderScreen();

      expect(utils.getByTestId('delete-account-button')).toBeTruthy();
      expect(utils.queryByTestId('delete-account-password-input')).toBeNull();

      openConfirmation(utils);

      expect(utils.getByTestId('delete-account-password-input')).toBeTruthy();
      expect(utils.getByText(/cannot be undone/i)).toBeTruthy();
    });

    it('keeps Permanently Delete disabled until a password is typed', () => {
      const utils = renderScreen();
      openConfirmation(utils);

      const button = () => utils.getByTestId('confirm-delete-account-button');
      expect(button().props.accessibilityState.disabled).toBe(true);

      fireEvent.changeText(utils.getByTestId('delete-account-password-input'), 'password123');

      expect(button().props.accessibilityState.disabled).toBe(false);
    });

    it('asks for a destructive confirmation before deleting anything', () => {
      const utils = renderScreen();
      openConfirmation(utils);
      fireEvent.changeText(utils.getByTestId('delete-account-password-input'), 'password123');

      pressPermanentlyDelete(utils);

      expect(alertSpy).toHaveBeenCalledWith(
        'Delete Account',
        expect.stringMatching(/cannot be undone/i),
        expect.arrayContaining([
          expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
          expect.objectContaining({ text: 'Delete', style: 'destructive' }),
        ])
      );
      expect(mockDeleteAccount).not.toHaveBeenCalled();
    });

    it('deletes the account with the typed password once confirmed', async () => {
      mockDeleteAccount.mockResolvedValue(undefined);
      const utils = renderScreen();
      openConfirmation(utils);
      fireEvent.changeText(utils.getByTestId('delete-account-password-input'), 'password123');
      pressPermanentlyDelete(utils);

      await confirmAlert();

      expect(mockDeleteAccount).toHaveBeenCalledWith('password123');
    });

    it('shows a failure inline and keeps the confirmation open to retry', async () => {
      mockDeleteAccount.mockRejectedValue(
        Object.assign(new Error('Invalid password'), { status: 401 })
      );
      const utils = renderScreen();
      openConfirmation(utils);
      fireEvent.changeText(utils.getByTestId('delete-account-password-input'), 'wrong');
      pressPermanentlyDelete(utils);

      await confirmAlert();

      expect(utils.getByTestId('delete-account-error').props.children).toBe('Invalid password');
      expect(utils.getByTestId('delete-account-password-input')).toBeTruthy();
      expect(
        utils.getByTestId('confirm-delete-account-button').props.accessibilityState.disabled
      ).toBe(false);
    });

    it('clears the error once the password is edited', async () => {
      mockDeleteAccount.mockRejectedValue(new Error('Invalid password'));
      const utils = renderScreen();
      openConfirmation(utils);
      fireEvent.changeText(utils.getByTestId('delete-account-password-input'), 'wrong');
      pressPermanentlyDelete(utils);
      await confirmAlert();

      fireEvent.changeText(utils.getByTestId('delete-account-password-input'), 'wrong2');

      expect(utils.queryByTestId('delete-account-error')).toBeNull();
    });

    it('Keep Account backs out and drops the typed password', () => {
      const utils = renderScreen();
      openConfirmation(utils);
      fireEvent.changeText(utils.getByTestId('delete-account-password-input'), 'password123');

      fireEvent.press(utils.getByTestId('cancel-delete-account-button'));

      expect(utils.queryByTestId('delete-account-password-input')).toBeNull();
      openConfirmation(utils);
      expect(utils.getByTestId('delete-account-password-input').props.value).toBe('');
      expect(mockDeleteAccount).not.toHaveBeenCalled();
    });

    it('hides Delete Account while the profile is being edited', () => {
      const utils = renderScreen();

      fireEvent.press(utils.getByTestId('edit-profile-button'));

      expect(utils.queryByTestId('delete-account-button')).toBeNull();
    });
  });
});
