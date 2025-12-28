import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EditHabitModal from './EditHabitModal';
import { Habit } from '@/types/habit';
import { PRESET_COLORS, PRESET_ICONS } from '@/utils/habitUtils';

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

    it('should NOT close when clicking backdrop', async () => {
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

      expect(mockOnClose).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
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
        icon: '🏃',
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
        icon: '🏃',
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
        icon: '🏃',
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

  describe('Color Picker', () => {
    it('should render color picker label', () => {
      render(
        <EditHabitModal
          habit={mockHabit}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      expect(screen.getByText(/color/i)).toBeInTheDocument();
    });

    it('should render 8 preset color options', () => {
      render(
        <EditHabitModal
          habit={mockHabit}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const colorButtons = screen.getAllByTestId(/color-option-/);
      expect(colorButtons).toHaveLength(PRESET_COLORS.length);
    });

    it('should highlight the current habit color', () => {
      render(
        <EditHabitModal
          habit={mockHabit}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const selectedColorButton = screen.getByTestId('color-option-#3b82f6');
      expect(selectedColorButton).toHaveClass('ring-2');
      expect(selectedColorButton).toHaveClass('scale-110');
    });

    it('should allow user to select a different color', async () => {
      const user = userEvent.setup();
      render(
        <EditHabitModal
          habit={mockHabit}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const greenColorButton = screen.getByTestId('color-option-#10b981');
      await user.click(greenColorButton);

      // Green should now be selected
      expect(greenColorButton).toHaveClass('ring-2');
      expect(greenColorButton).toHaveClass('scale-110');

      // Original blue should no longer be selected
      const blueColorButton = screen.getByTestId('color-option-#3b82f6');
      expect(blueColorButton).not.toHaveClass('ring-2');
      expect(blueColorButton).not.toHaveClass('scale-110');
    });
  });

  describe('Color Update Submission', () => {
    it('should call onUpdate with new color when save is clicked', async () => {
      const user = userEvent.setup();
      render(
        <EditHabitModal
          habit={mockHabit}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const greenColorButton = screen.getByTestId('color-option-#10b981');
      await user.click(greenColorButton);

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(mockOnUpdate).toHaveBeenCalledTimes(1);
      expect(mockOnUpdate).toHaveBeenCalledWith('1', {
        name: 'Exercise',
        description: '30 minutes workout',
        frequency: 'daily',
        color: '#10b981',
        icon: '🏃',
      });
    });

    it('should not call onUpdate if color is unchanged', async () => {
      const user = userEvent.setup();
      render(
        <EditHabitModal
          habit={mockHabit}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      // Click the same color that's already selected
      const blueColorButton = screen.getByTestId('color-option-#3b82f6');
      await user.click(blueColorButton);

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should close modal without calling onUpdate since nothing changed
      expect(mockOnUpdate).not.toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should update color along with other fields', async () => {
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

      const greenColorButton = screen.getByTestId('color-option-#10b981');
      await user.click(greenColorButton);

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(mockOnUpdate).toHaveBeenCalledWith('1', {
        name: 'Morning Run',
        description: '30 minutes workout',
        frequency: 'daily',
        color: '#10b981',
        icon: '🏃',
      });
    });
  });

  describe('Icon Selector', () => {
    it('should render icon selector label', () => {
      render(
        <EditHabitModal
          habit={mockHabit}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      expect(screen.getByText(/icon/i)).toBeInTheDocument();
    });

    it('should render 24 preset icon options', () => {
      render(
        <EditHabitModal
          habit={mockHabit}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const iconButtons = screen.getAllByTestId(/icon-option-/);
      expect(iconButtons).toHaveLength(PRESET_ICONS.length);
    });

    it('should highlight the current habit icon', () => {
      render(
        <EditHabitModal
          habit={mockHabit}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const selectedIconButton = screen.getByTestId('icon-option-🏃');
      expect(selectedIconButton).toHaveClass('ring-2');
      expect(selectedIconButton).toHaveClass('scale-110');
    });

    it('should allow user to select a different icon', async () => {
      const user = userEvent.setup();
      render(
        <EditHabitModal
          habit={mockHabit}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const bookIconButton = screen.getByTestId('icon-option-📚');
      await user.click(bookIconButton);

      // Book icon should now be selected
      expect(bookIconButton).toHaveClass('ring-2');
      expect(bookIconButton).toHaveClass('scale-110');

      // Original running icon should no longer be selected
      const runningIconButton = screen.getByTestId('icon-option-🏃');
      expect(runningIconButton).not.toHaveClass('ring-2');
      expect(runningIconButton).not.toHaveClass('scale-110');
    });

    it('should display emoji icons as text content', () => {
      render(
        <EditHabitModal
          habit={mockHabit}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const runningIconButton = screen.getByTestId('icon-option-🏃');
      expect(runningIconButton).toHaveTextContent('🏃');
    });
  });

  describe('Icon Update Submission', () => {
    it('should call onUpdate with new icon when save is clicked', async () => {
      const user = userEvent.setup();
      render(
        <EditHabitModal
          habit={mockHabit}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const bookIconButton = screen.getByTestId('icon-option-📚');
      await user.click(bookIconButton);

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(mockOnUpdate).toHaveBeenCalledTimes(1);
      expect(mockOnUpdate).toHaveBeenCalledWith('1', {
        name: 'Exercise',
        description: '30 minutes workout',
        frequency: 'daily',
        color: '#3b82f6',
        icon: '📚',
      });
    });

    it('should not call onUpdate if icon is unchanged', async () => {
      const user = userEvent.setup();
      render(
        <EditHabitModal
          habit={mockHabit}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      // Click the same icon that's already selected
      const runningIconButton = screen.getByTestId('icon-option-🏃');
      await user.click(runningIconButton);

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should close modal without calling onUpdate since nothing changed
      expect(mockOnUpdate).not.toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should update icon along with other fields', async () => {
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
      await user.type(titleInput, 'Reading Time');

      const bookIconButton = screen.getByTestId('icon-option-📚');
      await user.click(bookIconButton);

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(mockOnUpdate).toHaveBeenCalledWith('1', {
        name: 'Reading Time',
        description: '30 minutes workout',
        frequency: 'daily',
        color: '#3b82f6',
        icon: '📚',
      });
    });

    it('should update color and icon together', async () => {
      const user = userEvent.setup();
      render(
        <EditHabitModal
          habit={mockHabit}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const greenColorButton = screen.getByTestId('color-option-#10b981');
      await user.click(greenColorButton);

      const bookIconButton = screen.getByTestId('icon-option-📚');
      await user.click(bookIconButton);

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(mockOnUpdate).toHaveBeenCalledWith('1', {
        name: 'Exercise',
        description: '30 minutes workout',
        frequency: 'daily',
        color: '#10b981',
        icon: '📚',
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error when onUpdate fails', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Failed to update habit';
      mockOnUpdate.mockRejectedValue(new Error(errorMessage));

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
      await user.type(titleInput, 'New Habit Name');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent(errorMessage);
    });

    it('should display generic error message for non-Error exceptions', async () => {
      const user = userEvent.setup();
      mockOnUpdate.mockRejectedValue('Something went wrong');

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
      await user.type(titleInput, 'New Habit Name');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to update habit');
    });

    it('should clear error when user changes title', async () => {
      const user = userEvent.setup();
      mockOnUpdate.mockRejectedValue(new Error('Failed to update habit'));

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
      await user.type(titleInput, 'New Habit Name');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(await screen.findByRole('alert')).toBeInTheDocument();

      // Type in the title input to clear the error
      await user.type(titleInput, 'X');

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should clear error when user changes description', async () => {
      const user = userEvent.setup();
      mockOnUpdate.mockRejectedValue(new Error('Failed to update habit'));

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
      await user.type(titleInput, 'New Habit Name');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(await screen.findByRole('alert')).toBeInTheDocument();

      // Type in the description to clear the error
      const descriptionTextarea = screen.getByLabelText(/description/i);
      await user.type(descriptionTextarea, 'X');

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should clear error when user changes color', async () => {
      const user = userEvent.setup();
      mockOnUpdate.mockRejectedValue(new Error('Failed to update habit'));

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
      await user.type(titleInput, 'New Habit Name');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(await screen.findByRole('alert')).toBeInTheDocument();

      // Click a different color to clear the error
      const greenColorButton = screen.getByTestId('color-option-#10b981');
      await user.click(greenColorButton);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should clear error when user changes icon', async () => {
      const user = userEvent.setup();
      mockOnUpdate.mockRejectedValue(new Error('Failed to update habit'));

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
      await user.type(titleInput, 'New Habit Name');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(await screen.findByRole('alert')).toBeInTheDocument();

      // Click a different icon to clear the error
      const bookIconButton = screen.getByTestId('icon-option-📚');
      await user.click(bookIconButton);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should not close modal when onUpdate fails', async () => {
      const user = userEvent.setup();
      mockOnUpdate.mockRejectedValue(new Error('Failed to update habit'));

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
      await user.type(titleInput, 'New Habit Name');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await screen.findByRole('alert');

      expect(mockOnClose).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should have fresh state when remounted (simulating parent conditional render)', async () => {
      const user = userEvent.setup();
      mockOnUpdate.mockRejectedValue(new Error('Failed to update habit'));

      // In the real app, parent uses: {editingHabit && <EditHabitModal />}
      // This means the component unmounts when closed and remounts fresh when opened.
      // We simulate this with a key change, which forces React to remount.
      const { rerender } = render(
        <EditHabitModal
          key="session-1"
          habit={mockHabit}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const titleInput = screen.getByLabelText(/habit name/i);
      await user.clear(titleInput);
      await user.type(titleInput, 'New Habit Name');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(await screen.findByRole('alert')).toBeInTheDocument();

      // Simulate close and reopen by remounting with a new key
      // This matches real behavior where parent unmounts/remounts the component
      rerender(
        <EditHabitModal
          key="session-2"
          habit={mockHabit}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
