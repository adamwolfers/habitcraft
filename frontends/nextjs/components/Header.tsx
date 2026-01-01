'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useClickOutside } from '@/hooks/useClickOutside';

interface HeaderProps {
  onOpenProfileModal?: () => void;
  variant?: 'app' | 'landing';
}

export default function Header({ onOpenProfileModal, variant = 'app' }: HeaderProps) {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback(() => {
    if (isMenuOpen) {
      setIsMenuOpen(false);
    }
  }, [isMenuOpen]);

  useClickOutside(menuRef, handleClickOutside);

  const handleToggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleEditProfile = () => {
    setIsMenuOpen(false);
    onOpenProfileModal?.();
  };

  const handleLogout = async () => {
    setIsMenuOpen(false);
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

  const profileMenu = (
    <div ref={menuRef} className="relative">
      <button
        onClick={handleToggleMenu}
        className="p-2 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
        aria-label="Profile"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </button>
      {isMenuOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-gray-700 rounded-lg shadow-lg py-1 z-50">
          <button
            onClick={handleEditProfile}
            className="w-full text-left px-4 py-2 text-white hover:bg-gray-600 transition-colors"
          >
            Edit Profile
          </button>
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full text-left px-4 py-2 text-white hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoggingOut ? 'Logging out...' : 'Log Out'}
          </button>
        </div>
      )}
    </div>
  );

  const logoHref = variant === 'landing' ? '/' : '/dashboard';

  return (
    <header className="bg-gray-800 border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href={logoHref} className="text-2xl font-bold text-white hover:text-gray-200 transition-colors">
              HabitCraft.org
            </Link>
          </div>

          {variant === 'landing' ? (
            // Landing page navigation
            <div className="flex items-center gap-4">
              {isAuthenticated && user ? (
                // Authenticated user on landing page
                <>
                  <Link
                    href="/dashboard"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    Go to Dashboard
                  </Link>
                  {onOpenProfileModal && profileMenu}
                </>
              ) : (
                // Unauthenticated user on landing page
                <>
                  <Link
                    href="/login"
                    className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                  >
                    Log In
                  </Link>
                  <Link
                    href="/register"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          ) : (
            // App navigation (dashboard)
            isAuthenticated && user && onOpenProfileModal && (
              <div className="flex items-center gap-4">
                {profileMenu}
              </div>
            )
          )}
        </div>
      </div>
    </header>
  );
}
