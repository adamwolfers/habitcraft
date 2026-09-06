import type { components } from './api.generated';

/**
 * The wire types, aliased from the generated OpenAPI tree.
 *
 * These were hand-written until habitcraft-467. They are aliases now so that a
 * spec change lands here automatically instead of drifting: `api.generated.ts`
 * is regenerated from shared/api-spec/openapi.yaml by `npm run api:codegen`,
 * and CI fails if it is stale. Keep the short local names -- they are what the
 * components import, and they keep `components["schemas"][...]` out of every
 * call site.
 */
export type Habit = components['schemas']['Habit'];

export type HabitWithCompletions = components['schemas']['HabitWithCompletions'];

export type Completion = components['schemas']['Completion'];

/**
 * The create/update habit request body. `status` is part of the same schema
 * server-side, so it comes along; the forms simply do not set it.
 */
export type HabitFormData = components['schemas']['HabitInput'];
