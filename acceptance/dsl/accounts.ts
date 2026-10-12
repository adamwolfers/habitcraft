import { randomBytes } from 'node:crypto';

/**
 * What the DSL remembers about each account a test has named, and which one
 * is acting.
 *
 * Aliases are what make tests independent. A test says "Alice"; this turns
 * that into an email and password nobody else has ever used, so tests share no
 * data, run in any order and in parallel, and need no fixtures or database
 * reset. That is what replaces test-fixtures.sql.
 *
 * Users are the isolation boundary: every habit and completion belongs to one
 * user, so a unique user isolates everything under it. Habit names therefore
 * stay as the test wrote them, which keeps them readable on screen for the web
 * driver.
 */

export interface AccountState {
  alias: string;
  email: string;
  password: string;
  /** The password before the last successful change, if there was one. */
  previousPassword?: string;
}

const unique = () => randomBytes(6).toString('hex');

export class Accounts {
  private readonly byAlias = new Map<string, AccountState>();
  private actingAlias: string | undefined;

  /** The account for an alias, made up on first use. */
  named(alias: string): AccountState {
    let account = this.byAlias.get(alias);
    if (!account) {
      account = { alias, email: this.freshEmail(alias), password: `Pass-${unique()}` };
      this.byAlias.set(alias, account);
    }
    return account;
  }

  /** An address no account has, for the alias's next change of email. */
  freshEmail(alias: string): string {
    const slug = alias
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return `${slug || 'user'}-${unique()}@acceptance.example.com`;
  }

  actAs(alias: string | undefined): void {
    this.actingAlias = alias;
  }

  /** The account acting now. A step that needs one fails if nobody is. */
  get acting(): AccountState {
    if (!this.actingAlias) throw new Error('No user is signed in; register or sign in first');
    return this.named(this.actingAlias);
  }
}
