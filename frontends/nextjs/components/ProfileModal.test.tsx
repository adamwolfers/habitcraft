import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfileModal from './ProfileModal';

describe('ProfileModal', () => {
  const mockUser = {
    id: '123',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: '2025-01-01T00:00:00.000Z',
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
        <ProfileModal
          user={mockUser}
          isOpen={false}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      render(
        <ProfileModal
          user={mockUser}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should display modal heading', () => {
      render(
        <ProfileModal
          user={mockUser}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      expect(screen.getByRole('heading', { name: /profile/i })).toBeInTheDocument();
    });

    it('should call onClose when cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <ProfileModal
          user={mockUser}
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
        <ProfileModal
          user={mockUser}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when clicking backdrop', async () => {
      const user = userEvent.setup();
      render(
        <ProfileModal
          user={mockUser}
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

  describe('User Info Display', () => {
    it('should display current user name', () => {
      render(
        <ProfileModal
          user={mockUser}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      expect(screen.getByText('Test User')).toBeInTheDocument();
    });

    it('should display current user email', () => {
      render(
        <ProfileModal
          user={mockUser}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });
  });

  describe('Name Field', () => {
    it('should render name input field', () => {
      render(
        <ProfileModal
          user={mockUser}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const nameInput = screen.getByLabelText(/name/i);
      expect(nameInput).toBeInTheDocument();
    });

    it('should populate name input with current user name', () => {
      render(
        <ProfileModal
          user={mockUser}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const nameInput = screen.getByLabelText(/name/i) as HTMLInputElement;
      expect(nameInput.value).toBe('Test User');
    });

    it('should allow user to edit the name', async () => {
      const user = userEvent.setup();
      render(
        <ProfileModal
          user={mockUser}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const nameInput = screen.getByLabelText(/name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'New Name');

      expect(nameInput).toHaveValue('New Name');
    });
  });

  describe('Email Field', () => {
    it('should render email input field', () => {
      render(
        <ProfileModal
          user={mockUser}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const emailInput = screen.getByLabelText(/email/i);
      expect(emailInput).toBeInTheDocument();
    });

    it('should populate email input with current user email', () => {
      render(
        <ProfileModal
          user={mockUser}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement;
      expect(emailInput.value).toBe('test@example.com');
    });

    it('should allow user to edit the email', async () => {
      const user = userEvent.setup();
      render(
        <ProfileModal
          user={mockUser}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const emailInput = screen.getByLabelText(/email/i);
      await user.clear(emailInput);
      await user.type(emailInput, 'newemail@example.com');

      expect(emailInput).toHaveValue('newemail@example.com');
    });
  });

  describe('Form Submission', () => {
    it('should call onUpdate with updated name when save is clicked', async () => {
      const user = userEvent.setup();
      mockOnUpdate.mockResolvedValue(undefined);
      render(
        <ProfileModal
          user={mockUser}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const nameInput = screen.getByLabelText(/name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Name');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith({
          name: 'Updated Name',
          email: 'test@example.com',
        });
      });
    });

    it('should call onUpdate with updated email when save is clicked', async () => {
      const user = userEvent.setup();
      mockOnUpdate.mockResolvedValue(undefined);
      render(
        <ProfileModal
          user={mockUser}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const emailInput = screen.getByLabelText(/email/i);
      await user.clear(emailInput);
      await user.type(emailInput, 'updated@example.com');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith({
          name: 'Test User',
          email: 'updated@example.com',
        });
      });
    });

    it('should close modal after successful save', async () => {
      const user = userEvent.setup();
      mockOnUpdate.mockResolvedValue(undefined);
      render(
        <ProfileModal
          user={mockUser}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const nameInput = screen.getByLabelText(/name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Name');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      });
    });

    it('should not call onUpdate when no changes are made', async () => {
      const user = userEvent.setup();
      render(
        <ProfileModal
          user={mockUser}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should just close without calling onUpdate
      expect(mockOnUpdate).not.toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Validation', () => {
    it('should disable save button when name is empty', async () => {
      const user = userEvent.setup();
      render(
        <ProfileModal
          user={mockUser}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const nameInput = screen.getByLabelText(/name/i);
      await user.clear(nameInput);

      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).toBeDisabled();
    });

    it('should disable save button when email is empty', async () => {
      const user = userEvent.setup();
      render(
        <ProfileModal
          user={mockUser}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const emailInput = screen.getByLabelText(/email/i);
      await user.clear(emailInput);

      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).toBeDisabled();
    });

    it('should disable save button for invalid email format', async () => {
      const user = userEvent.setup();
      render(
        <ProfileModal
          user={mockUser}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const emailInput = screen.getByLabelText(/email/i);
      await user.clear(emailInput);
      await user.type(emailInput, 'invalid-email');

      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).toBeDisabled();
    });
  });

  describe('Error Handling', () => {
    it('should display error message when save fails', async () => {
      const user = userEvent.setup();
      mockOnUpdate.mockRejectedValue(new Error('Email is already in use'));
      render(
        <ProfileModal
          user={mockUser}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const nameInput = screen.getByLabelText(/name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Name');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/email is already in use/i)).toBeInTheDocument();
      });
    });

    it('should keep modal open when save fails', async () => {
      const user = userEvent.setup();
      mockOnUpdate.mockRejectedValue(new Error('Update failed'));
      render(
        <ProfileModal
          user={mockUser}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const nameInput = screen.getByLabelText(/name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Name');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/update failed/i)).toBeInTheDocument();
      });

      expect(mockOnClose).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should clear error when user edits a field', async () => {
      const user = userEvent.setup();
      mockOnUpdate.mockRejectedValue(new Error('Update failed'));
      render(
        <ProfileModal
          user={mockUser}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      // Trigger error
      const nameInput = screen.getByLabelText(/name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'New Name');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/update failed/i)).toBeInTheDocument();
      });

      // Edit field should clear error
      await user.type(nameInput, ' Updated');

      expect(screen.queryByText(/update failed/i)).not.toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should disable save button while saving', async () => {
      const user = userEvent.setup();
      let resolveUpdate: () => void;
      const updatePromise = new Promise<void>((resolve) => {
        resolveUpdate = resolve;
      });
      mockOnUpdate.mockReturnValue(updatePromise);

      render(
        <ProfileModal
          user={mockUser}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const nameInput = screen.getByLabelText(/name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Name');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Button should be disabled during save
      expect(saveButton).toBeDisabled();

      // Resolve the save
      resolveUpdate!();
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should show saving text while saving', async () => {
      const user = userEvent.setup();
      let resolveUpdate: () => void;
      const updatePromise = new Promise<void>((resolve) => {
        resolveUpdate = resolve;
      });
      mockOnUpdate.mockReturnValue(updatePromise);

      render(
        <ProfileModal
          user={mockUser}
          isOpen={true}
          onClose={mockOnClose}
          onUpdate={mockOnUpdate}
        />
      );

      const nameInput = screen.getByLabelText(/name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Name');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should show saving text
      expect(screen.getByText(/saving/i)).toBeInTheDocument();

      // Resolve the save
      resolveUpdate!();
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });
  });
});
