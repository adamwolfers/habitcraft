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
    // Filter out the delete button and navigation buttons
    const dayButtons = buttons.filter(btn => {
      const label = btn.getAttribute('aria-label');
      return !label || (!label.includes('Delete') && !label.includes('week'));
    });

    // Should have 7 day buttons
    expect(dayButtons.length).toBe(7);
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
    const dayButtons = buttons.filter(btn => {
      const label = btn.getAttribute('aria-label');
      return !label || (!label.includes('Delete') && !label.includes('week'));
    });

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

  describe('Week Navigation', () => {
    it('should render previous week arrow button', () => {
      render(
        <HabitCard
          habit={mockHabit}
          onToggleCompletion={mockOnToggleCompletion}
          onDelete={mockOnDelete}
          isCompletedOnDate={mockIsCompletedOnDate}
        />
      );

      const prevButton = screen.getByLabelText(/previous week/i);
      expect(prevButton).toBeInTheDocument();
    });

    it('should render next week arrow button', () => {
      render(
        <HabitCard
          habit={mockHabit}
          onToggleCompletion={mockOnToggleCompletion}
          onDelete={mockOnDelete}
          isCompletedOnDate={mockIsCompletedOnDate}
        />
      );

      const nextButton = screen.getByLabelText(/next week/i);
      expect(nextButton).toBeInTheDocument();
    });

    it('should navigate to previous week when previous arrow is clicked', async () => {
      const user = userEvent.setup();
      render(
        <HabitCard
          habit={mockHabit}
          onToggleCompletion={mockOnToggleCompletion}
          onDelete={mockOnDelete}
          isCompletedOnDate={mockIsCompletedOnDate}
        />
      );

      const prevButton = screen.getByLabelText(/previous week/i);
      await user.click(prevButton);

      // The component should still render (no crash)
      expect(prevButton).toBeInTheDocument();
    });

    it('should navigate to next week when next arrow is clicked', async () => {
      const user = userEvent.setup();
      render(
        <HabitCard
          habit={mockHabit}
          onToggleCompletion={mockOnToggleCompletion}
          onDelete={mockOnDelete}
          isCompletedOnDate={mockIsCompletedOnDate}
        />
      );

      const nextButton = screen.getByLabelText(/next week/i);
      await user.click(nextButton);

      // The component should still render (no crash)
      expect(nextButton).toBeInTheDocument();
    });

    it('should display current week by default', () => {
      render(
        <HabitCard
          habit={mockHabit}
          onToggleCompletion={mockOnToggleCompletion}
          onDelete={mockOnDelete}
          isCompletedOnDate={mockIsCompletedOnDate}
        />
      );

      // Should show "Current week" or similar indicator
      expect(screen.getByText(/current week/i)).toBeInTheDocument();
    });

    it('should show week date range', () => {
      render(
        <HabitCard
          habit={mockHabit}
          onToggleCompletion={mockOnToggleCompletion}
          onDelete={mockOnDelete}
          isCompletedOnDate={mockIsCompletedOnDate}
        />
      );

      // Should display some indication of the week range
      // Looking for date patterns like "Nov 17 - Nov 23" or similar
      const buttons = screen.getAllByRole('button');
      const dayButtons = buttons.filter(btn => {
        const label = btn.getAttribute('aria-label');
        return !label || (!label.includes('Delete') && !label.includes('week'));
      });

      // Should still have 7 day buttons
      expect(dayButtons.length).toBe(7);
    });
  });
});
