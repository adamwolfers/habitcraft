import { expect } from '@playwright/test';
import type { ProtocolDriver } from '../drivers/driver.ts';
import type { Accounts, EmailChoice } from './accounts.ts';
import { requestLimits } from './apiLimits.generated.ts';
import { settle, type Expecting } from './outcomes.ts';
import { describeText, resolveText, type Text } from './text.ts';

const LIMITS = requestLimits.updateCurrentUser;

/** The acting user's own profile. */
export class Profile {
  constructor(
    private readonly driver: ProtocolDriver,
    private readonly accounts: Accounts
  ) {}

  async rename(name: Text, options: Expecting = {}): Promise<void> {
    const outcome = await this.driver.updateProfile({
      name: resolveText(name, LIMITS.name.maxLength),
    });
    settle(outcome, options, `rename to ${describeText(name)}`);
  }

  /**
   * Move the acting account to a new address nobody has, of the shape `to`
   * asks for. Addresses are kept in lower case, so the alias's new address is
   * the lower-case one.
   */
  async changeEmail({
    to = 'a-new-address',
    ...options
  }: Expecting & { to?: EmailChoice } = {}): Promise<void> {
    const account = this.accounts.acting;
    const email = this.accounts.freshEmail(account.alias, to);
    const outcome = await this.driver.updateProfile({ email });
    if (settle(outcome, options, `change ${account.alias}'s email to ${to}`))
      account.email = email.toLowerCase();
  }

  /** Try to take another account's address. */
  async changeEmailToThatOf(alias: string, options: Expecting = {}): Promise<void> {
    const account = this.accounts.acting;
    const email = this.accounts.named(alias).email;
    const outcome = await this.driver.updateProfile({ email });
    if (settle(outcome, options, `change email to ${alias}'s`)) account.email = email;
  }

  async shouldHaveName(name: Text): Promise<void> {
    expect((await this.driver.profile()).name, 'profile name').toBe(
      resolveText(name, LIMITS.name.maxLength)
    );
  }

  /** The profile shows the address the DSL last gave this alias. */
  async shouldHaveEmailOf(alias: string): Promise<void> {
    const expected = this.accounts.named(alias).email;
    expect((await this.driver.profile()).email, 'profile email').toBe(expected);
  }
}
