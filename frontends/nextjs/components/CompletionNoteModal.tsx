'use client';

import { useState } from 'react';

interface CompletionNoteModalProps {
  habitName: string;
  date: string; // YYYY-MM-DD format
  existingNote: string | null;
  onSave: (note: string | null) => void;
  onClose: () => void;
}

function formatDate(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function CompletionNoteModal({
  habitName,
  date,
  existingNote,
  onSave,
  onClose,
}: CompletionNoteModalProps) {
  const [note, setNote] = useState(existingNote || '');
  const MAX_LENGTH = 500;

  const handleSave = () => {
    const trimmedNote = note.trim();
    onSave(trimmedNote);
  };

  const handleDelete = () => {
    onSave(null);
  };

  const getCharCountClass = () => {
    const length = note.length;
    if (length >= MAX_LENGTH) return 'text-red-500';
    if (length >= 450) return 'text-yellow-500';
    return 'text-gray-400';
  };

  const isSaveDisabled = !existingNote && note.trim().length === 0;

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
          <div>
            <h2 id="modal-title" className="text-xl font-semibold">
              {existingNote ? 'Edit Note' : 'Add Note'}
            </h2>
            <p className="text-sm text-gray-400">
              <span className="font-medium text-gray-300">{habitName}</span> &bull; {formatDate(date)}
            </p>
          </div>
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

        <div className="space-y-4">
          <div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={MAX_LENGTH}
              rows={4}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Add a note about your completion..."
            />
            <div className="flex justify-end mt-1">
              <span className={`text-xs ${getCharCountClass()}`}>
                {note.length}/{MAX_LENGTH}
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-between gap-3 mt-6">
          <div>
            {existingNote && (
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 text-red-400 hover:text-red-300 transition-colors"
              >
                Delete Note
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaveDisabled}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
