import { expect } from '@playwright/test';
import type { ProtocolDriver } from '../drivers/driver.ts';
import type { Accounts, AccountState, EmailChoice } from './accounts.ts';
import { requestLimits } from './apiLimits.generated.ts';
import { settle, type Expecting } from './outcomes.ts';

/** Which password a step uses: the account's own, its last one, or a wrong one. */
export type PasswordChoice = 'current' | 'previous' | 'wrong';

/** A new password that breaks the rules, for steps that set one. */
export type WeakPassword = 'too-short';

function tooShort(password: string): string {
  return password.slice(0, requestLimits.register.password.minLength - 1);
}

function passwordFor(account: AccountState, choice: PasswordChoice = 'current'): string {
  if (choice === 'wrong') return `Wrong-${account.password}`;
  if (choice === 'previous') {
    if (!account.previousPassword) throw new Error(`${account.alias} never changed password`);
    return account.previousPassword;
  }
  return account.password;
}

export class Users {
  constructor(
    private readonly driver: ProtocolDriver,
    private readonly accounts: Accounts
  ) {}

  /**
   * Register an account and act as it. Registering an alias a second time
   * reuses its email, so `{ expect: 'email-taken' }` reads naturally.
   *
   * `email` gives the alias a new address of that shape first, and `password`
   * registers with one that breaks the rules instead of the alias's own.
   */
  async register(
    alias: string,
    options: Expecting & { name?: string; email?: EmailChoice; password?: WeakPassword } = {}
  ): Promise<void> {
    const account = this.accounts.named(alias);
    if (options.email) account.email = this.accounts.freshEmail(alias, options.email);
    const outcome = await this.driver.register({
      email: account.email,
      password: options.password ? tooShort(account.password) : account.password,
      name: options.name ?? alias,
    });
    if (settle(outcome, options, `register ${alias}`)) this.accounts.actAs(alias);
  }

  /** `withEmail: 'in-capitals'` types the alias's address in upper case. */
  async signInAs(
    alias: string,
    options: Expecting & { withPassword?: PasswordChoice; withEmail?: 'in-capitals' } = {}
  ): Promise<void> {
    const account = this.accounts.named(alias);
    const outcome = await this.driver.signIn({
      email: options.withEmail ? account.email.toUpperCase() : account.email,
      password: passwordFor(account, options.withPassword),
    });
    if (settle(outcome, options, `sign in as ${alias}`)) this.accounts.actAs(alias);
  }

  async signOut(): Promise<void> {
    await this.driver.signOut();
    this.accounts.actAs(undefined);
  }

  /** Carry on in a session that has been open longer than its access credential lasts. */
  async renewSession(options: Expecting = {}): Promise<void> {
    settle(await this.driver.renewSession(), options, 'renew the session');
  }

  async shouldBeSignedIn(): Promise<void> {
    expect(await this.driver.isSignedIn(), 'signed in').toBe(true);
  }

  async shouldBeSignedOut(): Promise<void> {
    expect(await this.driver.isSignedIn(), 'signed out').toBe(false);
  }

  /** Change the acting user's password to a new one the DSL makes up. */
  async changePassword(
    options: Expecting & { confirmingWith?: PasswordChoice; to?: WeakPassword } = {}
  ): Promise<void> {
    const account = this.accounts.acting;
    const newPassword = options.to ? tooShort(account.password) : `New-${account.password}`;
    const outcome = await this.driver.changePassword(
      passwordFor(account, options.confirmingWith),
      newPassword
    );
    if (settle(outcome, options, `change ${account.alias}'s password`)) {
      account.previousPassword = account.password;
      account.password = newPassword;
    }
  }

  async deleteAccount(
    options: Expecting & { confirmingWith?: PasswordChoice } = {}
  ): Promise<void> {
    const account = this.accounts.acting;
    const outcome = await this.driver.deleteAccount(passwordFor(account, options.confirmingWith));
    if (settle(outcome, options, `delete ${account.alias}'s account`))
      this.accounts.actAs(undefined);
  }
}
