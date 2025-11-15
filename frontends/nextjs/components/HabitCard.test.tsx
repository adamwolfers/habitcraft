import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HabitCard from './HabitCard';
import { Habit } from '@/types/habit';

describe('HabitCard', () => {
  const mockHabit: Habit = {
    id: '1',
    name: 'Exercise',
    description: '30 minutes workout',
    color: '#3b82f6',
    createdAt: '2025-10-30T12:00:00.000Z',
    completedDates: ['2025-10-28', '2025-10-29'],
  };

  const mockOnToggle = jest.fn();
  const mockOnDelete = jest.fn();
  const mockIsCompletedOnDate = jest.fn((habitId: string, date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    return mockHabit.completedDates.includes(dateString);
  });

  beforeEach(() => {
    mockOnToggle.mockClear();
    mockOnDelete.mockClear();
    mockIsCompletedOnDate.mockClear();
  });

  it('should render habit name and description', () => {
    render(
      <HabitCard
        habit={mockHabit}
        onToggle={mockOnToggle}
        onDelete={mockOnDelete}
        isCompletedOnDate={mockIsCompletedOnDate}
      />
    );

    expect(screen.getByText('Exercise')).toBeInTheDocument();
    expect(screen.getByText('30 minutes workout')).toBeInTheDocument();
  });

  it('should render habit without description', () => {
    const habitWithoutDesc = { ...mockHabit, description: undefined };
    render(
      <HabitCard
        habit={habitWithoutDesc}
        onToggle={mockOnToggle}
        onDelete={mockOnDelete}
        isCompletedOnDate={mockIsCompletedOnDate}
      />
    );

    expect(screen.getByText('Exercise')).toBeInTheDocument();
    expect(screen.queryByText('30 minutes workout')).not.toBeInTheDocument();
  });

  it('should display current streak', () => {
    render(
      <HabitCard
        habit={mockHabit}
        onToggle={mockOnToggle}
        onDelete={mockOnDelete}
        isCompletedOnDate={mockIsCompletedOnDate}
      />
    );

    expect(screen.getByText(/streak:/i)).toBeInTheDocument();
  });

  it('should display total completion count', () => {
    render(
      <HabitCard
        habit={mockHabit}
        onToggle={mockOnToggle}
        onDelete={mockOnDelete}
        isCompletedOnDate={mockIsCompletedOnDate}
      />
    );

    expect(screen.getByText(/total: 2/i)).toBeInTheDocument();
  });

  it('should render 7 day buttons', () => {
    render(
      <HabitCard
        habit={mockHabit}
        onToggle={mockOnToggle}
        onDelete={mockOnDelete}
        isCompletedOnDate={mockIsCompletedOnDate}
      />
    );

    // Should have day name buttons (Mon, Tue, etc.)
    const buttons = screen.getAllByRole('button');
    // Filter out the delete button
    const dayButtons = buttons.filter(btn => !btn.getAttribute('aria-label')?.includes('Delete'));

    // Should have 7 day buttons
    expect(dayButtons.length).toBeGreaterThanOrEqual(7);
  });

  it('should call onToggle when day button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <HabitCard
        habit={mockHabit}
        onToggle={mockOnToggle}
        onDelete={mockOnDelete}
        isCompletedOnDate={mockIsCompletedOnDate}
      />
    );

    const buttons = screen.getAllByRole('button');
    const dayButtons = buttons.filter(btn => !btn.getAttribute('aria-label')?.includes('Delete'));

    // Click the first day button
    await user.click(dayButtons[0]);

    expect(mockOnToggle).toHaveBeenCalledTimes(1);
    expect(mockOnToggle).toHaveBeenCalledWith(mockHabit.id, expect.any(Date));
  });

  it('should call onDelete when delete button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <HabitCard
        habit={mockHabit}
        onToggle={mockOnToggle}
        onDelete={mockOnDelete}
        isCompletedOnDate={mockIsCompletedOnDate}
      />
    );

    const deleteButton = screen.getByLabelText(/delete habit/i);
    await user.click(deleteButton);

    expect(mockOnDelete).toHaveBeenCalledTimes(1);
    expect(mockOnDelete).toHaveBeenCalledWith(mockHabit.id);
  });

  it('should use habit color for visual elements', () => {
    const { container } = render(
      <HabitCard
        habit={mockHabit}
        onToggle={mockOnToggle}
        onDelete={mockOnDelete}
        isCompletedOnDate={mockIsCompletedOnDate}
      />
    );

    // Check if color indicator exists with correct color
    const colorIndicator = container.querySelector('[style*="background-color"]');
    expect(colorIndicator).toBeInTheDocument();
  });

  it('should calculate streak correctly for consecutive days', () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayString = today.toISOString().split('T')[0];
    const yesterdayString = yesterday.toISOString().split('T')[0];

    const habitWithStreak: Habit = {
      ...mockHabit,
      completedDates: [yesterdayString, todayString],
    };

    render(
      <HabitCard
        habit={habitWithStreak}
        onToggle={mockOnToggle}
        onDelete={mockOnDelete}
        isCompletedOnDate={mockIsCompletedOnDate}
      />
    );

    // Should show at least 2 days streak
    expect(screen.getByText(/2 days/i)).toBeInTheDocument();
  });

  it('should show singular "day" for streak of 1', () => {
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];

    const habitWithOneDay: Habit = {
      ...mockHabit,
      completedDates: [todayString],
    };

    render(
      <HabitCard
        habit={habitWithOneDay}
        onToggle={mockOnToggle}
        onDelete={mockOnDelete}
        isCompletedOnDate={mockIsCompletedOnDate}
      />
    );

    expect(screen.getByText(/1 day$/i)).toBeInTheDocument();
  });

  it('should show checkmark for completed days', () => {
    const mockIsCompleted = jest.fn((habitId: string, date: Date) => {
      return date.toISOString().split('T')[0] === '2025-10-29';
    });

    render(
      <HabitCard
        habit={mockHabit}
        onToggle={mockOnToggle}
        onDelete={mockOnDelete}
        isCompletedOnDate={mockIsCompleted}
      />
    );

    // There should be checkmark SVGs for completed days
    const svgs = screen.getAllByRole('button').map(btn => btn.querySelector('svg'));
    const checkmarks = svgs.filter(svg => svg?.querySelector('path[d*="M5 13l4 4L19 7"]'));

    expect(checkmarks.length).toBeGreaterThan(0);
  });
});
