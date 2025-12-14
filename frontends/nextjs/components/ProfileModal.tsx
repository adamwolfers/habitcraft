'use client';

import { useState } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

interface ProfileModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updates: { name?: string; email?: string }) => Promise<void>;
}

// Simple email validation regex
const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export default function ProfileModal({ user, isOpen, onClose, onUpdate }: ProfileModalProps) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) {
    return null;
  }

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const isFormValid = trimmedName.length > 0 && trimmedEmail.length > 0 && isValidEmail(trimmedEmail);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isFormValid) {
      return;
    }

    // Check if anything has changed
    const nameChanged = trimmedName !== user.name;
    const emailChanged = trimmedEmail !== user.email;

    if (!nameChanged && !emailChanged) {
      // Nothing changed, just close
      handleClose();
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onUpdate({
        name: trimmedName,
        email: trimmedEmail,
      });
      handleClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update profile';
      setError(errorMessage);
    } finally {
      setIsSaving(false);
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
        aria-labelledby="profile-modal-title"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="profile-modal-title" className="text-xl font-semibold">
            Profile
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

        <div className="mb-6 text-center">
          <div className="text-gray-300 text-lg">{user.name}</div>
          <div className="text-gray-400 text-sm">{user.email}</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="profile-name" className="block text-sm font-medium mb-2">
                Name
              </label>
              <input
                id="profile-name"
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
              <label htmlFor="profile-email" className="block text-sm font-medium mb-2">
                Email
              </label>
              <input
                id="profile-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                required
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
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
              disabled={!isFormValid || isSaving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
