import { expect } from '@playwright/test';
import type { Outcome, Refusal } from '../drivers/driver.ts';

/**
 * Every DSL step the product may refuse takes `{ expect: '<refusal>' }`.
 * Without it the step must succeed; with it, the step must be refused for
 * exactly that reason.
 */
export interface Expecting {
  expect?: Refusal;
}

/** Assert the outcome is what the test asked for. Returns whether it succeeded. */
export function settle(outcome: Outcome, { expect: refusal }: Expecting, step: string): boolean {
  const actual = outcome.ok ? 'success' : `refused (${outcome.refusal})`;
  expect(actual, step).toBe(refusal ? `refused (${refusal})` : 'success');
  return outcome.ok;
}
