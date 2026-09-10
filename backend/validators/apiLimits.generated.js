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
 * Freezes the nested literals too -- Object.freeze alone is shallow, and every
 * number here sits one or two levels down.
 */
function deepFreeze(value) {
  for (const inner of Object.values(value)) {
    if (inner && typeof inner === 'object') deepFreeze(inner);
  }
  return Object.freeze(value);
}

/**
 * Length constraints declared on the components/schemas entries, keyed by
 * schema name: `schemaLimits.HabitInput.name.maxLength`.
 *
 * Use these for the UI limits on a body a client SENDS -- the *Input schemas
 * are the request shapes. The response schemas (Habit, Completion) carry the
 * same numbers because they describe the same stored column.
 */
const schemaLimits = deepFreeze({
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
});

/**
 * Length constraints on inline request bodies that are not $refs to a
 * component, keyed by operationId: `requestLimits.createCompletion.notes`.
 */
const requestLimits = deepFreeze({
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
});

module.exports = { schemaLimits, requestLimits };
