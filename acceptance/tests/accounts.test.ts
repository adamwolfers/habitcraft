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

test('registration needs a well-formed email address', async ({ users }) => {
  await users.register('Alice', { email: 'malformed', expect: 'invalid-input' });
});

test('registration needs a long enough password', async ({ users }) => {
  await users.register('Alice', { password: 'too-short', expect: 'invalid-input' });
});

test('an email address as long as the limit allows can register', async ({ users, knownBug }) => {
  knownBug('habitcraft-0roi');

  await users.register('Alice', { email: 'longest-allowed' });
  await users.signOut();

  await users.signInAs('Alice');
});

test('an email address over the limit cannot register', async ({ users }) => {
  await users.register('Alice', { email: 'too-long', expect: 'invalid-input' });
});

test('signing in with an email nobody registered is refused', async ({ users }) => {
  await users.signInAs('Nobody', { expect: 'invalid-credentials' });
});

test('an email address signs in whatever its case', async ({ users }) => {
  await users.register('Alice');
  await users.signOut();

  await users.signInAs('Alice', { withEmail: 'in-capitals' });
  await users.shouldBeSignedIn();
});

test('changing password keeps the user signed in', async ({ users }) => {
  await users.register('Alice');
  await users.changePassword();

  await users.renewSession();
  await users.shouldBeSignedIn();
});

test('a new password must be long enough', async ({ users }) => {
  await users.register('Alice');

  await users.changePassword({ to: 'too-short', expect: 'invalid-input' });

  await users.signOut();
  await users.signInAs('Alice');
});

test("a deleted account's habits go with it", async ({ users, habits }) => {
  await users.register('Alice');
  await habits.create('Morning run');
  await users.deleteAccount();

  await users.register('Alice');

  await habits.shouldNotExist('Morning run');
});
