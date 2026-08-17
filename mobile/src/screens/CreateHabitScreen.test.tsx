import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { CreateHabitScreen } from './CreateHabitScreen';
import { useCreateHabit } from '@/hooks';

jest.mock('@/hooks', () => ({
  useCreateHabit: jest.fn(),
}));

const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: mockGoBack,
  }),
}));

const mockUseCreateHabit = useCreateHabit as jest.Mock;

describe('CreateHabitScreen', () => {
  const mockMutateAsync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCreateHabit.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });
  });

  it('renders form fields', () => {
    const { getByTestId, getByText } = render(<CreateHabitScreen />);

    expect(getByTestId('habit-name-input')).toBeTruthy();
    expect(getByTestId('habit-description-input')).toBeTruthy();
    expect(getByText('Name')).toBeTruthy();
    expect(getByText('Description (optional)')).toBeTruthy();
    expect(getByText('Icon')).toBeTruthy();
    expect(getByText('Color')).toBeTruthy();
    expect(getByTestId('create-habit-button')).toBeTruthy();
  });

  it('shows error when name is empty', async () => {
    const { getByTestId } = render(<CreateHabitScreen />);

    fireEvent.press(getByTestId('create-habit-button'));

    await waitFor(() => {
      expect(getByTestId('create-habit-error')).toBeTruthy();
    });

    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('creates habit with valid data', async () => {
    mockMutateAsync.mockResolvedValue({ id: 'new-habit' });

    const { getByTestId } = render(<CreateHabitScreen />);

    fireEvent.changeText(getByTestId('habit-name-input'), 'New Habit');
    fireEvent.changeText(getByTestId('habit-description-input'), 'A description');
    fireEvent.press(getByTestId('create-habit-button'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        name: 'New Habit',
        description: 'A description',
        icon: '🏃',
        color: '#10b981',
      });
    });

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('creates habit without description when empty', async () => {
    mockMutateAsync.mockResolvedValue({ id: 'new-habit' });

    const { getByTestId } = render(<CreateHabitScreen />);

    fireEvent.changeText(getByTestId('habit-name-input'), 'New Habit');
    fireEvent.press(getByTestId('create-habit-button'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        name: 'New Habit',
        description: undefined,
        icon: '🏃',
        color: '#10b981',
      });
    });
  });

  it('shows error on mutation failure', async () => {
    mockMutateAsync.mockRejectedValue(new Error('Network error'));

    const { getByTestId } = render(<CreateHabitScreen />);

    fireEvent.changeText(getByTestId('habit-name-input'), 'New Habit');
    fireEvent.press(getByTestId('create-habit-button'));

    await waitFor(() => {
      expect(getByTestId('create-habit-error')).toBeTruthy();
    });

    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('allows selecting different icons', () => {
    const { getByText } = render(<CreateHabitScreen />);

    // Click on different icon
    fireEvent.press(getByText('📚'));

    // The icon should be selected (we can't easily test visual state, but we can verify no crash)
    expect(getByText('📚')).toBeTruthy();
  });

  it('disables button while pending', () => {
    mockUseCreateHabit.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: true,
    });

    const { getByTestId } = render(<CreateHabitScreen />);

    const button = getByTestId('create-habit-button');
    expect(button.props.accessibilityState?.disabled).toBe(true);
  });

  it('trims whitespace from name', async () => {
    mockMutateAsync.mockResolvedValue({ id: 'new-habit' });

    const { getByTestId } = render(<CreateHabitScreen />);

    fireEvent.changeText(getByTestId('habit-name-input'), '  Spaced Name  ');
    fireEvent.press(getByTestId('create-habit-button'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Spaced Name' })
      );
    });
  });
});
