/**
 * Layer 1: test cases, in the language of habits only.
 */

import { test } from '../dsl/index.ts';

test('a new habit is listed', async ({ users, habits }) => {
  await users.register('Alice');

  await habits.create('Morning run');

  await habits.shouldInclude('Morning run');
});

test('a habit needs a name', async ({ users, habits }) => {
  await users.register('Alice');

  await habits.create('', { expect: 'invalid-input' });
});

test('a renamed habit keeps its history', async ({ users, habits, knownBug }) => {
  knownBug('habitcraft-vxln.16');
  await users.register('Alice');
  await habits.create('Morning run');
  await habits.checkOff('Morning run', { on: 'yesterday' });

  await habits.rename('Morning run', { to: 'Evening run' });

  await habits.shouldNotInclude('Morning run');
  await habits.shouldInclude('Evening run');
  await habits.shouldBeCheckedOff('Evening run', { on: 'yesterday' });
});

test('an archived habit leaves the list and can be restored', async ({ users, habits }) => {
  await users.register('Alice');
  await habits.create('Morning run');

  await habits.archive('Morning run');
  await habits.shouldBeArchived('Morning run');

  await habits.restore('Morning run');
  await habits.shouldInclude('Morning run');
});

test('a deleted habit is gone', async ({ users, habits }) => {
  await users.register('Alice');
  await habits.create('Morning run');

  await habits.delete('Morning run');

  await habits.shouldNotExist('Morning run');
});

test("one user's habits are not visible to another", async ({ users, habits }) => {
  await users.register('Alice');
  await habits.create('Morning run');

  await users.register('Bob');

  await habits.shouldNotExist('Morning run');
});

test('a habit name has a length limit', async ({ users, habits }) => {
  await users.register('Alice');

  await habits.create({ length: 'too-long' }, { expect: 'invalid-input' });
});

test("deleting a habit leaves the other habits' days alone", async ({
  users,
  habits,
  knownBug,
}) => {
  knownBug('habitcraft-vxln.14');
  await users.register('Alice');
  await habits.create('Morning run');
  await habits.create('Read');
  await habits.checkOff('Morning run', { on: 'today' });
  await habits.checkOff('Read', { on: 'today' });

  await habits.delete('Morning run');

  await habits.shouldBeCheckedOff('Read', { on: 'today' });
});
