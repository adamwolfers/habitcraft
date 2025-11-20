/**
 * Shared TypeScript type definitions for the Habit Tracker application
 * These types should match the OpenAPI specification and database schema
 */

// User types
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRegistration {
  email: string;
  password: string;
  name: string;
}

export interface UserLogin {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// Habit types
export type HabitFrequency = 'daily' | 'weekly';
export type HabitStatus = 'active' | 'archived';

export interface HabitInput {
  name: string;
  description?: string;
  frequency: HabitFrequency;
  targetDays?: number[]; // 0-6 for days of week (0=Sunday)
  color?: string; // Hex color code
  icon?: string; // Emoji or icon identifier
}

export interface Habit extends HabitInput {
  id: string;
  userId: string;
  status: HabitStatus;
  createdAt: Date;
  updatedAt: Date;
}

// Completion types
export interface CompletionInput {
  date: string; // ISO date string (YYYY-MM-DD)
  notes?: string;
}

export interface Completion {
  id: string;
  habitId: string;
  date: string; // ISO date string (YYYY-MM-DD)
  notes?: string;
  createdAt: Date;
}

// Statistics types
export interface HabitStatistics {
  habitId: string;
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
  completionRate: number; // Percentage (0-100)
  lastCompletedDate?: string; // ISO date string
}

// API response types
export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  version: string;
}

export interface HelloResponse {
  message: string;
}

// Query parameters
export interface ListHabitsQuery {
  status?: HabitStatus;
}

export interface ListCompletionsQuery {
  startDate?: string; // ISO date string
  endDate?: string; // ISO date string
}

// Validation helpers
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidHexColor = (color: string): boolean => {
  const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
  return hexColorRegex.test(color);
};

export const isValidDate = (date: string): boolean => {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) return false;
  const d = new Date(date);
  return d instanceof Date && !isNaN(d.getTime());
};

export const isValidDayOfWeek = (day: number): boolean => {
  return Number.isInteger(day) && day >= 0 && day <= 6;
};
