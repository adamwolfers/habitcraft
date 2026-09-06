import type { components } from './api.generated';

/**
 * The wire types, aliased from the generated OpenAPI tree.
 *
 * These were hand-written until habitcraft-467 and had drifted: `User` said
 * `created_at` and had no `name`, against a server that has always returned
 * `createdAt` and `name`. `api.generated.ts` is regenerated from
 * shared/api-spec/openapi.yaml by `npm run api:codegen` and CI fails if it is
 * stale, so a spec change now lands here instead of rotting.
 *
 * Keep the short local names: they are what the screens import, and they keep
 * `components["schemas"][...]` out of every call site. The names that differ
 * from the spec's (HabitCompletion, HabitWithStats) are kept as-is -- renaming
 * them is churn unrelated to this change.
 */
export type User = components['schemas']['User'];

// Auth types
export type AuthTokens = components['schemas']['TokenPair'];

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
}

// Habit types
export type Habit = components['schemas']['Habit'];

export type HabitInput = components['schemas']['HabitInput'];

export type HabitCompletion = components['schemas']['Completion'];

export type HabitWithStats = components['schemas']['HabitWithCompletions'];

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
