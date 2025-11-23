import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Home from './page';
import * as useHabitsModule from '@/hooks/useHabits';
import * as authContextModule from '@/context/AuthContext';
import { Habit } from '@/types/habit';

// Mock Next.js navigation
const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}));

// Mock the useAuth hook
jest.mock('@/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

// Mock the useHabits hook
jest.mock('@/hooks/useHabits');

const mockUseAuth = authContextModule.useAuth as jest.MockedFunction<typeof authContextModule.useAuth>;
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

    // Mock authenticated user
    mockUseAuth.mockReturnValue({
      user: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: '2025-01-01T00:00:00.000Z',
      },
      isLoading: false,
      isAuthenticated: true,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
    });

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

describe('Home Page - Edit Functionality', () => {
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
    }
  ];

  const mockCreateHabit = jest.fn();
  const mockToggleCompletion = jest.fn();
  const mockIsHabitCompletedOnDate = jest.fn();
  const mockDeleteHabit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseAuth.mockReturnValue({
      user: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: '2025-01-01T00:00:00.000Z',
      },
      isLoading: false,
      isAuthenticated: true,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
    });

    mockUseHabits.mockReturnValue({
      habits: mockHabits,
      createHabit: mockCreateHabit,
      toggleCompletion: mockToggleCompletion,
      isHabitCompletedOnDate: mockIsHabitCompletedOnDate,
      deleteHabit: mockDeleteHabit,
    });
  });

  it('should render edit button for each habit', async () => {
    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('Morning Exercise')).toBeInTheDocument();
    });

    const editButton = screen.getByLabelText('Edit habit');
    expect(editButton).toBeInTheDocument();
  });

  it('should open edit modal when edit button is clicked', async () => {
    const user = userEvent.setup();
    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('Morning Exercise')).toBeInTheDocument();
    });

    // Modal should not be visible initially
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Click edit button
    const editButton = screen.getByLabelText('Edit habit');
    await user.click(editButton);

    // Modal should now be visible
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    expect(screen.getByText('Edit Habit')).toBeInTheDocument();
  });

  it('should display the correct habit in the modal', async () => {
    const user = userEvent.setup();
    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('Morning Exercise')).toBeInTheDocument();
    });

    const editButton = screen.getByLabelText('Edit habit');
    await user.click(editButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Should display habit name in the input field
    const titleInput = screen.getByLabelText(/habit name/i) as HTMLInputElement;
    expect(titleInput.value).toBe('Morning Exercise');
  });

  it('should close modal when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('Morning Exercise')).toBeInTheDocument();
    });

    // Open modal
    const editButton = screen.getByLabelText('Edit habit');
    await user.click(editButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Close modal
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('should close modal when close button (X) is clicked', async () => {
    const user = userEvent.setup();
    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('Morning Exercise')).toBeInTheDocument();
    });

    // Open modal
    const editButton = screen.getByLabelText('Edit habit');
    await user.click(editButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Close modal using X button
    const closeButton = screen.getByLabelText(/close/i);
    await user.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
