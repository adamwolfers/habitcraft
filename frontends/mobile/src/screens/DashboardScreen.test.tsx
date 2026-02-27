import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { DashboardScreen } from './DashboardScreen';
import { useHabits, useCompleteHabit, useUncompleteHabit } from '@/hooks';
import { HabitWithStats } from '@/types';
import { format } from 'date-fns';

jest.mock('@/hooks', () => ({
  useHabits: jest.fn(),
  useCompleteHabit: jest.fn(),
  useUncompleteHabit: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}));

jest.mock('@/components', () => ({
  HabitCard: ({
    habit,
    onPress,
    onComplete,
    isCompletedToday,
  }: {
    habit: { id: string; name: string };
    onPress: (h: { id: string }) => void;
    onComplete: (id: string) => void;
    isCompletedToday: boolean;
  }) => {
    const { TouchableOpacity, Text } = require('react-native');
    return (
      <TouchableOpacity testID={`habit-card-${habit.id}`} onPress={() => onPress(habit)}>
        <Text>{habit.name}</Text>
        {isCompletedToday && <Text testID={`completed-${habit.id}`}>Completed</Text>}
        <TouchableOpacity testID={`complete-${habit.id}`} onPress={() => onComplete(habit.id)}>
          <Text>Complete</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  },
  OfflineBanner: () => null,
  SyncIndicator: () => null,
}));

jest.mock('@/components/SkeletonLoader', () => ({
  DashboardSkeleton: () => {
    const { View } = require('react-native');
    return <View testID="dashboard-skeleton" />;
  },
}));

const mockNavigate = jest.fn();
const mockUseHabits = useHabits as jest.Mock;
const mockUseCompleteHabit = useCompleteHabit as jest.Mock;
const mockUseUncompleteHabit = useUncompleteHabit as jest.Mock;

const mockHabit: HabitWithStats = {
  id: 'habit-1',
  user_id: 'user-1',
  name: 'Exercise',
  description: 'Daily workout',
  icon: '💪',
  color: '#10b981',
  frequency: 'daily',
  target_days: undefined,
  is_archived: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  current_streak: 5,
  best_streak: 10,
  completions: [],
};

const mockHabit2: HabitWithStats = {
  ...mockHabit,
  id: 'habit-2',
  name: 'Read',
  icon: '📚',
};

describe('DashboardScreen', () => {
  const mockMutate = jest.fn();
  const mockRefetch = jest.fn();

  const mockUncompleteMutate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCompleteHabit.mockReturnValue({ mutate: mockMutate });
    mockUseUncompleteHabit.mockReturnValue({ mutate: mockUncompleteMutate });
  });

  it('renders loading state with skeleton', () => {
    mockUseHabits.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: mockRefetch,
      isRefetching: false,
    });

    const { getByTestId, getByText } = render(<DashboardScreen />);

    expect(getByText('Today')).toBeTruthy();
    expect(getByTestId('dashboard-skeleton')).toBeTruthy();
  });

  it('renders error state with retry button', () => {
    mockUseHabits.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network error'),
      refetch: mockRefetch,
      isRefetching: false,
    });

    const { getByText } = render(<DashboardScreen />);

    expect(getByText('Failed to load habits')).toBeTruthy();
    expect(getByText('Try Again')).toBeTruthy();
  });

  it('calls refetch when retry button is pressed', () => {
    mockUseHabits.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network error'),
      refetch: mockRefetch,
      isRefetching: false,
    });

    const { getByText } = render(<DashboardScreen />);

    fireEvent.press(getByText('Try Again'));

    expect(mockRefetch).toHaveBeenCalled();
  });

  it('renders empty state when no habits', () => {
    mockUseHabits.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
      isRefetching: false,
    });

    const { getByTestId, getByText } = render(<DashboardScreen />);

    expect(getByTestId('empty-state')).toBeTruthy();
    expect(getByText('No habits yet')).toBeTruthy();
    expect(getByText('Create your first habit to start tracking your progress')).toBeTruthy();
  });

  it('renders habits list', () => {
    mockUseHabits.mockReturnValue({
      data: [mockHabit, mockHabit2],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
      isRefetching: false,
    });

    const { getByTestId, getByText } = render(<DashboardScreen />);

    expect(getByTestId('dashboard-screen')).toBeTruthy();
    expect(getByTestId('habit-list')).toBeTruthy();
    expect(getByText('Exercise')).toBeTruthy();
    expect(getByText('Read')).toBeTruthy();
  });

  it('filters out archived habits', () => {
    const archivedHabit = {
      ...mockHabit,
      id: 'habit-archived',
      name: 'Archived',
      is_archived: true,
    };
    mockUseHabits.mockReturnValue({
      data: [mockHabit, archivedHabit],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
      isRefetching: false,
    });

    const { getByText, queryByText } = render(<DashboardScreen />);

    expect(getByText('Exercise')).toBeTruthy();
    expect(queryByText('Archived')).toBeNull();
  });

  it('navigates to HabitDetail when habit is pressed', () => {
    mockUseHabits.mockReturnValue({
      data: [mockHabit],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
      isRefetching: false,
    });

    const { getByTestId } = render(<DashboardScreen />);

    fireEvent.press(getByTestId('habit-card-habit-1'));

    expect(mockNavigate).toHaveBeenCalledWith('HabitDetail', { habitId: 'habit-1' });
  });

  it('navigates to CreateHabit when FAB is pressed', () => {
    mockUseHabits.mockReturnValue({
      data: [mockHabit],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
      isRefetching: false,
    });

    const { getByTestId } = render(<DashboardScreen />);

    fireEvent.press(getByTestId('create-habit-fab'));

    expect(mockNavigate).toHaveBeenCalledWith('CreateHabit');
  });

  it('calls completeHabit mutation when complete is pressed on non-completed habit', () => {
    mockUseHabits.mockReturnValue({
      data: [mockHabit],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
      isRefetching: false,
    });

    const { getByTestId } = render(<DashboardScreen />);

    fireEvent.press(getByTestId('complete-habit-1'));

    expect(mockMutate).toHaveBeenCalledWith({
      id: 'habit-1',
      data: expect.objectContaining({ completed_date: expect.any(String) }),
    });
  });

  it('passes isCompletedToday=true when habit has completion for today', () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const completedHabit: HabitWithStats = {
      ...mockHabit,
      completions: [{ id: 'comp-1', habit_id: 'habit-1', completed_date: today, created_at: '2024-01-01T00:00:00Z' }],
    };
    mockUseHabits.mockReturnValue({
      data: [completedHabit],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
      isRefetching: false,
    });

    const { getByTestId } = render(<DashboardScreen />);

    expect(getByTestId('completed-habit-1')).toBeTruthy();
  });

  it('calls uncompleteHabit mutation when complete is pressed on completed habit', () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const completedHabit: HabitWithStats = {
      ...mockHabit,
      completions: [{ id: 'comp-1', habit_id: 'habit-1', completed_date: today, created_at: '2024-01-01T00:00:00Z' }],
    };
    mockUseHabits.mockReturnValue({
      data: [completedHabit],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
      isRefetching: false,
    });

    const { getByTestId } = render(<DashboardScreen />);

    fireEvent.press(getByTestId('complete-habit-1'));

    expect(mockUncompleteMutate).toHaveBeenCalledWith({
      id: 'habit-1',
      completedDate: today,
    });
    expect(mockMutate).not.toHaveBeenCalled();
  });
});
