/**
 * Layer 2: the DSL. Test cases call these in the language of users, habits
 * and days; the DSL makes the values unique, resolves dates, picks the driver
 * for the current protocol and turns observations into assertions.
 *
 * Import `test` and `expect` from here, never from @playwright/test, so every
 * test case gets the DSL fixtures and nothing else.
 */

import { test as base, expect, type Browser } from '@playwright/test';
import { ApiDriver } from '../drivers/api/apiDriver.ts';
import type { ProtocolDriver } from '../drivers/driver.ts';
import { WebDriver } from '../drivers/web/webDriver.ts';
import { Accounts } from './accounts.ts';
import { Habits } from './habits.ts';
import { Profile } from './profile.ts';
import { Users } from './users.ts';

export type Protocol = 'api' | 'web';

/** Per-project options, set in playwright.config.ts. */
export interface ProtocolOptions {
  protocol: Protocol;
  apiUrl: string;
  webUrl: string;
}

interface Workers extends ProtocolOptions {
  /** One browser per worker, launched only for the web protocol. */
  webBrowser: Browser | undefined;
}

function createDriver(
  { protocol, apiUrl, webUrl }: ProtocolOptions,
  webBrowser: Browser | undefined
): ProtocolDriver {
  switch (protocol) {
    case 'api':
      return new ApiDriver(apiUrl);
    case 'web':
      if (!webBrowser) throw new Error('The web protocol needs a browser');
      return new WebDriver(webBrowser, webUrl);
  }
}

interface Dsl {
  driver: ProtocolDriver;
  accounts: Accounts;
  users: Users;
  profile: Profile;
  habits: Habits;
}

export const test = base.extend<Dsl, Workers>({
  protocol: ['api', { option: true, scope: 'worker' }],
  apiUrl: ['http://localhost:3010', { option: true, scope: 'worker' }],
  webUrl: ['http://localhost:3110', { option: true, scope: 'worker' }],

  // Not Playwright's own `browser` fixture: a fixture that names it always
  // launches it, and the api project has no use for one.
  webBrowser: [
    async ({ protocol, playwright, headless }, use) => {
      if (protocol !== 'web') return use(undefined);
      const browser = await playwright.chromium.launch({ headless });
      await use(browser);
      await browser.close();
    },
    { scope: 'worker' },
  ],

  // A fresh driver and fresh accounts for every test: no state crosses tests.
  driver: async ({ protocol, apiUrl, webUrl, webBrowser }, use) => {
    const driver = createDriver({ protocol, apiUrl, webUrl }, webBrowser);
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
