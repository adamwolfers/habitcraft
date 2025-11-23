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

  describe('Title Field', () => {
    it('should render title input field', () => {
      render(
        <EditHabitModal
          habit={mockHabit}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const titleInput = screen.getByLabelText(/habit name/i);
      expect(titleInput).toBeInTheDocument();
    });

    it('should populate title input with current habit name', () => {
      render(
        <EditHabitModal
          habit={mockHabit}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const titleInput = screen.getByLabelText(/habit name/i) as HTMLInputElement;
      expect(titleInput.value).toBe('Exercise');
    });

    it('should allow user to edit the title', async () => {
      const user = userEvent.setup();
      render(
        <EditHabitModal
          habit={mockHabit}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const titleInput = screen.getByLabelText(/habit name/i);
      await user.clear(titleInput);
      await user.type(titleInput, 'Morning Run');

      expect(titleInput).toHaveValue('Morning Run');
    });

    it('should mark title field as required', () => {
      render(
        <EditHabitModal
          habit={mockHabit}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const titleInput = screen.getByLabelText(/habit name/i);
      expect(titleInput).toBeRequired();
    });

    it('should not allow empty title', async () => {
      const user = userEvent.setup();
      render(
        <EditHabitModal
          habit={mockHabit}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const titleInput = screen.getByLabelText(/habit name/i);
      await user.clear(titleInput);

      expect(titleInput).toHaveValue('');
      expect(titleInput).toBeInvalid();
    });
  });

  describe('Title Update Submission', () => {
    it('should render save button', () => {
      render(
        <EditHabitModal
          habit={mockHabit}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).toBeInTheDocument();
    });

    it('should call onUpdate with new title when save is clicked', async () => {
      const user = userEvent.setup();
      render(
        <EditHabitModal
          habit={mockHabit}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const titleInput = screen.getByLabelText(/habit name/i);
      await user.clear(titleInput);
      await user.type(titleInput, 'Morning Run');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(mockOnUpdate).toHaveBeenCalledTimes(1);
      expect(mockOnUpdate).toHaveBeenCalledWith('1', {
        name: 'Morning Run',
        description: '30 minutes workout',
        frequency: 'daily',
        color: '#3b82f6',
      });
    });

    it('should not call onUpdate if title is unchanged', async () => {
      const user = userEvent.setup();
      render(
        <EditHabitModal
          habit={mockHabit}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should close modal without calling onUpdate since nothing changed
      expect(mockOnUpdate).not.toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not submit when title is empty', async () => {
      const user = userEvent.setup();
      render(
        <EditHabitModal
          habit={mockHabit}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const titleInput = screen.getByLabelText(/habit name/i);
      await user.clear(titleInput);

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should not call onUpdate or onClose
      expect(mockOnUpdate).not.toHaveBeenCalled();
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should trim whitespace from title before submitting', async () => {
      const user = userEvent.setup();
      render(
        <EditHabitModal
          habit={mockHabit}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const titleInput = screen.getByLabelText(/habit name/i);
      await user.clear(titleInput);
      await user.type(titleInput, '  Morning Run  ');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(mockOnUpdate).toHaveBeenCalledWith('1', {
        name: 'Morning Run',
        description: '30 minutes workout',
        frequency: 'daily',
        color: '#3b82f6',
      });
    });
  });

  describe('Description Field', () => {
    it('should render description textarea field', () => {
      render(
        <EditHabitModal
          habit={mockHabit}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const descriptionTextarea = screen.getByLabelText(/description/i);
      expect(descriptionTextarea).toBeInTheDocument();
    });

    it('should populate description textarea with current habit description', () => {
      render(
        <EditHabitModal
          habit={mockHabit}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const descriptionTextarea = screen.getByLabelText(/description/i) as HTMLTextAreaElement;
      expect(descriptionTextarea.value).toBe('30 minutes workout');
    });

    it('should allow user to edit the description', async () => {
      const user = userEvent.setup();
      render(
        <EditHabitModal
          habit={mockHabit}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const descriptionTextarea = screen.getByLabelText(/description/i);
      await user.clear(descriptionTextarea);
      await user.type(descriptionTextarea, 'New workout routine');

      expect(descriptionTextarea).toHaveValue('New workout routine');
    });

    it('should not mark description field as required', () => {
      render(
        <EditHabitModal
          habit={mockHabit}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const descriptionTextarea = screen.getByLabelText(/description/i);
      expect(descriptionTextarea).not.toBeRequired();
    });

    it('should handle empty description', () => {
      const habitWithoutDesc = { ...mockHabit, description: null };
      render(
        <EditHabitModal
          habit={habitWithoutDesc}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const descriptionTextarea = screen.getByLabelText(/description/i) as HTMLTextAreaElement;
      expect(descriptionTextarea.value).toBe('');
    });
  });

  describe('Description Update Submission', () => {
    it('should include updated description when save is clicked', async () => {
      const user = userEvent.setup();
      render(
        <EditHabitModal
          habit={mockHabit}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const descriptionTextarea = screen.getByLabelText(/description/i);
      await user.clear(descriptionTextarea);
      await user.type(descriptionTextarea, 'Updated workout description');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(mockOnUpdate).toHaveBeenCalledTimes(1);
      expect(mockOnUpdate).toHaveBeenCalledWith('1', expect.objectContaining({
        description: 'Updated workout description',
      }));
    });

    it('should update both title and description together', async () => {
      const user = userEvent.setup();
      render(
        <EditHabitModal
          habit={mockHabit}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const titleInput = screen.getByLabelText(/habit name/i);
      await user.clear(titleInput);
      await user.type(titleInput, 'Morning Run');

      const descriptionTextarea = screen.getByLabelText(/description/i);
      await user.clear(descriptionTextarea);
      await user.type(descriptionTextarea, 'Updated description');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(mockOnUpdate).toHaveBeenCalledWith('1', {
        name: 'Morning Run',
        description: 'Updated description',
        frequency: 'daily',
        color: '#3b82f6',
      });
    });

    it('should trim whitespace from description before submitting', async () => {
      const user = userEvent.setup();
      render(
        <EditHabitModal
          habit={mockHabit}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const descriptionTextarea = screen.getByLabelText(/description/i);
      await user.clear(descriptionTextarea);
      await user.type(descriptionTextarea, '  Updated description  ');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(mockOnUpdate).toHaveBeenCalledWith('1', expect.objectContaining({
        description: 'Updated description',
      }));
    });

    it('should allow clearing description', async () => {
      const user = userEvent.setup();
      render(
        <EditHabitModal
          habit={mockHabit}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const descriptionTextarea = screen.getByLabelText(/description/i);
      await user.clear(descriptionTextarea);

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(mockOnUpdate).toHaveBeenCalledWith('1', expect.objectContaining({
        description: null,
      }));
    });
  });
});
