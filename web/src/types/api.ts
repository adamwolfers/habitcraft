/**
 * The API's types and limits, generated from shared/api-spec/openapi.yaml by
 * `npm run api:codegen` at the repo root. Import them from here, under the
 * short names below, rather than from the generated files.
 */
import type { components } from './api.generated.ts';

export type { paths } from './api.generated.ts';
export { requestLimits, schemaLimits } from './apiLimits.generated.ts';

export type User = components['schemas']['User'];
export type Habit = components['schemas']['Habit'];
export type HabitInput = components['schemas']['HabitInput'];
