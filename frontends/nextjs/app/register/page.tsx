'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { validateRegistrationForm } from '@/utils/authUtils';

export default function RegisterPage() {
  const router = useRouter();
  const { register, isAuthenticated } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState('');
  const [apiError, setApiError] = useState('');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setValidationError('');
    setApiError('');

    const validationError = validateRegistrationForm({ password, confirmPassword });
    if (validationError) {
      setValidationError(validationError);
      return;
    }

    // Call register API
    try {
      await register(email, password, name);
      router.push('/dashboard');
    } catch (error) {
      if (error instanceof Error && error.message) {
        setApiError(error.message);
      } else {
        setApiError('Registration failed. Please try again.');
      }
    }
  };

  const handleInputChange = (field: 'name' | 'email' | 'password' | 'confirmPassword', value: string) => {
    if (field === 'name') {
      setName(value);
    } else if (field === 'email') {
      setEmail(value);
    } else if (field === 'password') {
      setPassword(value);
    } else {
      setConfirmPassword(value);
    }

    // Clear errors when user starts typing
    setValidationError('');
    setApiError('');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-center mb-2">Sign Up</h1>
          <p className="text-gray-400 text-center">
            Create your HabitCraft account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {validationError && (
            <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded">
              {validationError}
            </div>
          )}
          {apiError && (
            <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded">
              {apiError}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Your name"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                required
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                required
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-300 mb-2">
                Confirm Password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                required
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
          >
            Sign Up
          </button>

          <p className="text-center text-gray-400">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-500 hover:text-blue-400">
              Log in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
