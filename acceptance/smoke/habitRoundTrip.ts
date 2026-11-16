import { randomBytes } from 'node:crypto';
import type { Account, Outcome, ProtocolDriver } from '../drivers/driver.ts';
import { resolveDay } from '../dsl/dates.ts';

/**
 * The post-deploy smoke check (habitcraft-vxln.9.1): one habit round trip as a
 * throwaway user, through any protocol driver.
 *
 * It registers, creates a habit, checks it off today, reads both back, and
 * deletes the account. The deletion runs whether or not the round trip
 * passed, because a smoke run that leaks its user into production is how
 * habitcraft-whs happened. It then confirms the user is gone without signing
 * in again: registering is the only auth call it makes, so it stays far under
 * the login rate limit.
 */

/** Recognisable in a users table, and unique per run. */
export function throwawayAccount(now: Date = new Date()): Account {
  const unique = randomBytes(6).toString('hex');
  return {
    email: `smoke-${now.getTime()}-${unique}@smoke.example.com`,
    password: `Smoke-${randomBytes(12).toString('hex')}`,
    name: 'Smoke Check',
  };
}

export const SMOKE_HABIT = 'Smoke check';

export async function habitRoundTrip(
  driver: ProtocolDriver,
  account: Account,
  log: (line: string) => void = console.log
): Promise<void> {
  log(`registering ${account.email}`);
  succeeded('register', await driver.register(account));

  let failure: unknown;
  try {
    const today = resolveDay('today', 'UTC');
    driver.liveIn('UTC');

    log(`creating habit "${SMOKE_HABIT}"`);
    succeeded('create a habit', await driver.createHabit(SMOKE_HABIT));

    log(`checking it off on ${today}`);
    succeeded('check the habit off', await driver.checkOff(SMOKE_HABIT, today));

    log('reading both back');
    const names = await driver.habitNames();
    if (!names.includes(SMOKE_HABIT)) {
      throw new Error(`the habit list does not show "${SMOKE_HABIT}": ${JSON.stringify(names)}`);
    }
    if (!(await driver.isCheckedOff(SMOKE_HABIT, today))) {
      throw new Error(`"${SMOKE_HABIT}" is not checked off on ${today}`);
    }
  } catch (error) {
    failure = error;
  }

  // Cleanup comes before reporting the failure, and its own failure is
  // reported alongside it, so neither hides the other.
  try {
    log(`deleting ${account.email}`);
    succeeded('delete the account', await driver.deleteAccount(account.password));
    if (await driver.isSignedIn()) throw new Error('the account still answers after deletion');
    log('account deleted');
  } catch (cleanupError) {
    throw new AggregateError(
      failure === undefined ? [cleanupError] : [failure, cleanupError],
      `LEFT A USER BEHIND: ${account.email} could not be deleted; remove it by hand`
    );
  }

  if (failure !== undefined) throw failure;
}

function succeeded(step: string, outcome: Outcome): void {
  if (!outcome.ok) throw new Error(`could not ${step}: refused as ${outcome.refusal}`);
}
