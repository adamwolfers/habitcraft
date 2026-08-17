// User types
export interface User {
  id: string;
  email: string;
  created_at: string;
}

// Auth types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
}

// Habit types
export interface Habit {
  id: string;
  userId: string;
  name: string;
  description?: string;
  icon: string;
  color: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface HabitCompletion {
  id: string;
  habit_id: string;
  completed_date: string;
  note?: string;
  created_at: string;
}

export interface HabitWithStats extends Habit {
  completions: HabitCompletion[];
}

// API types
export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// Navigation types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Profile: undefined;
};

export type MainStackParamList = {
  Tabs: undefined;
  CreateHabit: undefined;
  EditHabit: { habitId: string };
  HabitDetail: { habitId: string };
};
