/**
 * Layer 2: the DSL. Test cases call these in the language of habits and days;
 * the DSL makes the values unique, resolves dates, picks the driver for the
 * current protocol and turns observations into assertions.
 *
 * Import `test` and `expect` from here, never from @playwright/test, so every
 * test case gets the DSL fixtures and nothing else.
 */

import { test as base, expect } from '@playwright/test';
import { ApiDriver } from '../drivers/api/apiDriver.ts';
import type { ProtocolDriver } from '../drivers/driver.ts';
import { Aliases } from './aliases.ts';
import { resolveDay, type Day } from './dates.ts';

export type Protocol = 'api';

/** Per-project options, set in playwright.config.ts. */
export interface ProtocolOptions {
  protocol: Protocol;
  apiUrl: string;
}

/** Same for every account, so a test can sign back in by alias alone. */
const PASSWORD = 'Acceptance-Pass-1';

export class Users {
  constructor(
    private readonly driver: ProtocolDriver,
    private readonly aliases: Aliases
  ) {}

  /** Register a new user and act as them. */
  async register(alias: string): Promise<void> {
    await this.driver.register({
      email: this.aliases.email(alias),
      password: PASSWORD,
      name: alias,
    });
  }

  /** Act as a user registered earlier in this test. */
  async signInAs(alias: string): Promise<void> {
    await this.driver.signIn({ email: this.aliases.email(alias), password: PASSWORD });
  }
}

export class Habits {
  constructor(private readonly driver: ProtocolDriver) {}

  async create(name: string): Promise<void> {
    await this.driver.createHabit(name);
  }

  async checkOff(name: string, { on }: { on: Day }): Promise<void> {
    await this.driver.checkOff(name, resolveDay(on));
  }

  async shouldInclude(name: string): Promise<void> {
    expect(await this.driver.habitNames(), `habits should include "${name}"`).toContain(name);
  }

  async shouldNotInclude(name: string): Promise<void> {
    expect(await this.driver.habitNames(), `habits should not include "${name}"`).not.toContain(
      name
    );
  }

  async shouldBeCheckedOff(name: string, { on }: { on: Day }): Promise<void> {
    const date = resolveDay(on);
    expect(await this.driver.isCheckedOff(name, date), `"${name}" checked off on ${date}`).toBe(
      true
    );
  }

  async shouldNotBeCheckedOff(name: string, { on }: { on: Day }): Promise<void> {
    const date = resolveDay(on);
    expect(await this.driver.isCheckedOff(name, date), `"${name}" not checked off on ${date}`).toBe(
      false
    );
  }
}

function createDriver({ protocol, apiUrl }: ProtocolOptions): ProtocolDriver {
  switch (protocol) {
    case 'api':
      return new ApiDriver(apiUrl);
  }
}

export const test = base.extend<
  { driver: ProtocolDriver; users: Users; habits: Habits },
  ProtocolOptions
>({
  protocol: ['api', { option: true, scope: 'worker' }],
  apiUrl: ['http://localhost:3010', { option: true, scope: 'worker' }],

  // A fresh driver and fresh aliases for every test: no state crosses tests.
  driver: async ({ protocol, apiUrl }, use) => {
    const driver = createDriver({ protocol, apiUrl });
    await use(driver);
    await driver.close();
  },
  users: async ({ driver }, use) => {
    await use(new Users(driver, new Aliases()));
  },
  habits: async ({ driver }, use) => {
    await use(new Habits(driver));
  },
});

export { expect };
