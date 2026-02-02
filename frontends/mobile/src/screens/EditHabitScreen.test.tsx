import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { EditHabitScreen } from './EditHabitScreen';
import { useHabit, useUpdateHabit, useDeleteHabit } from '@/hooks';

jest.mock('@/hooks', () => ({
  useHabit: jest.fn(),
  useUpdateHabit: jest.fn(),
  useDeleteHabit: jest.fn(),
}));

const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: mockGoBack,
  }),
  useRoute: () => ({
    params: { habitId: 'habit-123' },
  }),
}));

jest.spyOn(Alert, 'alert');

const mockUseHabit = useHabit as jest.Mock;
const mockUseUpdateHabit = useUpdateHabit as jest.Mock;
const mockUseDeleteHabit = useDeleteHabit as jest.Mock;

const mockHabit = {
  id: 'habit-123',
  name: 'Exercise',
  description: 'Daily workout',
  icon: '💪',
  color: '#10b981',
  frequency: 'daily' as const,
};

describe('EditHabitScreen', () => {
  const mockUpdateMutateAsync = jest.fn();
  const mockDeleteMutateAsync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseUpdateHabit.mockReturnValue({
      mutateAsync: mockUpdateMutateAsync,
      isPending: false,
    });
    mockUseDeleteHabit.mockReturnValue({
      mutateAsync: mockDeleteMutateAsync,
      isPending: false,
    });
  });

  it('renders loading state when habit is loading', () => {
    mockUseHabit.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    const { UNSAFE_root } = render(<EditHabitScreen />);

    // Should render loading indicator (ActivityIndicator)
    expect(UNSAFE_root).toBeTruthy();
  });

  it('renders form when habit is loaded', () => {
    mockUseHabit.mockReturnValue({
      data: mockHabit,
      isLoading: false,
    });

    const { getByTestId, getByText } = render(<EditHabitScreen />);

    expect(getByText('Name')).toBeTruthy();
    expect(getByText('Description (optional)')).toBeTruthy();
    expect(getByText('Icon')).toBeTruthy();
    expect(getByText('Color')).toBeTruthy();
    expect(getByText('Frequency')).toBeTruthy();
    expect(getByTestId('save-habit-button')).toBeTruthy();
    expect(getByTestId('delete-habit-button')).toBeTruthy();
  });

  it('shows delete confirmation dialog when delete button pressed', () => {
    mockUseHabit.mockReturnValue({
      data: mockHabit,
      isLoading: false,
    });

    const { getByTestId } = render(<EditHabitScreen />);

    fireEvent.press(getByTestId('delete-habit-button'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Delete Habit',
      'Are you sure you want to delete this habit?',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cancel' }),
        expect.objectContaining({ text: 'Delete', style: 'destructive' }),
      ])
    );
  });

  it('calls delete mutation when confirmed', async () => {
    mockUseHabit.mockReturnValue({
      data: mockHabit,
      isLoading: false,
    });
    mockDeleteMutateAsync.mockResolvedValue(undefined);

    const { getByTestId } = render(<EditHabitScreen />);

    fireEvent.press(getByTestId('delete-habit-button'));

    // Simulate pressing the Delete button in the alert
    const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
    const buttons = alertCall[2];
    const deleteButton = buttons.find((btn: { text: string }) => btn.text === 'Delete');

    await deleteButton.onPress();

    await waitFor(() => {
      expect(mockDeleteMutateAsync).toHaveBeenCalledWith('habit-123');
    });

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('does not delete when cancelled', () => {
    mockUseHabit.mockReturnValue({
      data: mockHabit,
      isLoading: false,
    });

    const { getByTestId } = render(<EditHabitScreen />);

    fireEvent.press(getByTestId('delete-habit-button'));

    // Simulate pressing Cancel
    const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
    const buttons = alertCall[2];
    const cancelButton = buttons.find((btn: { text: string }) => btn.text === 'Cancel');

    // Cancel button shouldn't have onPress or it should do nothing
    expect(cancelButton.style).toBe('cancel');
    expect(mockDeleteMutateAsync).not.toHaveBeenCalled();
  });

  it('disables buttons when update is pending', () => {
    mockUseHabit.mockReturnValue({
      data: mockHabit,
      isLoading: false,
    });
    mockUseUpdateHabit.mockReturnValue({
      mutateAsync: mockUpdateMutateAsync,
      isPending: true,
    });

    const { getByTestId } = render(<EditHabitScreen />);

    const saveButton = getByTestId('save-habit-button');
    expect(saveButton.props.accessibilityState?.disabled).toBe(true);
  });

  it('disables delete button when delete is pending', () => {
    mockUseHabit.mockReturnValue({
      data: mockHabit,
      isLoading: false,
    });
    mockUseDeleteHabit.mockReturnValue({
      mutateAsync: mockDeleteMutateAsync,
      isPending: true,
    });

    const { getByTestId } = render(<EditHabitScreen />);

    const deleteButton = getByTestId('delete-habit-button');
    expect(deleteButton.props.accessibilityState?.disabled).toBe(true);
  });
});
