import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CompletionNoteModal from './CompletionNoteModal';

describe('CompletionNoteModal', () => {
  const mockOnSave = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    mockOnSave.mockClear();
    mockOnClose.mockClear();
  });

  describe('Modal Structure', () => {
    it('should render modal with habit name and date in header', () => {
      render(
        <CompletionNoteModal
          habitName="Exercise"
          date="2025-12-25"
          existingNote={null}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Exercise')).toBeInTheDocument();
      expect(screen.getByText(/Dec 25, 2025/)).toBeInTheDocument();
    });

    it('should render textarea for note input', () => {
      render(
        <CompletionNoteModal
          habitName="Exercise"
          date="2025-12-25"
          existingNote={null}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/add a note/i)).toBeInTheDocument();
    });

    it('should render Save and Cancel buttons', () => {
      render(
        <CompletionNoteModal
          habitName="Exercise"
          date="2025-12-25"
          existingNote={null}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });
  });

  describe('Existing Note', () => {
    it('should populate textarea with existing note when provided', () => {
      render(
        <CompletionNoteModal
          habitName="Exercise"
          date="2025-12-25"
          existingNote="Ran 3 miles in the park"
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('textbox')).toHaveValue('Ran 3 miles in the park');
    });

    it('should render Delete Note button when existing note is provided', () => {
      render(
        <CompletionNoteModal
          habitName="Exercise"
          date="2025-12-25"
          existingNote="Ran 3 miles in the park"
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('button', { name: /delete note/i })).toBeInTheDocument();
    });

    it('should not render Delete Note button when no existing note', () => {
      render(
        <CompletionNoteModal
          habitName="Exercise"
          date="2025-12-25"
          existingNote={null}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByRole('button', { name: /delete note/i })).not.toBeInTheDocument();
    });
  });

  describe('Save Functionality', () => {
    it('should call onSave with note text when Save is clicked', async () => {
      const user = userEvent.setup();
      render(
        <CompletionNoteModal
          habitName="Exercise"
          date="2025-12-25"
          existingNote={null}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Ran 5 miles today');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(mockOnSave).toHaveBeenCalledTimes(1);
      expect(mockOnSave).toHaveBeenCalledWith('Ran 5 miles today');
    });

    it('should disable Save button when note is empty for new notes', () => {
      render(
        <CompletionNoteModal
          habitName="Exercise"
          date="2025-12-25"
          existingNote={null}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).toBeDisabled();
    });

    it('should enable Save button when note has content', async () => {
      const user = userEvent.setup();
      render(
        <CompletionNoteModal
          habitName="Exercise"
          date="2025-12-25"
          existingNote={null}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Some note');

      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).not.toBeDisabled();
    });

    it('should trim whitespace from note before saving', async () => {
      const user = userEvent.setup();
      render(
        <CompletionNoteModal
          habitName="Exercise"
          date="2025-12-25"
          existingNote={null}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '  Ran 5 miles today  ');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(mockOnSave).toHaveBeenCalledWith('Ran 5 miles today');
    });

    it('should allow saving changes to existing note', async () => {
      const user = userEvent.setup();
      render(
        <CompletionNoteModal
          habitName="Exercise"
          date="2025-12-25"
          existingNote="Original note"
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const textarea = screen.getByRole('textbox');
      await user.clear(textarea);
      await user.type(textarea, 'Updated note');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(mockOnSave).toHaveBeenCalledWith('Updated note');
    });
  });

  describe('Cancel Functionality', () => {
    it('should call onClose when Cancel is clicked', async () => {
      const user = userEvent.setup();
      render(
        <CompletionNoteModal
          habitName="Exercise"
          date="2025-12-25"
          existingNote={null}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when close button (X) is clicked', async () => {
      const user = userEvent.setup();
      render(
        <CompletionNoteModal
          habitName="Exercise"
          date="2025-12-25"
          existingNote={null}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const closeButton = screen.getByLabelText(/close/i);
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should NOT close when clicking backdrop', async () => {
      const user = userEvent.setup();
      render(
        <CompletionNoteModal
          habitName="Exercise"
          date="2025-12-25"
          existingNote={null}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const backdrop = screen.getByTestId('modal-backdrop');
      await user.click(backdrop);

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Delete Note Functionality', () => {
    it('should call onSave with null when Delete Note is clicked', async () => {
      const user = userEvent.setup();
      render(
        <CompletionNoteModal
          habitName="Exercise"
          date="2025-12-25"
          existingNote="Existing note content"
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const deleteButton = screen.getByRole('button', { name: /delete note/i });
      await user.click(deleteButton);

      expect(mockOnSave).toHaveBeenCalledTimes(1);
      expect(mockOnSave).toHaveBeenCalledWith(null);
    });
  });

  describe('Character Limit', () => {
    it('should display character count', () => {
      render(
        <CompletionNoteModal
          habitName="Exercise"
          date="2025-12-25"
          existingNote={null}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('0/500')).toBeInTheDocument();
    });

    it('should update character count as user types', async () => {
      const user = userEvent.setup();
      render(
        <CompletionNoteModal
          habitName="Exercise"
          date="2025-12-25"
          existingNote={null}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Hello');

      expect(screen.getByText('5/500')).toBeInTheDocument();
    });

    it('should show existing note character count', () => {
      render(
        <CompletionNoteModal
          habitName="Exercise"
          date="2025-12-25"
          existingNote="Ran 3 miles"
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('11/500')).toBeInTheDocument();
    });

    it('should limit note to 500 characters', async () => {
      const user = userEvent.setup();
      render(
        <CompletionNoteModal
          habitName="Exercise"
          date="2025-12-25"
          existingNote={null}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('maxLength', '500');
    });

    it('should show warning style when approaching limit', async () => {
      const longNote = 'a'.repeat(480);
      render(
        <CompletionNoteModal
          habitName="Exercise"
          date="2025-12-25"
          existingNote={longNote}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const charCount = screen.getByText('480/500');
      expect(charCount).toHaveClass('text-yellow-500');
    });

    it('should show error style when at limit', () => {
      const maxNote = 'a'.repeat(500);
      render(
        <CompletionNoteModal
          habitName="Exercise"
          date="2025-12-25"
          existingNote={maxNote}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const charCount = screen.getByText('500/500');
      expect(charCount).toHaveClass('text-red-500');
    });
  });
});
