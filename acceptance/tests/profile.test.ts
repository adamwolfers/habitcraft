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
