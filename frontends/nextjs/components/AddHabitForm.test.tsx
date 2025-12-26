import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddHabitForm from './AddHabitForm';

describe('AddHabitForm', () => {
  const mockOnAdd = jest.fn();

  beforeEach(() => {
    mockOnAdd.mockClear();
  });

  it('should render add habit button initially', () => {
    render(<AddHabitForm onAdd={mockOnAdd} />);

    expect(screen.getByText('+ Add New Habit')).toBeInTheDocument();
  });

  it('should show form when add button is clicked', async () => {
    const user = userEvent.setup();
    render(<AddHabitForm onAdd={mockOnAdd} />);

    await user.click(screen.getByText('+ Add New Habit'));

    expect(screen.getByLabelText(/habit name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByText(/color/i)).toBeInTheDocument();
  });

  it('should call onAdd with correct data when form is submitted', async () => {
    const user = userEvent.setup();
    render(<AddHabitForm onAdd={mockOnAdd} />);

    // Open form
    await user.click(screen.getByText('+ Add New Habit'));

    // Fill in form
    const nameInput = screen.getByLabelText(/habit name/i);
    const descriptionInput = screen.getByLabelText(/description/i);

    await user.type(nameInput, 'Morning Run');
    await user.type(descriptionInput, '5km jog');

    // Submit form
    await user.click(screen.getByText('Add Habit'));

    expect(mockOnAdd).toHaveBeenCalledTimes(1);
    expect(mockOnAdd).toHaveBeenCalledWith({
      name: 'Morning Run',
      description: '5km jog',
      color: '#3b82f6', // Default color
      icon: '🏃', // Default icon
      frequency: 'daily',
    });
  });

  it('should not submit form with empty name', async () => {
    const user = userEvent.setup();
    render(<AddHabitForm onAdd={mockOnAdd} />);

    // Open form
    await user.click(screen.getByText('+ Add New Habit'));

    // Try to submit without filling name
    const submitButton = screen.getByText('Add Habit');
    await user.click(submitButton);

    expect(mockOnAdd).not.toHaveBeenCalled();
  });

  it('should trim whitespace from inputs', async () => {
    const user = userEvent.setup();
    render(<AddHabitForm onAdd={mockOnAdd} />);

    // Open form
    await user.click(screen.getByText('+ Add New Habit'));

    // Fill in form with extra whitespace
    const nameInput = screen.getByLabelText(/habit name/i);
    const descriptionInput = screen.getByLabelText(/description/i);

    await user.type(nameInput, '  Exercise  ');
    await user.type(descriptionInput, '  Workout  ');

    // Submit form
    await user.click(screen.getByText('Add Habit'));

    expect(mockOnAdd).toHaveBeenCalledWith({
      name: 'Exercise',
      description: 'Workout',
      color: '#3b82f6',
      icon: '🏃',
      frequency: 'daily',
    });
  });

  it('should allow selecting different colors', async () => {
    const user = userEvent.setup();
    render(<AddHabitForm onAdd={mockOnAdd} />);

    // Open form
    await user.click(screen.getByText('+ Add New Habit'));

    // Get all color buttons (there should be 8)
    const colorButtons = screen.getAllByRole('button').filter(button => {
      const style = window.getComputedStyle(button);
      return style.backgroundColor !== '';
    });

    // Select a different color (second button)
    if (colorButtons.length > 1) {
      await user.click(colorButtons[1]);
    }

    // Fill in name
    const nameInput = screen.getByLabelText(/habit name/i);
    await user.type(nameInput, 'Read');

    // Submit form
    await user.click(screen.getByText('Add Habit'));

    expect(mockOnAdd).toHaveBeenCalledWith({
      name: 'Read',
      description: '',
      color: '#10b981', // Second color in PRESET_COLORS
      icon: '🏃',
      frequency: 'daily',
    });
  });

  it('should reset form after successful submission', async () => {
    const user = userEvent.setup();
    render(<AddHabitForm onAdd={mockOnAdd} />);

    // Open form
    await user.click(screen.getByText('+ Add New Habit'));

    // Fill and submit form
    const nameInput = screen.getByLabelText(/habit name/i);
    await user.type(nameInput, 'Meditate');
    await user.click(screen.getByText('Add Habit'));

    // Form should close
    expect(screen.queryByLabelText(/habit name/i)).not.toBeInTheDocument();
    expect(screen.getByText('+ Add New Habit')).toBeInTheDocument();
  });

  it('should close form when cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<AddHabitForm onAdd={mockOnAdd} />);

    // Open form
    await user.click(screen.getByText('+ Add New Habit'));

    // Fill in form
    const nameInput = screen.getByLabelText(/habit name/i);
    await user.type(nameInput, 'Test');

    // Click cancel
    await user.click(screen.getByText('Cancel'));

    // Form should close
    expect(screen.queryByLabelText(/habit name/i)).not.toBeInTheDocument();
    expect(mockOnAdd).not.toHaveBeenCalled();
  });

  describe('Icon Picker', () => {
    it('should render icon picker when form is open', async () => {
      const user = userEvent.setup();
      render(<AddHabitForm onAdd={mockOnAdd} />);

      // Open form
      await user.click(screen.getByText('+ Add New Habit'));

      // Icon label should be visible
      expect(screen.getByText('Icon')).toBeInTheDocument();

      // Should have icon buttons (first icon is running emoji)
      expect(screen.getByTestId('icon-option-🏃')).toBeInTheDocument();
    });

    it('should render all preset icons', async () => {
      const user = userEvent.setup();
      render(<AddHabitForm onAdd={mockOnAdd} />);

      // Open form
      await user.click(screen.getByText('+ Add New Habit'));

      // Check for a sample of icons from each category
      expect(screen.getByTestId('icon-option-🏃')).toBeInTheDocument(); // Fitness
      expect(screen.getByTestId('icon-option-📚')).toBeInTheDocument(); // Learning
      expect(screen.getByTestId('icon-option-💧')).toBeInTheDocument(); // Hydration
      expect(screen.getByTestId('icon-option-🧘')).toBeInTheDocument(); // Meditation
    });

    it('should show default icon as selected', async () => {
      const user = userEvent.setup();
      render(<AddHabitForm onAdd={mockOnAdd} />);

      // Open form
      await user.click(screen.getByText('+ Add New Habit'));

      // First icon (🏃) should be selected by default
      const defaultIcon = screen.getByTestId('icon-option-🏃');
      expect(defaultIcon).toHaveClass('ring-2', 'ring-white', 'scale-110');
    });

    it('should allow selecting a different icon', async () => {
      const user = userEvent.setup();
      render(<AddHabitForm onAdd={mockOnAdd} />);

      // Open form
      await user.click(screen.getByText('+ Add New Habit'));

      // Click on a different icon
      const bookIcon = screen.getByTestId('icon-option-📚');
      await user.click(bookIcon);

      // Book icon should now be selected
      expect(bookIcon).toHaveClass('ring-2', 'ring-white', 'scale-110');

      // Running icon should no longer be selected
      const runIcon = screen.getByTestId('icon-option-🏃');
      expect(runIcon).not.toHaveClass('ring-2');
    });

    it('should include default icon in form submission', async () => {
      const user = userEvent.setup();
      render(<AddHabitForm onAdd={mockOnAdd} />);

      // Open form
      await user.click(screen.getByText('+ Add New Habit'));

      // Fill in name
      const nameInput = screen.getByLabelText(/habit name/i);
      await user.type(nameInput, 'Morning Run');

      // Submit form without changing icon
      await user.click(screen.getByText('Add Habit'));

      expect(mockOnAdd).toHaveBeenCalledWith({
        name: 'Morning Run',
        description: '',
        color: '#3b82f6',
        icon: '🏃', // Default icon
        frequency: 'daily',
      });
    });

    it('should include selected icon in form submission', async () => {
      const user = userEvent.setup();
      render(<AddHabitForm onAdd={mockOnAdd} />);

      // Open form
      await user.click(screen.getByText('+ Add New Habit'));

      // Fill in name
      const nameInput = screen.getByLabelText(/habit name/i);
      await user.type(nameInput, 'Read Books');

      // Select the book icon
      await user.click(screen.getByTestId('icon-option-📚'));

      // Submit form
      await user.click(screen.getByText('Add Habit'));

      expect(mockOnAdd).toHaveBeenCalledWith({
        name: 'Read Books',
        description: '',
        color: '#3b82f6',
        icon: '📚', // Selected icon
        frequency: 'daily',
      });
    });

    it('should reset icon to default after successful submission', async () => {
      const user = userEvent.setup();
      render(<AddHabitForm onAdd={mockOnAdd} />);

      // Open form
      await user.click(screen.getByText('+ Add New Habit'));

      // Select a different icon
      await user.click(screen.getByTestId('icon-option-📚'));

      // Fill in name and submit
      const nameInput = screen.getByLabelText(/habit name/i);
      await user.type(nameInput, 'Test Habit');
      await user.click(screen.getByText('Add Habit'));

      // Reopen form
      await user.click(screen.getByText('+ Add New Habit'));

      // Default icon should be selected again
      const defaultIcon = screen.getByTestId('icon-option-🏃');
      expect(defaultIcon).toHaveClass('ring-2', 'ring-white', 'scale-110');
    });
  });

  it('should allow submitting without description', async () => {
    const user = userEvent.setup();
    render(<AddHabitForm onAdd={mockOnAdd} />);

    // Open form
    await user.click(screen.getByText('+ Add New Habit'));

    // Fill only name
    const nameInput = screen.getByLabelText(/habit name/i);
    await user.type(nameInput, 'Walk');

    // Submit form
    await user.click(screen.getByText('Add Habit'));

    expect(mockOnAdd).toHaveBeenCalledWith({
      name: 'Walk',
      description: '',
      color: '#3b82f6',
      icon: '🏃',
      frequency: 'daily',
    });
  });

  it('should keep form open and log error when onAdd fails', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    const user = userEvent.setup();

    // Mock onAdd to throw an error
    const mockOnAddWithError = jest.fn().mockRejectedValue(new Error('API Error'));
    render(<AddHabitForm onAdd={mockOnAddWithError} />);

    // Open form
    await user.click(screen.getByText('+ Add New Habit'));

    // Fill in form
    const nameInput = screen.getByLabelText(/habit name/i);
    await user.type(nameInput, 'Test Habit');

    // Submit form
    await user.click(screen.getByText('Add Habit'));

    // Wait for async error handling
    await screen.findByLabelText(/habit name/i);

    // Verify error was logged
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error adding habit:', expect.any(Error));

    // Form should stay open so user can retry
    expect(screen.getByLabelText(/habit name/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test Habit')).toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });
});
