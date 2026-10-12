/**
 * Layer 2: the DSL. Test cases call these in the language of users, habits
 * and days; the DSL makes the values unique, resolves dates, picks the driver
 * for the current protocol and turns observations into assertions.
 *
 * Import `test` and `expect` from here, never from @playwright/test, so every
 * test case gets the DSL fixtures and nothing else.
 */

import { test as base, expect } from '@playwright/test';
import { ApiDriver } from '../drivers/api/apiDriver.ts';
import type { ProtocolDriver } from '../drivers/driver.ts';
import { Accounts } from './accounts.ts';
import { Habits } from './habits.ts';
import { Profile } from './profile.ts';
import { Users } from './users.ts';

export type Protocol = 'api';

/** Per-project options, set in playwright.config.ts. */
export interface ProtocolOptions {
  protocol: Protocol;
  apiUrl: string;
}

function createDriver({ protocol, apiUrl }: ProtocolOptions): ProtocolDriver {
  switch (protocol) {
    case 'api':
      return new ApiDriver(apiUrl);
  }
}

interface Dsl {
  driver: ProtocolDriver;
  accounts: Accounts;
  users: Users;
  profile: Profile;
  habits: Habits;
}

export const test = base.extend<Dsl, ProtocolOptions>({
  protocol: ['api', { option: true, scope: 'worker' }],
  apiUrl: ['http://localhost:3010', { option: true, scope: 'worker' }],

  // A fresh driver and fresh accounts for every test: no state crosses tests.
  driver: async ({ protocol, apiUrl }, use) => {
    const driver = createDriver({ protocol, apiUrl });
    await use(driver);
    await driver.close();
  },
  accounts: async ({}, use) => {
    await use(new Accounts());
  },
  users: async ({ driver, accounts }, use) => {
    await use(new Users(driver, accounts));
  },
  profile: async ({ driver, accounts }, use) => {
    await use(new Profile(driver, accounts));
  },
  habits: async ({ driver }, use) => {
    await use(new Habits(driver));
  },
});

export { expect };
