'use client';

import { useState } from 'react';
import { Habit } from '@/types/habit';

interface EditHabitModalProps {
  habit: Habit;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (habitId: string, updates: Partial<Habit>) => Promise<void>;
}

export default function EditHabitModal({ habit, isOpen, onClose, onUpdate }: EditHabitModalProps) {
  const [name, setName] = useState(habit.name);
  const [description, setDescription] = useState(habit.description || '');

  if (!isOpen) {
    return null;
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only close if clicking the backdrop itself, not its children
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedDescription = description.trim();

    // Don't submit if name is empty (though HTML5 validation should prevent this)
    if (!trimmedName) {
      return;
    }

    // Check if anything has changed
    const nameChanged = trimmedName !== habit.name;
    const descriptionChanged = trimmedDescription !== (habit.description || '');

    if (nameChanged || descriptionChanged) {
      // Send all required fields along with the updates
      await onUpdate(habit.id, {
        name: trimmedName,
        description: trimmedDescription || null, // Convert empty string to null
        frequency: habit.frequency,
        color: habit.color,
      });
    } else {
      // Just close the modal if nothing changed
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      data-testid="modal-backdrop"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-gray-800 rounded-lg p-6 w-full max-w-md"
        role="dialog"
        aria-labelledby="modal-title"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="modal-title" className="text-xl font-semibold">
            Edit Habit
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="habit-name" className="block text-sm font-medium mb-2">
                Habit Name
              </label>
              <input
                id="habit-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="habit-description" className="block text-sm font-medium mb-2">
                Description
              </label>
              <textarea
                id="habit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Optional description"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
