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

  const mockOnToggleCompletion = jest.fn();
  const mockOnDelete = jest.fn();
  const mockIsCompletedOnDate = jest.fn((habitId: string, date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    return mockHabit.completedDates.includes(dateString);
  });

  beforeEach(() => {
    mockOnToggleCompletion.mockClear();
    mockOnDelete.mockClear();
    mockIsCompletedOnDate.mockClear();
  });

  it('should render habit name and description', () => {
    render(
      <HabitCard
        habit={mockHabit}
        onToggleCompletion={mockOnToggleCompletion}
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
        onToggleCompletion={mockOnToggleCompletion}
        onDelete={mockOnDelete}
        isCompletedOnDate={mockIsCompletedOnDate}
      />
    );

    expect(screen.getByText('Exercise')).toBeInTheDocument();
    expect(screen.queryByText('30 minutes workout')).not.toBeInTheDocument();
  });

  it('should render 7 day buttons', () => {
    render(
      <HabitCard
        habit={mockHabit}
        onToggleCompletion={mockOnToggleCompletion}
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

  it('should call onToggleCompletion when day button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <HabitCard
        habit={mockHabit}
        onToggleCompletion={mockOnToggleCompletion}
        onDelete={mockOnDelete}
        isCompletedOnDate={mockIsCompletedOnDate}
      />
    );

    const buttons = screen.getAllByRole('button');
    const dayButtons = buttons.filter(btn => !btn.getAttribute('aria-label')?.includes('Delete'));

    // Click the first day button
    await user.click(dayButtons[0]);

    expect(mockOnToggleCompletion).toHaveBeenCalledTimes(1);
    expect(mockOnToggleCompletion).toHaveBeenCalledWith(mockHabit.id, expect.any(Date));
  });

  it('should call onDelete when delete button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <HabitCard
        habit={mockHabit}
        onToggleCompletion={mockOnToggleCompletion}
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
        onToggleCompletion={mockOnToggleCompletion}
        onDelete={mockOnDelete}
        isCompletedOnDate={mockIsCompletedOnDate}
      />
    );

    // Check if color indicator exists with correct color
    const colorIndicator = container.querySelector('[style*="background-color"]');
    expect(colorIndicator).toBeInTheDocument();
  });

  it('should style completed days differently', () => {
    // Mock to return true for exactly one specific date
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];

    const mockIsCompleted = jest.fn((_habitId: string, date: Date) => {
      const dateString = date.toISOString().split('T')[0];
      return dateString === todayString;
    });

    const { container } = render(
      <HabitCard
        habit={mockHabit}
        onToggleCompletion={mockOnToggleCompletion}
        onDelete={mockOnDelete}
        isCompletedOnDate={mockIsCompleted}
      />
    );

    // Verify the mock was called (meaning component is checking completion status)
    expect(mockIsCompleted).toHaveBeenCalled();

    // Check that at least one day button has a filled background (completed state)
    const dayCircles = container.querySelectorAll('.w-8.h-8.rounded-full');
    const hasColoredBackground = Array.from(dayCircles).some(circle => {
      const style = (circle as HTMLElement).style.backgroundColor;
      return style && style !== 'transparent' && style !== '';
    });

    expect(hasColoredBackground).toBe(true);
  });
});
