'use client';

import { useState } from 'react';
import { Habit } from '@/types/habit';
import {
  PRESET_COLORS,
  PRESET_ICONS,
  detectHabitChanges,
  buildHabitUpdatePayload,
} from '@/utils/habitUtils';

interface EditHabitModalProps {
  habit: Habit;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (habitId: string, updates: Partial<Habit>) => Promise<void>;
}

export default function EditHabitModal({ habit, isOpen, onClose, onUpdate }: EditHabitModalProps) {
  const [name, setName] = useState(habit.name);
  const [description, setDescription] = useState(habit.description || '');
  const [color, setColor] = useState(habit.color);
  const [icon, setIcon] = useState(habit.icon);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

  // Clear error and close modal - ensures next open starts fresh
  const handleClose = () => {
    setError(null);
    onClose();
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Don't submit if name is empty (though HTML5 validation should prevent this)
    if (!name.trim()) {
      return;
    }

    const formValues = { name, description, color, icon };

    if (detectHabitChanges(formValues, habit)) {
      try {
        const payload = buildHabitUpdatePayload(formValues, habit);
        await onUpdate(habit.id, payload);
      } catch (err) {
        // Handle error - extract message from Error object or use generic message
        const errorMessage = err instanceof Error ? err.message : 'Failed to update habit';
        setError(errorMessage);
      }
    } else {
      // Just close the modal if nothing changed
      handleClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      data-testid="modal-backdrop"
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
            onClick={handleClose}
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
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
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
                onChange={(e) => {
                  setDescription(e.target.value);
                  setError(null);
                }}
                rows={3}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Optional description"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Color</label>
              <div className="flex gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    data-testid={`color-option-${c}`}
                    onClick={() => {
                      setColor(c);
                      setError(null);
                    }}
                    className={`w-8 h-8 rounded-full transition-transform ${
                      color === c ? 'ring-2 ring-white scale-110' : ''
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Icon</label>
              <div className="inline-grid grid-cols-8 gap-2">
                {PRESET_ICONS.map((i) => (
                  <button
                    key={i}
                    type="button"
                    data-testid={`icon-option-${i}`}
                    onClick={() => {
                      setIcon(i);
                      setError(null);
                    }}
                    className={`w-10 h-10 rounded-lg bg-gray-700 hover:bg-gray-600 transition-all text-xl flex items-center justify-center ${
                      icon === i ? 'ring-2 ring-white scale-110' : ''
                    }`}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-4 p-3 bg-red-500/10 border border-red-500 text-red-500 rounded-lg text-sm"
            >
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={handleClose}
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
