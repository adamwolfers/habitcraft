'use client';

import { useState } from 'react';
import { HabitFormData } from '@/types/habit';
import { PRESET_COLORS, PRESET_ICONS } from '@/utils/habitUtils';
import { getDefaultHabitFormValues } from '@/utils/formUtils';

interface AddHabitFormProps {
  onAdd: (habit: HabitFormData) => Promise<void> | void;
}

export default function AddHabitForm({ onAdd }: AddHabitFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const defaults = getDefaultHabitFormValues();
  const [name, setName] = useState(defaults.name);
  const [description, setDescription] = useState(defaults.description);
  const [color, setColor] = useState(defaults.color);
  const [icon, setIcon] = useState(defaults.icon);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      try {
        await onAdd({
          name: name.trim(),
          description: description.trim(),
          color,
          icon,
          frequency: 'daily' // Default to daily for now
        });
        // Only clear form and close if successful
        const resetValues = getDefaultHabitFormValues();
        setName(resetValues.name);
        setDescription(resetValues.description);
        setColor(resetValues.color);
        setIcon(resetValues.icon);
        setIsOpen(false);
      } catch (error) {
        console.error('Error adding habit:', error);
        // Form stays open so user can retry
      }
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full py-4 px-6 bg-gray-800 hover:bg-gray-700 rounded-lg border-2 border-dashed border-gray-600 transition-colors"
      >
        <span className="text-lg">+ Add New Habit</span>
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-800 rounded-lg p-6 space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-2">
          Habit Name *
        </label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Morning Exercise"
          className="w-full px-4 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
          autoFocus
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-2">
          Description (optional)
        </label>
        <input
          type="text"
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g., 30 minutes of cardio"
          className="w-full px-4 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Color</label>
        <div className="flex gap-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
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
              onClick={() => setIcon(i)}
              className={`w-10 h-10 rounded-lg bg-gray-700 hover:bg-gray-600 transition-all text-xl flex items-center justify-center ${
                icon === i ? 'ring-2 ring-white scale-110' : ''
              }`}
            >
              {i}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          Add Habit
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
