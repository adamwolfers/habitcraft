/**
 * Layer 1: test cases, in the language of a user's own profile.
 */

import { test } from '../dsl/index.ts';

test('a user can rename themselves', async ({ users, profile }) => {
  await users.register('Alice', { name: 'Alice Smith' });
  await profile.shouldHaveName('Alice Smith');

  await profile.rename('Alice Jones');

  await profile.shouldHaveName('Alice Jones');
});

test('a user signs in with their new email after changing it', async ({ users, profile }) => {
  await users.register('Alice');

  await profile.changeEmail();
  await profile.shouldHaveEmailOf('Alice');

  await users.signOut();
  await users.signInAs('Alice');
});

test("a user cannot take another user's email", async ({ users, profile }) => {
  await users.register('Bob');
  await users.register('Alice');

  await profile.changeEmailToThatOf('Bob', { expect: 'email-taken' });

  await profile.shouldHaveEmailOf('Alice');
});

test('a user can keep their own email', async ({ users, profile }) => {
  await users.register('Alice');

  await profile.changeEmailToThatOf('Alice');

  await profile.shouldHaveEmailOf('Alice');
});

test('an email is kept in lower case', async ({ users, profile }) => {
  await users.register('Alice');

  await profile.changeEmail({ to: 'in-capitals' });

  await profile.shouldHaveEmailOf('Alice');
  await users.signOut();
  await users.signInAs('Alice');
});

test('a profile email must be well-formed', async ({ users, profile }) => {
  await users.register('Alice');

  await profile.changeEmail({ to: 'malformed', expect: 'invalid-input' });

  await profile.shouldHaveEmailOf('Alice');
});

test('a profile email can be as long as the limit allows', async ({ users, profile, knownBug }) => {
  knownBug('habitcraft-0roi');
  await users.register('Alice');

  await profile.changeEmail({ to: 'longest-allowed' });

  await profile.shouldHaveEmailOf('Alice');
});

test('a profile email over the limit is refused', async ({ users, profile }) => {
  await users.register('Alice');

  await profile.changeEmail({ to: 'too-long', expect: 'invalid-input' });

  await profile.shouldHaveEmailOf('Alice');
});

test('a name can be as long as the limit allows, and no longer', async ({ users, profile }) => {
  await users.register('Alice', { name: 'Alice Smith' });

  await profile.rename({ length: 'longest-allowed' });
  await profile.shouldHaveName({ length: 'longest-allowed' });

  await profile.rename({ length: 'too-long' }, { expect: 'invalid-input' });
  await profile.shouldHaveName({ length: 'longest-allowed' });
});

test('a name cannot be blank', async ({ users, profile }) => {
  await users.register('Alice', { name: 'Alice Smith' });

  await profile.rename('', { expect: 'invalid-input' });

  await profile.shouldHaveName('Alice Smith');
});
