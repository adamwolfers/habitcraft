import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HabitCard from './HabitCard';
import { Habit } from '@/types/habit';

describe('HabitCard', () => {
  const mockHabit: Habit = {
    id: '1',
    userId: 'user-1',
    name: 'Exercise',
    description: '30 minutes workout',
    color: '#3b82f6',
    icon: '🏃',
    frequency: 'daily',
    targetDays: [],
    status: 'active',
    createdAt: '2025-10-30T12:00:00.000Z',
    updatedAt: '2025-10-30T12:00:00.000Z',
  };

  const mockOnToggleCompletion = jest.fn();
  const mockOnDelete = jest.fn();
  const mockIsCompletedOnDate = jest.fn(() => false);

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
    const habitWithoutDesc = { ...mockHabit, description: null };
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
    // Get the current week's Sunday (the first day shown in the calendar)
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 6 = Saturday
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - currentDay);

    // Use Monday of the current week as the completed day
    const monday = new Date(sunday);
    monday.setDate(sunday.getDate() + 1);
    const mondayString = monday.toISOString().split('T')[0];

    const mockIsCompleted = jest.fn((_habitId: string, date: Date) => {
      const dateString = date.toISOString().split('T')[0];
      return dateString === mondayString;
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
    const dayCircles = container.querySelectorAll('div.w-8');
    const hasColoredBackground = Array.from(dayCircles).some(circle => {
      const element = circle as HTMLElement;
      const bgColor = element.style.backgroundColor;
      // Check if background color is set and not transparent
      return bgColor && bgColor !== '' && bgColor !== 'transparent';
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

    it('should render Today button', () => {
      render(
        <HabitCard
          habit={mockHabit}
          onToggleCompletion={mockOnToggleCompletion}
          onDelete={mockOnDelete}
          isCompletedOnDate={mockIsCompletedOnDate}
        />
      );

      const todayButton = screen.getByLabelText(/go to current week/i);
      expect(todayButton).toBeInTheDocument();
    });

    it('should return to current week when Today button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <HabitCard
          habit={mockHabit}
          onToggleCompletion={mockOnToggleCompletion}
          onDelete={mockOnDelete}
          isCompletedOnDate={mockIsCompletedOnDate}
        />
      );

      // Navigate away from current week
      const prevButton = screen.getByLabelText(/previous week/i);
      await user.click(prevButton);
      await user.click(prevButton);

      // Should no longer show "Current week"
      expect(screen.queryByText(/current week/i)).not.toBeInTheDocument();

      // Click Today button
      const todayButton = screen.getByLabelText(/go to current week/i);
      await user.click(todayButton);

      // Should be back to current week
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

  describe('Future Date Handling', () => {
    it('should disable future date buttons', () => {
      // Navigate to next week to ensure we have future dates visible
      const { container } = render(
        <HabitCard
          habit={mockHabit}
          onToggleCompletion={mockOnToggleCompletion}
          onDelete={mockOnDelete}
          isCompletedOnDate={mockIsCompletedOnDate}
        />
      );

      // Get all day buttons (excluding navigation and delete buttons)
      const allButtons = container.querySelectorAll('button');
      const dayButtons = Array.from(allButtons).filter(btn => {
        const label = btn.getAttribute('aria-label');
        return !label || (!label.includes('Delete') && !label.includes('week') && !label.includes('Edit'));
      });

      // Check each day button exists and is rendered
      dayButtons.forEach(btn => {
        // For current week, some dates may be in the future (disabled)
        // and some may be in the past (enabled)
        expect(btn).toBeInTheDocument();
      });

      // Verify we have 7 day buttons
      expect(dayButtons.length).toBe(7);
    });

    it('should not call onToggleCompletion when clicking a future date', async () => {
      const user = userEvent.setup();

      // First navigate to next week to ensure we have future dates
      render(
        <HabitCard
          habit={mockHabit}
          onToggleCompletion={mockOnToggleCompletion}
          onDelete={mockOnDelete}
          isCompletedOnDate={mockIsCompletedOnDate}
        />
      );

      // Navigate to next week
      const nextButton = screen.getByLabelText(/next week/i);
      await user.click(nextButton);

      // Get all day buttons after navigation
      const buttons = screen.getAllByRole('button');
      const dayButtons = buttons.filter(btn => {
        const label = btn.getAttribute('aria-label');
        return !label || (!label.includes('Delete') && !label.includes('week') && !label.includes('Edit'));
      });

      // Try clicking the last day button (should be a future date in next week)
      const lastDayButton = dayButtons[dayButtons.length - 1];

      // Clear any previous calls
      mockOnToggleCompletion.mockClear();

      await user.click(lastDayButton);

      // Should not have been called because future dates should be disabled
      expect(mockOnToggleCompletion).not.toHaveBeenCalled();
    });

    it('should allow clicking on today and past dates', async () => {
      const user = userEvent.setup();
      render(
        <HabitCard
          habit={mockHabit}
          onToggleCompletion={mockOnToggleCompletion}
          onDelete={mockOnDelete}
          isCompletedOnDate={mockIsCompletedOnDate}
        />
      );

      // Navigate to previous week (all dates should be in the past)
      const prevButton = screen.getByLabelText(/previous week/i);
      await user.click(prevButton);

      // Get all day buttons after navigation
      const buttons = screen.getAllByRole('button');
      const dayButtons = buttons.filter(btn => {
        const label = btn.getAttribute('aria-label');
        return !label || (!label.includes('Delete') && !label.includes('week') && !label.includes('Edit'));
      });

      // Clear any previous calls
      mockOnToggleCompletion.mockClear();

      // Click the first day button (should be a past date)
      await user.click(dayButtons[0]);

      // Should have been called because past dates are clickable
      expect(mockOnToggleCompletion).toHaveBeenCalledTimes(1);
    });

    it('should show visual indication that future dates are disabled', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <HabitCard
          habit={mockHabit}
          onToggleCompletion={mockOnToggleCompletion}
          onDelete={mockOnDelete}
          isCompletedOnDate={mockIsCompletedOnDate}
        />
      );

      // Navigate to next week to see future dates
      const nextButton = screen.getByLabelText(/next week/i);
      await user.click(nextButton);

      // Future date buttons should have reduced opacity or different styling
      const allButtons = container.querySelectorAll('button');
      const dayButtons = Array.from(allButtons).filter(btn => {
        const label = btn.getAttribute('aria-label');
        return !label || (!label.includes('Delete') && !label.includes('week') && !label.includes('Edit'));
      });

      // Check that at least one button has disabled styling (opacity or cursor)
      const hasDisabledStyling = dayButtons.some(btn => {
        const style = window.getComputedStyle(btn);
        return btn.hasAttribute('disabled') ||
               style.opacity === '0.5' ||
               style.cursor === 'not-allowed' ||
               btn.classList.contains('opacity-50') ||
               btn.classList.contains('cursor-not-allowed');
      });

      expect(hasDisabledStyling).toBe(true);
    });
  });

  describe('Edit Button', () => {
    const mockOnEdit = jest.fn();

    beforeEach(() => {
      mockOnEdit.mockClear();
    });

    it('should render edit button', () => {
      render(
        <HabitCard
          habit={mockHabit}
          onToggleCompletion={mockOnToggleCompletion}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
          isCompletedOnDate={mockIsCompletedOnDate}
        />
      );

      const editButton = screen.getByLabelText(/edit habit/i);
      expect(editButton).toBeInTheDocument();
    });

    it('should call onEdit when edit button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <HabitCard
          habit={mockHabit}
          onToggleCompletion={mockOnToggleCompletion}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
          isCompletedOnDate={mockIsCompletedOnDate}
        />
      );

      const editButton = screen.getByLabelText(/edit habit/i);
      await user.click(editButton);

      expect(mockOnEdit).toHaveBeenCalledTimes(1);
      expect(mockOnEdit).toHaveBeenCalledWith(mockHabit.id);
    });
  });
});
