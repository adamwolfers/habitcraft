import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EditHabitModal from './EditHabitModal';
import { Habit } from '@/types/habit';

describe('EditHabitModal', () => {
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

  const mockOnClose = jest.fn();
  const mockOnUpdate = jest.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnUpdate.mockClear();
  });

  describe('Modal Open/Close', () => {
    it('should not render when isOpen is false', () => {
      render(
        <EditHabitModal
          habit={mockHabit}
          isOpen={false}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      render(
        <EditHabitModal
          habit={mockHabit}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should display modal heading', () => {
      render(
        <EditHabitModal
          habit={mockHabit}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      expect(screen.getByText(/edit habit/i)).toBeInTheDocument();
    });

    it('should call onClose when cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <EditHabitModal
          habit={mockHabit}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when close button (X) is clicked', async () => {
      const user = userEvent.setup();
      render(
        <EditHabitModal
          habit={mockHabit}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const closeButton = screen.getByLabelText(/close/i);
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when clicking backdrop', async () => {
      const user = userEvent.setup();
      render(
        <EditHabitModal
          habit={mockHabit}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const backdrop = screen.getByTestId('modal-backdrop');
      await user.click(backdrop);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });
});
