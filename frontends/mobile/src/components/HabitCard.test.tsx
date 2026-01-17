import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { HabitCard } from './HabitCard';
import { Habit } from '@/types';

describe('HabitCard', () => {
  const mockHabit: Habit = {
    id: '1',
    user_id: 'user-1',
    name: 'Morning Exercise',
    description: 'Do 30 minutes of exercise',
    icon: '🏃',
    color: '#10b981',
    frequency: 'daily',
    target_days: [1, 2, 3, 4, 5],
    is_archived: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockOnPress = jest.fn();
  const mockOnComplete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders habit name', () => {
    const { getByText } = render(
      <HabitCard habit={mockHabit} onPress={mockOnPress} onComplete={mockOnComplete} />
    );

    expect(getByText('Morning Exercise')).toBeTruthy();
  });

  it('renders habit icon', () => {
    const { getByText } = render(
      <HabitCard habit={mockHabit} onPress={mockOnPress} onComplete={mockOnComplete} />
    );

    expect(getByText('🏃')).toBeTruthy();
  });

  it('renders habit description when provided', () => {
    const { getByText } = render(
      <HabitCard habit={mockHabit} onPress={mockOnPress} onComplete={mockOnComplete} />
    );

    expect(getByText('Do 30 minutes of exercise')).toBeTruthy();
  });

  it('calls onPress when card is pressed', () => {
    const { getByTestId } = render(
      <HabitCard habit={mockHabit} onPress={mockOnPress} onComplete={mockOnComplete} />
    );

    fireEvent.press(getByTestId('habit-card'));

    expect(mockOnPress).toHaveBeenCalledWith(mockHabit);
  });

  it('calls onComplete when complete button is pressed', () => {
    const { getByTestId } = render(
      <HabitCard habit={mockHabit} onPress={mockOnPress} onComplete={mockOnComplete} />
    );

    fireEvent.press(getByTestId('complete-button'));

    expect(mockOnComplete).toHaveBeenCalledWith(mockHabit.id);
  });

  it('shows completed state when isCompletedToday is true', () => {
    const { getByTestId } = render(
      <HabitCard
        habit={mockHabit}
        onPress={mockOnPress}
        onComplete={mockOnComplete}
        isCompletedToday={true}
      />
    );

    expect(getByTestId('complete-button').props.accessibilityState?.checked).toBe(true);
  });

  it('shows uncompleted state when isCompletedToday is false', () => {
    const { getByTestId } = render(
      <HabitCard
        habit={mockHabit}
        onPress={mockOnPress}
        onComplete={mockOnComplete}
        isCompletedToday={false}
      />
    );

    expect(getByTestId('complete-button').props.accessibilityState?.checked).toBe(false);
  });

  it('displays frequency badge', () => {
    const { getByText } = render(
      <HabitCard habit={mockHabit} onPress={mockOnPress} onComplete={mockOnComplete} />
    );

    expect(getByText('Daily')).toBeTruthy();
  });
});
