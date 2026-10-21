/**
 * GENERATED FILE -- DO NOT EDIT.
 *
 * Derived from shared/api-spec/openapi.yaml (version 1.0.0) by
 * scripts/api-codegen.js. Change the spec and regenerate:
 *
 *   npm run api:codegen
 *
 * CI fails if this file does not match what the spec produces.
 */

/**
 * Length constraints declared on the components/schemas entries, keyed by
 * schema name: `schemaLimits.HabitInput.name.maxLength`.
 *
 * Use these for the UI limits on a body a client SENDS -- the *Input schemas
 * are the request shapes. The response schemas (Habit, Completion) carry the
 * same numbers because they describe the same stored column.
 */
export const schemaLimits = {
  HabitInput: {
    name: {
      minLength: 1,
      maxLength: 100,
    },
    description: {
      maxLength: 500,
    },
  },
  Habit: {
    name: {
      maxLength: 100,
    },
    description: {
      maxLength: 500,
    },
  },
  HabitWithCompletions: {
    name: {
      maxLength: 100,
    },
    description: {
      maxLength: 500,
    },
  },
  Completion: {
    notes: {
      maxLength: 500,
    },
  },
} as const;

/**
 * Length constraints on inline request bodies that are not $refs to a
 * component, keyed by operationId: `requestLimits.createCompletion.notes`.
 */
export const requestLimits = {
  register: {
    email: {
      maxLength: 255,
    },
    password: {
      minLength: 8,
      maxLength: 72,
    },
    name: {
      minLength: 1,
      maxLength: 100,
    },
  },
  updateCurrentUser: {
    name: {
      minLength: 1,
      maxLength: 100,
    },
    email: {
      maxLength: 255,
    },
  },
  changePassword: {
    newPassword: {
      minLength: 8,
      maxLength: 72,
    },
  },
  createCompletion: {
    notes: {
      maxLength: 500,
    },
  },
  updateCompletionNote: {
    notes: {
      maxLength: 500,
    },
  },
} as const;
