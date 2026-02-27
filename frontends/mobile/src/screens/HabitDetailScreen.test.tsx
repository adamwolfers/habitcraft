import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { HabitDetailScreen } from './HabitDetailScreen';
import { useHabit, useDeleteHabit } from '@/hooks';

jest.mock('@/hooks', () => ({
  useHabit: jest.fn(),
  useDeleteHabit: jest.fn(),
}));

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: mockGoBack,
    navigate: mockNavigate,
  }),
  useRoute: () => ({
    params: { habitId: 'habit-123' },
  }),
}));

jest.spyOn(Alert, 'alert');

const mockUseHabit = useHabit as jest.Mock;
const mockUseDeleteHabit = useDeleteHabit as jest.Mock;

const mockHabit = {
  id: 'habit-123',
  user_id: 'user-1',
  name: 'Exercise',
  description: 'Daily workout routine',
  icon: '💪',
  color: '#10b981',
  frequency: 'daily' as const,
  is_archived: false,
  created_at: '2025-01-15T10:00:00.000Z',
  updated_at: '2025-01-15T10:00:00.000Z',
};

describe('HabitDetailScreen', () => {
  const mockDeleteMutateAsync = jest.fn();
  const mockRefetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDeleteHabit.mockReturnValue({
      mutateAsync: mockDeleteMutateAsync,
      isPending: false,
    });
  });

  it('shows loading indicator while habit is fetching', () => {
    mockUseHabit.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: mockRefetch,
    });

    const { getByTestId } = render(<HabitDetailScreen />);

    expect(getByTestId('loading-indicator')).toBeTruthy();
  });

  it('displays habit data from the hook', () => {
    mockUseHabit.mockReturnValue({
      data: mockHabit,
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });

    const { getByText, getByTestId } = render(<HabitDetailScreen />);

    expect(getByText(mockHabit.name)).toBeTruthy();
    expect(getByText(mockHabit.description)).toBeTruthy();
    expect(getByTestId('edit-habit-button')).toBeTruthy();
    expect(getByTestId('delete-habit-button')).toBeTruthy();
  });

  it('hides description element when habit has no description', () => {
    mockUseHabit.mockReturnValue({
      data: { ...mockHabit, description: undefined },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });

    const { getByText, queryByTestId } = render(<HabitDetailScreen />);

    // Screen loaded (habit name visible)
    expect(getByText(mockHabit.name)).toBeTruthy();
    // Description element absent
    expect(queryByTestId('habit-description')).toBeNull();
  });

  it('navigates to EditHabit when edit button pressed', () => {
    mockUseHabit.mockReturnValue({
      data: mockHabit,
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });

    const { getByTestId } = render(<HabitDetailScreen />);

    fireEvent.press(getByTestId('edit-habit-button'));

    expect(mockNavigate).toHaveBeenCalledWith('EditHabit', { habitId: 'habit-123' });
  });

  it('shows destructive confirmation alert when delete pressed', () => {
    mockUseHabit.mockReturnValue({
      data: mockHabit,
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });

    const { getByTestId } = render(<HabitDetailScreen />);

    fireEvent.press(getByTestId('delete-habit-button'));

    expect(Alert.alert).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ style: 'cancel' }),
        expect.objectContaining({ style: 'destructive' }),
      ])
    );
  });

  it('calls deleteHabit and navigates back on confirm', async () => {
    mockUseHabit.mockReturnValue({
      data: mockHabit,
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });
    mockDeleteMutateAsync.mockResolvedValue(undefined);

    const { getByTestId } = render(<HabitDetailScreen />);

    fireEvent.press(getByTestId('delete-habit-button'));

    const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
    const buttons = alertCall[2];
    const deleteButton = buttons.find((btn: { style: string }) => btn.style === 'destructive');

    await deleteButton.onPress();

    await waitFor(() => {
      expect(mockDeleteMutateAsync).toHaveBeenCalledWith('habit-123');
    });

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('shows error state when fetch fails', () => {
    mockUseHabit.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: mockRefetch,
    });

    const { getByTestId } = render(<HabitDetailScreen />);

    expect(getByTestId('error-state')).toBeTruthy();
  });

  it('calls refetch when retry button pressed', () => {
    mockUseHabit.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: mockRefetch,
    });

    const { getByTestId } = render(<HabitDetailScreen />);

    fireEvent.press(getByTestId('retry-button'));

    expect(mockRefetch).toHaveBeenCalled();
  });
});
