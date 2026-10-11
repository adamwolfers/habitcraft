import { randomBytes } from 'node:crypto';

/**
 * Maps the names a test case uses ("Alice") to values unique to this test
 * ("alice-k3x9q2m7@acceptance.example.com"). Tests never share data, so they
 * run in any order, in parallel, and against a database other runs have
 * already written to. That is what replaces test-fixtures.sql.
 *
 * Users are the isolation boundary: every habit and completion belongs to one
 * user, so a unique user isolates everything under it. Habit names therefore
 * stay as the test wrote them, which keeps them readable on screen for the web
 * driver.
 */
export class Aliases {
  private readonly emails = new Map<string, string>();

  /** The same alias always gives the same email within one test. */
  email(alias: string): string {
    let email = this.emails.get(alias);
    if (!email) {
      const slug = alias
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      email = `${slug || 'user'}-${randomBytes(6).toString('hex')}@acceptance.example.com`;
      this.emails.set(alias, email);
    }
    return email;
  }
}
