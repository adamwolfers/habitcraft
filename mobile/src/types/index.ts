import type { components, operations } from './api.generated';

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
 *
 * Request bodies come off `operations`, not `components`: the auth bodies are
 * declared inline in the spec rather than as $ref'd schemas, so they have no
 * entry under `components["schemas"]`. Aliasing them anyway is what stops the
 * drift that broke registration -- RegisterData was hand-written as
 * `{ email, password }` against a server that has always required `name`, and
 * nothing failed until a real device hit a 400 (habitcraft-7ggs).
 */
export type User = components['schemas']['User'];

// Auth types
export type AuthTokens = components['schemas']['TokenPair'];

export type LoginCredentials = operations['login']['requestBody']['content']['application/json'];

export type RegisterData = operations['register']['requestBody']['content']['application/json'];

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
  Welcome: undefined;
  // `email` is prefilled when Register sends a user here after a 409, so the
  // duplicate-email dead end becomes a one-tap recovery.
  Login: { email?: string } | undefined;
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
