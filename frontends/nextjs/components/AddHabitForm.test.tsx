import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddHabitForm from './AddHabitForm';
import { HabitFormData } from '@/types/habit';

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
