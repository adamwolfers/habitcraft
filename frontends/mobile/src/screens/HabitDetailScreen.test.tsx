import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { HabitDetailScreen } from './HabitDetailScreen';

const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: mockGoBack,
  }),
  useRoute: () => ({
    params: { habitId: 'habit-123' },
  }),
}));

describe('HabitDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders habit details screen', () => {
    const { getByText } = render(<HabitDetailScreen />);

    expect(getByText('Habit Details')).toBeTruthy();
    expect(getByText('Viewing habit: habit-123')).toBeTruthy();
  });

  it('renders back button', () => {
    const { getByText } = render(<HabitDetailScreen />);

    expect(getByText('Back')).toBeTruthy();
  });

  it('navigates back when back button is pressed', () => {
    const { getByText } = render(<HabitDetailScreen />);

    fireEvent.press(getByText('Back'));

    expect(mockGoBack).toHaveBeenCalled();
  });
});
