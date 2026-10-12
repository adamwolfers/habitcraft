import { randomBytes } from 'node:crypto';
import { requestLimits } from './apiLimits.generated.ts';
import { lengthFor, type Length } from './text.ts';

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

/**
 * Which kind of address a step uses. Every one is unique; they differ only in
 * shape, for the cases where the shape is what the test is about.
 */
export type EmailChoice = 'a-new-address' | 'in-capitals' | 'malformed' | Length;

/** One label of a domain name holds at most 63 characters (RFC 1035). */
const MAX_LABEL = 63;
const DOMAIN = 'acceptance.example.com';

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

  /**
   * An address no account has, for the alias's next change of email. Every
   * shape but 'malformed' is a well-formed address.
   */
  freshEmail(alias: string, choice: EmailChoice = 'a-new-address'): string {
    const slug = alias
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const local = `${slug || 'user'}-${unique()}`;
    switch (choice) {
      case 'a-new-address':
        return `${local}@${DOMAIN}`;
      case 'in-capitals':
        return `${local}@${DOMAIN}`.toUpperCase();
      case 'malformed':
        return `${local}.${DOMAIN}`;
      default:
        return emailOfLength(local, lengthFor(choice, requestLimits.register.email.maxLength));
    }
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

/**
 * A well-formed address exactly `length` characters long. The padding goes
 * into the domain as labels no longer than a label may be, so length is the
 * only thing about it that a server could object to.
 */
function emailOfLength(local: string, length: number): string {
  let room = length - local.length - '@'.length - `.${DOMAIN}`.length;
  const labels: string[] = [];
  while (room > MAX_LABEL) {
    labels.push('a'.repeat(MAX_LABEL - 1));
    room -= MAX_LABEL; // the label and the dot after it
  }
  if (room > 0) labels.push('a'.repeat(room));
  const email = [local, '@', ...labels.map((label) => `${label}.`), DOMAIN].join('');
  if (email.length !== length) throw new Error(`Cannot make an email ${length} characters long`);
  return email;
}
