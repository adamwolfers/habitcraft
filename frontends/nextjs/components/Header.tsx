'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function Header() {
  const router = useRouter();
  const { user, isAuthenticated, logout, updateUser } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
