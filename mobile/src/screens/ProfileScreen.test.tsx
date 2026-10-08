import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ProfileScreen } from './ProfileScreen';
import { useAuthContext } from '@/context/AuthContext';
import { PROFILE_NAME_MAX_LENGTH } from '@/utils/authUtils';

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
      fireEvent.press(utils.getByTestId('save-profile-button'));

      await waitFor(() => {
        expect(utils.queryByTestId('profile-name-input')).toBeNull();
      });
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
      fireEvent.press(utils.getByTestId('save-profile-button'));

      await waitFor(() => {
        expect(utils.getByTestId('profile-email-input-error').props.children).toBe(
          'Email is already in use'
        );
      });
      expect(mockUpdateProfile).toHaveBeenCalledWith({ email: 'taken@example.com' });
      expect(utils.queryByTestId('profile-form-error')).toBeNull();
      expect(utils.queryByTestId('profile-success')).toBeNull();
    });

    it('shows any other failure above the buttons', async () => {
      mockUpdateProfile.mockRejectedValue(new Error('Network Error'));
      const utils = renderScreen();
      openEditor(utils);

      fireEvent.changeText(utils.getByTestId('profile-name-input'), 'New Name');
      fireEvent.press(utils.getByTestId('save-profile-button'));

      await waitFor(() => {
        expect(utils.getByTestId('profile-form-error').props.children).toBe('Network Error');
      });
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
      fireEvent.press(utils.getByTestId('save-profile-button'));

      await waitFor(() => {
        expect(utils.getByTestId('save-profile-button').props.accessibilityState).toEqual({
          disabled: true,
        });
      });

      resolve();
      await waitFor(() => {
        expect(utils.queryByTestId('save-profile-button')).toBeNull();
      });
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
});
