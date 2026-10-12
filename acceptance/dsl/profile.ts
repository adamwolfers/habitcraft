import { expect } from '@playwright/test';
import type { ProtocolDriver } from '../drivers/driver.ts';
import type { Accounts } from './accounts.ts';
import { settle, type Expecting } from './outcomes.ts';

/** The acting user's own profile. */
export class Profile {
  constructor(
    private readonly driver: ProtocolDriver,
    private readonly accounts: Accounts
  ) {}

  async rename(name: string, options: Expecting = {}): Promise<void> {
    settle(await this.driver.updateProfile({ name }), options, `rename to "${name}"`);
  }

  /** Move the acting account to a new address nobody has. */
  async changeEmail(options: Expecting = {}): Promise<void> {
    const account = this.accounts.acting;
    const email = this.accounts.freshEmail(account.alias);
    const outcome = await this.driver.updateProfile({ email });
    if (settle(outcome, options, `change ${account.alias}'s email`)) account.email = email;
  }

  /** Try to take another account's address. */
  async changeEmailToThatOf(alias: string, options: Expecting = {}): Promise<void> {
    const account = this.accounts.acting;
    const email = this.accounts.named(alias).email;
    const outcome = await this.driver.updateProfile({ email });
    if (settle(outcome, options, `change email to ${alias}'s`)) account.email = email;
  }

  async shouldHaveName(name: string): Promise<void> {
    expect((await this.driver.profile()).name, 'profile name').toBe(name);
  }

  /** The profile shows the address the DSL last gave this alias. */
  async shouldHaveEmailOf(alias: string): Promise<void> {
    const expected = this.accounts.named(alias).email;
    expect((await this.driver.profile()).email, 'profile email').toBe(expected);
  }
}
