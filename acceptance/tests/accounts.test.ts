/**
 * Layer 1: test cases, in the language of users and sessions only.
 */

import { test } from '../dsl/index.ts';

test('a registered user can sign out and back in', async ({ users }) => {
  await users.register('Alice');
  await users.shouldBeSignedIn();

  await users.signOut();
  await users.shouldBeSignedOut();

  await users.signInAs('Alice');
  await users.shouldBeSignedIn();
});

test('an email address can only be registered once', async ({ users }) => {
  await users.register('Alice');
  await users.signOut();

  await users.register('Alice', { expect: 'email-taken' });
});

test('signing in with the wrong password is refused', async ({ users }) => {
  await users.register('Alice');
  await users.signOut();

  await users.signInAs('Alice', { withPassword: 'wrong', expect: 'invalid-credentials' });
});

test('an open session can be renewed, a signed-out one cannot', async ({ users }) => {
  await users.register('Alice');
  await users.renewSession();
  await users.shouldBeSignedIn();

  await users.signOut();
  await users.renewSession({ expect: 'signed-out' });
});

test('after a password change only the new password signs in', async ({ users }) => {
  await users.register('Alice');
  await users.changePassword();
  await users.signOut();

  await users.signInAs('Alice', { withPassword: 'previous', expect: 'invalid-credentials' });
  await users.signInAs('Alice');
});

test('changing password needs the current one', async ({ users }) => {
  await users.register('Alice');

  await users.changePassword({ confirmingWith: 'wrong', expect: 'wrong-password' });

  await users.signOut();
  await users.signInAs('Alice');
});

test('a deleted account can no longer sign in', async ({ users }) => {
  await users.register('Alice');

  await users.deleteAccount({ confirmingWith: 'wrong', expect: 'wrong-password' });
  await users.deleteAccount();

  await users.shouldBeSignedOut();
  await users.signInAs('Alice', { expect: 'invalid-credentials' });
});
