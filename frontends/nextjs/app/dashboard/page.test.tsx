import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dashboard from './page';
import * as useHabitsModule from '@/hooks/useHabits';
import * as authContextModule from '@/context/AuthContext';
import * as habitUtilsModule from '@/utils/habitUtils';
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

// Mock the habitUtils module
jest.mock('@/utils/habitUtils', () => ({
  findHabitById: jest.fn(),
  detectHabitChanges: jest.fn().mockReturnValue(true),
  buildHabitUpdatePayload: jest.fn().mockImplementation((formValues, habit) => ({
    name: formValues.name.trim(),
    description: formValues.description.trim() || null,
    frequency: habit.frequency,
    color: formValues.color,
    icon: formValues.icon,
  })),
  PRESET_COLORS: [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
    '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
  ],
  PRESET_ICONS: [
    '🏃', '📚', '🧘', '💧', '🥗', '💪', '🎯', '✍️',
    '😴', '🚶', '🎨', '🎵', '🧹', '💻', '🌱', '🙏',
    '☕', '🚫', '📱', '🎮', '🧠', '💊', '🦷', '🌙',
  ],
}));

const mockFindHabitById = habitUtilsModule.findHabitById as jest.MockedFunction<typeof habitUtilsModule.findHabitById>;

const mockUseAuth = authContextModule.useAuth as jest.MockedFunction<typeof authContextModule.useAuth>;
const mockUseHabits = useHabitsModule.useHabits as jest.MockedFunction<typeof useHabitsModule.useHabits>;

describe('Dashboard Page - Delete Functionality', () => {
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

    // Default: findHabitById returns the habit that matches
    mockFindHabitById.mockImplementation((habits, id) =>
      habits.find(h => h.id === id)
    );

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
      isAuthLoading: false,
    });
  });

  it('should pass authenticated user ID to useHabits', () => {
    // Use a different user ID to verify page uses auth context, not hardcoded value
    mockUseAuth.mockReturnValue({
      user: {
        id: 'real-authenticated-user-id',
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

    render(<Dashboard />);

    expect(mockUseHabits).toHaveBeenCalledWith('real-authenticated-user-id');
  });

  it('should pass empty string to useHabits when user is null', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
    });

    render(<Dashboard />);

    expect(mockUseHabits).toHaveBeenCalledWith('');
  });

  it('should not open edit modal when editing non-existent habit', async () => {
    // Mock useHabits to track calls to internal functions
    const mockHabitsWithFind: Habit[] = [
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

    mockUseHabits.mockReturnValue({
      habits: mockHabitsWithFind,
      createHabit: mockCreateHabit,
      updateHabit: jest.fn(),
      toggleCompletion: mockToggleCompletion,
      isHabitCompletedOnDate: mockIsHabitCompletedOnDate,
      deleteHabit: mockDeleteHabit,
      isAuthLoading: false,
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Morning Exercise')).toBeInTheDocument();
    });

    // Modal should not be visible - no habit is being edited
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should not render edit modal when editingHabit is null', () => {
    render(<Dashboard />);

    // The modal should not be in the document when no habit is being edited
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Edit Habit')).not.toBeInTheDocument();
  });

  it('should log error and not open modal when habit is not found', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    const user = userEvent.setup();

    // Mock findHabitById to return undefined (habit not found)
    mockFindHabitById.mockReturnValue(undefined);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Morning Exercise')).toBeInTheDocument();
    });

    // Click edit button - findHabitById will return undefined
    const editButton = screen.getAllByLabelText('Edit habit')[0];
    await user.click(editButton);

    // Should log error
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Attempted to edit non-existent habit')
    );

    // Modal should NOT be open
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });

  it('should call deleteHabit when delete button is clicked', async () => {
    const user = userEvent.setup();
    render(<Dashboard />);

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
    render(<Dashboard />);

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
    render(<Dashboard />);

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
      isAuthLoading: false,
    });

    render(<Dashboard />);

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

    render(<Dashboard />);

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
        icon: '🏃',
        frequency: 'daily',
      });
    });
  });
});

describe('Dashboard Page - Edit Functionality', () => {
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
  const mockUpdateHabit = jest.fn();
  const mockToggleCompletion = jest.fn();
  const mockIsHabitCompletedOnDate = jest.fn();
  const mockDeleteHabit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Default: findHabitById returns the habit that matches
    mockFindHabitById.mockImplementation((habits, id) =>
      habits.find(h => h.id === id)
    );

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
      updateHabit: mockUpdateHabit,
      toggleCompletion: mockToggleCompletion,
      isHabitCompletedOnDate: mockIsHabitCompletedOnDate,
      deleteHabit: mockDeleteHabit,
      isAuthLoading: false,
    });
  });

  it('should render edit button for each habit', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Morning Exercise')).toBeInTheDocument();
    });

    const editButton = screen.getByLabelText('Edit habit');
    expect(editButton).toBeInTheDocument();
  });

  it('should open edit modal when edit button is clicked', async () => {
    const user = userEvent.setup();
    render(<Dashboard />);

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
    render(<Dashboard />);

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
    render(<Dashboard />);

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
    render(<Dashboard />);

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

  it('should call updateHabit when saving edits in modal', async () => {
    mockUpdateHabit.mockResolvedValue({
      ...mockHabits[0],
      name: 'Updated Exercise Name',
    });

    const user = userEvent.setup();
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Morning Exercise')).toBeInTheDocument();
    });

    // Open the edit modal
    const editButton = screen.getByLabelText('Edit habit');
    await user.click(editButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Clear and update the habit name
    const nameInput = screen.getByLabelText(/habit name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Exercise Name');

    // Submit the form
    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    // Verify updateHabit was called with correct arguments
    await waitFor(() => {
      expect(mockUpdateHabit).toHaveBeenCalledWith('habit-1', expect.objectContaining({
        name: 'Updated Exercise Name',
      }));
    });

    // Modal should close after successful update
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('should close modal after successful update', async () => {
    mockUpdateHabit.mockResolvedValue({
      ...mockHabits[0],
      description: 'New description',
    });

    const user = userEvent.setup();
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Morning Exercise')).toBeInTheDocument();
    });

    // Open the edit modal
    const editButton = screen.getByLabelText('Edit habit');
    await user.click(editButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Update description
    const descriptionInput = screen.getByLabelText(/description/i);
    await user.clear(descriptionInput);
    await user.type(descriptionInput, 'New description');

    // Submit the form
    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    // Modal should close
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
