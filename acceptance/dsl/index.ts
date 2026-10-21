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
import { SpaDriver } from '../drivers/spa/spaDriver.ts';
import { WebDriver } from '../drivers/web/webDriver.ts';
import { Accounts } from './accounts.ts';
import { Habits } from './habits.ts';
import { KNOWN_BUGS, type Backend, type KnownBugId, type System } from './knownBugs.ts';
import { Profile } from './profile.ts';
import { Users } from './users.ts';

/** `web` is the Next.js app, `spa` the Vite app the Go server serves. */
export type Protocol = 'api' | 'web' | 'spa';

/** Per-project options, set in playwright.config.ts. */
export interface ProtocolOptions {
  protocol: Protocol;
  apiUrl: string;
  webUrl: string;
  spaUrl: string;
  /** Which server answers apiUrl, or serves the SPA, for the known bugs. */
  backend: Backend;
}

interface Workers extends ProtocolOptions {
  /** One browser per worker, launched only for the web protocol. */
  webBrowser: Browser | undefined;
}

function createDriver(
  { protocol, apiUrl, webUrl, spaUrl }: Omit<ProtocolOptions, 'backend'>,
  webBrowser: Browser | undefined
): ProtocolDriver {
  switch (protocol) {
    case 'api':
      return new ApiDriver(apiUrl);
    case 'web':
      if (!webBrowser) throw new Error('The web protocol needs a browser');
      return new WebDriver(webBrowser, webUrl);
    case 'spa':
      if (!webBrowser) throw new Error('The spa protocol needs a browser');
      return new SpaDriver(webBrowser, spaUrl);
  }
}

/** Where a test runs, for the known bugs: the backend, and the SPA when it is the client. */
function systemsUnderTest(protocol: Protocol, backend: Backend): System[] {
  return protocol === 'spa' ? [backend, 'spa'] : [backend];
}

interface Dsl {
  driver: ProtocolDriver;
  accounts: Accounts;
  users: Users;
  profile: Profile;
  habits: Habits;
  /**
   * Mark this test as one the system under test is known to fail, for any of
   * these beads. See knownBugs.ts.
   */
  knownBug: (...beads: KnownBugId[]) => void;
}

export const test = base.extend<Dsl, Workers>({
  protocol: ['api', { option: true, scope: 'worker' }],
  apiUrl: ['http://localhost:3010', { option: true, scope: 'worker' }],
  webUrl: ['http://localhost:3110', { option: true, scope: 'worker' }],
  spaUrl: ['http://localhost:3020', { option: true, scope: 'worker' }],
  backend: ['node', { option: true, scope: 'worker' }],

  // Not Playwright's own `browser` fixture: a fixture that names it always
  // launches it, and the api project has no use for one.
  webBrowser: [
    async ({ protocol, playwright, headless }, use) => {
      if (protocol === 'api') return use(undefined);
      const browser = await playwright.chromium.launch({ headless });
      await use(browser);
      await browser.close();
    },
    { scope: 'worker' },
  ],

  // A fresh driver and fresh accounts for every test: no state crosses tests.
  driver: async ({ protocol, apiUrl, webUrl, spaUrl, webBrowser }, use) => {
    const driver = createDriver({ protocol, apiUrl, webUrl, spaUrl }, webBrowser);
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
  knownBug: async ({ protocol, backend }, use) => {
    await use((...beads) => {
      const systems = systemsUnderTest(protocol, backend);
      // The first bead still open here decides; the test passes once none is.
      for (const bead of beads) {
        const bug = KNOWN_BUGS[bead];
        const where = systems.find((system) => (bug.on as System[]).includes(system));
        if (where) return test.fail(true, `${bead} on ${where}: ${bug.summary}`);
      }
    });
  },
});

export { expect };
