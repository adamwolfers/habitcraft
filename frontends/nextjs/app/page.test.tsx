import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Home from './page';
import * as useHabitsModule from '@/hooks/useHabits';
import { Habit } from '@/types/habit';

// Mock the useHabits hook
jest.mock('@/hooks/useHabits');

const mockUseHabits = useHabitsModule.useHabits as jest.MockedFunction<typeof useHabitsModule.useHabits>;

describe('Home Page - Delete Functionality', () => {
  const mockHabits: Habit[] = [
    {
      id: 'habit-1',
      userId: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Morning Exercise',
      description: '30 minutes of cardio',
      frequency: 'daily',
      targetDays: [],
      color: '#3B82F6',
      icon: '🏃',
      status: 'active',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z'
    },
    {
      id: 'habit-2',
      userId: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Read Books',
      description: 'Read for 30 minutes',
      frequency: 'weekly',
      targetDays: [1, 3, 5],
      color: '#FF5733',
      icon: '📚',
      status: 'active',
      createdAt: '2025-01-02T00:00:00.000Z',
      updatedAt: '2025-01-02T00:00:00.000Z'
    }
  ];

  const mockCreateHabit = jest.fn();
  const mockToggleCompletion = jest.fn();
  const mockIsHabitCompletedOnDate = jest.fn();
  const mockDeleteHabit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseHabits.mockReturnValue({
      habits: mockHabits,
      createHabit: mockCreateHabit,
      toggleCompletion: mockToggleCompletion,
      isHabitCompletedOnDate: mockIsHabitCompletedOnDate,
      deleteHabit: mockDeleteHabit,
    });
  });

  it('should call deleteHabit when delete button is clicked', async () => {
    const user = userEvent.setup();
    render(<Home />);

    // Wait for habits to render
    await waitFor(() => {
      expect(screen.getByText('Morning Exercise')).toBeInTheDocument();
    });

    // Find all delete buttons (there should be 2, one for each habit)
    const deleteButtons = screen.getAllByLabelText('Delete habit');
    expect(deleteButtons).toHaveLength(2);

    // Click the first delete button
    await user.click(deleteButtons[0]);

    // Verify deleteHabit was called with the correct habit ID
    expect(mockDeleteHabit).toHaveBeenCalledTimes(1);
    expect(mockDeleteHabit).toHaveBeenCalledWith('habit-1');
  });

  it('should call deleteHabit when second habit delete button is clicked', async () => {
    const user = userEvent.setup();
    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('Read Books')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByLabelText('Delete habit');

    // Click the second delete button
    await user.click(deleteButtons[1]);

    expect(mockDeleteHabit).toHaveBeenCalledTimes(1);
    expect(mockDeleteHabit).toHaveBeenCalledWith('habit-2');
  });

  it('should handle deleteHabit errors gracefully', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    mockDeleteHabit.mockRejectedValue(new Error('API Error'));

    const user = userEvent.setup();
    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('Morning Exercise')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByLabelText('Delete habit');

    // Click delete button
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockDeleteHabit).toHaveBeenCalledWith('habit-1');
    });

    consoleErrorSpy.mockRestore();
  });

  it('should display empty state when no habits exist', () => {
    mockUseHabits.mockReturnValue({
      habits: [],
      createHabit: mockCreateHabit,
      toggleCompletion: mockToggleCompletion,
      isHabitCompletedOnDate: mockIsHabitCompletedOnDate,
      deleteHabit: mockDeleteHabit,
    });

    render(<Home />);

    expect(screen.getByText('No habits yet. Add your first habit to get started!')).toBeInTheDocument();
  });

  it('should call createHabit when adding a new habit through the form', async () => {
    const user = userEvent.setup();
    mockCreateHabit.mockResolvedValue({
      id: 'new-habit',
      userId: '123e4567-e89b-12d3-a456-426614174000',
      name: 'New Habit',
      description: 'Test description',
      frequency: 'daily',
      targetDays: [],
      color: '#3b82f6',
      icon: '⭐',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    render(<Home />);

    // Open the add habit form
    await user.click(screen.getByText('+ Add New Habit'));

    // Fill in the form
    const nameInput = screen.getByLabelText(/habit name/i);
    await user.type(nameInput, 'New Habit');

    const descriptionInput = screen.getByLabelText(/description/i);
    await user.type(descriptionInput, 'Test description');

    // Submit the form
    await user.click(screen.getByText('Add Habit'));

    // Verify createHabit was called with correct data
    await waitFor(() => {
      expect(mockCreateHabit).toHaveBeenCalledWith({
        name: 'New Habit',
        description: 'Test description',
        color: '#3b82f6',
        frequency: 'daily',
      });
    });
  });
});
