'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

// Simple email validation regex
const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

interface HeaderProps {
  onOpenProfileModal?: () => void;
}

export default function Header({ onOpenProfileModal }: HeaderProps) {
  const router = useRouter();
  const { user, isAuthenticated, logout, updateUser } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [editEmail, setEditEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isSavingEmail, setIsSavingEmail] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Still redirect even on error to prevent stuck state
      router.push('/login');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleEditClick = () => {
    setEditName(user?.name || '');
    setNameError(null);
    setIsEditingName(true);
  };

  const handleCancelEdit = () => {
    setIsEditingName(false);
    setEditName('');
    setNameError(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setNameError(null);
    try {
      await updateUser({ name: editName });
      setIsEditingName(false);
      setEditName('');
    } catch (error) {
      setNameError(error instanceof Error ? error.message : 'Update failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditEmailClick = () => {
    setEditEmail(user?.email || '');
    setEmailError(null);
    setIsEditingEmail(true);
  };

  const handleCancelEmailEdit = () => {
    setIsEditingEmail(false);
    setEditEmail('');
    setEmailError(null);
  };

  const handleSaveEmail = async () => {
    setIsSavingEmail(true);
    setEmailError(null);
    try {
      await updateUser({ email: editEmail });
      setIsEditingEmail(false);
      setEditEmail('');
    } catch (error) {
      setEmailError(error instanceof Error ? error.message : 'Update failed');
    } finally {
      setIsSavingEmail(false);
    }
  };

  return (
    <header className="bg-gray-800 border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-white">HabitCraft</h1>
          </div>

          {isAuthenticated && user && (
            <div className="flex items-center gap-4">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <label htmlFor="name-input" className="sr-only">Name</label>
                  <input
                    id="name-input"
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="px-2 py-1 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    onClick={handleSave}
                    disabled={!editName.trim() || isSaving}
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 disabled:cursor-not-allowed text-white rounded transition-colors text-sm"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  {nameError && (
                    <span className="text-red-400 text-sm">{nameError}</span>
                  )}
                </div>
              ) : (
                <>
                  <span className="text-gray-300">
                    {user.name}
                  </span>
                  <button
                    onClick={handleEditClick}
                    className="text-gray-400 hover:text-white transition-colors"
                    aria-label="Edit name"
                  >
                    ✏️
                  </button>
                </>
              )}
              {isEditingEmail ? (
                <div className="flex items-center gap-2">
                  <label htmlFor="email-input" className="sr-only">Email</label>
                  <input
                    id="email-input"
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="px-2 py-1 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    onClick={handleSaveEmail}
                    disabled={!editEmail.trim() || !isValidEmail(editEmail) || isSavingEmail}
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 disabled:cursor-not-allowed text-white rounded transition-colors text-sm"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleCancelEmailEdit}
                    className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  {emailError && (
                    <span className="text-red-400 text-sm">{emailError}</span>
                  )}
                </div>
              ) : (
                <>
                  <span className="text-gray-400 text-sm">
                    {user.email}
                  </span>
                  <button
                    onClick={handleEditEmailClick}
                    className="text-gray-400 hover:text-white transition-colors"
                    aria-label="Edit email"
                  >
                    ✏️
                  </button>
                </>
              )}
              {onOpenProfileModal && (
                <button
                  onClick={onOpenProfileModal}
                  className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors text-sm"
                  aria-label="Profile"
                >
                  {user.name}
                </button>
              )}
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {isLoggingOut ? 'Logging out...' : 'Log Out'}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
