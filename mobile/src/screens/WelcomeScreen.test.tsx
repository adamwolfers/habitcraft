import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { WelcomeScreen } from './WelcomeScreen';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

describe('WelcomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the brand', () => {
    const { getByTestId, getByText } = render(<WelcomeScreen />);

    expect(getByTestId('welcome-screen')).toBeTruthy();
    expect(getByText('HabitCraft')).toBeTruthy();
  });

  it('offers signing up and logging in as equal choices', () => {
    // Login used to be the initial route, so a first-time user landed in a form
    // built for somebody else and had to find a link out of it.
    const { getByTestId } = render(<WelcomeScreen />);

    expect(getByTestId('welcome-signup-button')).toBeTruthy();
    expect(getByTestId('welcome-login-button')).toBeTruthy();
  });

  it('goes to Register from Get Started', () => {
    const { getByTestId } = render(<WelcomeScreen />);

    fireEvent.press(getByTestId('welcome-signup-button'));

    expect(mockNavigate).toHaveBeenCalledWith('Register');
  });

  it('goes to Login from Log In', () => {
    const { getByTestId } = render(<WelcomeScreen />);

    fireEvent.press(getByTestId('welcome-login-button'));

    expect(mockNavigate).toHaveBeenCalledWith('Login');
  });
});
