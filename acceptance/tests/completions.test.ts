/**
 * Layer 1: test cases, in the language of checking habits off on days.
 */

import { test } from '../dsl/index.ts';

test('a habit checked off today is done today and only today', async ({
  users,
  habits,
  knownBug,
}) => {
  knownBug('habitcraft-vxln.5');
  await users.register('Alice');
  await habits.create('Morning run');
  await habits.shouldNotBeCheckedOff('Morning run', { on: 'today' });

  await habits.checkOff('Morning run', { on: 'today' });

  await habits.shouldBeCheckedOff('Morning run', { on: 'today' });
  await habits.shouldNotBeCheckedOff('Morning run', { on: 'yesterday' });
});

test('a day can only be checked off once', async ({ users, habits, knownBug }) => {
  knownBug('habitcraft-vxln.5');
  await users.register('Alice');
  await habits.create('Morning run');
  await habits.checkOff('Morning run', { on: 'today' });

  await habits.checkOff('Morning run', { on: 'today', expect: 'already-checked-off' });
});

test('unchecking a day undoes it', async ({ users, habits, knownBug }) => {
  knownBug('habitcraft-vxln.5');
  await users.register('Alice');
  await habits.create('Morning run');
  await habits.checkOff('Morning run', { on: 'yesterday' });

  await habits.uncheck('Morning run', { on: 'yesterday' });

  await habits.shouldNotBeCheckedOff('Morning run', { on: 'yesterday' });
});

test('a checked-off day can carry a note', async ({ users, habits, knownBug }) => {
  knownBug('habitcraft-vxln.5');
  await users.register('Alice');
  await habits.create('Morning run');

  await habits.checkOff('Morning run', { on: 'today', note: '5k in the rain' });
  await habits.shouldHaveNote('Morning run', { on: 'today', note: '5k in the rain' });

  await habits.setNote('Morning run', { on: 'today', note: '5k, new personal best' });
  await habits.shouldHaveNote('Morning run', { on: 'today', note: '5k, new personal best' });

  await habits.clearNote('Morning run', { on: 'today' });
  await habits.shouldHaveNote('Morning run', { on: 'today', note: null });
});

test('a day in the future cannot be checked off', async ({ users, habits, knownBug }) => {
  knownBug('habitcraft-vxln.5');
  await users.register('Alice');
  await habits.create('Morning run');

  await habits.checkOff('Morning run', { on: 'tomorrow', expect: 'invalid-input' });

  await habits.shouldNotBeCheckedOff('Morning run', { on: 'tomorrow' });
});

test('each day is checked off on its own', async ({ users, habits, knownBug }) => {
  knownBug('habitcraft-vxln.5');
  await users.register('Alice');
  await habits.create('Morning run');
  await habits.checkOff('Morning run', { on: '10 days ago' });
  await habits.checkOff('Morning run', { on: 'yesterday' });
  await habits.checkOff('Morning run', { on: 'today' });

  await habits.uncheck('Morning run', { on: 'yesterday' });

  await habits.shouldBeCheckedOff('Morning run', { on: '10 days ago' });
  await habits.shouldNotBeCheckedOff('Morning run', { on: 'yesterday' });
  await habits.shouldBeCheckedOff('Morning run', { on: 'today' });
});

test('each habit is checked off on its own', async ({ users, habits, knownBug }) => {
  knownBug('habitcraft-vxln.5');
  await users.register('Alice');
  await habits.create('Morning run');
  await habits.create('Read');

  await habits.checkOff('Morning run', { on: 'today' });

  await habits.shouldBeCheckedOff('Morning run', { on: 'today' });
  await habits.shouldNotBeCheckedOff('Read', { on: 'today' });
});

test("one user's check-offs do not touch another's", async ({ users, habits, knownBug }) => {
  knownBug('habitcraft-vxln.5');
  await users.register('Alice');
  await habits.create('Morning run');
  await habits.checkOff('Morning run', { on: 'today' });

  await users.register('Bob');
  await habits.create('Morning run');
  await habits.shouldNotBeCheckedOff('Morning run', { on: 'today' });
  await habits.checkOff('Morning run', { on: 'today' });
  await habits.uncheck('Morning run', { on: 'today' });

  await users.signInAs('Alice');
  await habits.shouldBeCheckedOff('Morning run', { on: 'today' });
});

test('a note can be as long as the limit allows, and no longer', async ({
  users,
  habits,
  knownBug,
}) => {
  knownBug('habitcraft-vxln.5');
  await users.register('Alice');
  await habits.create('Morning run');
  await habits.checkOff('Morning run', { on: 'today' });

  await habits.setNote('Morning run', { on: 'today', note: { length: 'longest-allowed' } });
  await habits.shouldHaveNote('Morning run', { on: 'today', note: { length: 'longest-allowed' } });

  await habits.setNote('Morning run', {
    on: 'today',
    note: { length: 'too-long' },
    expect: 'invalid-input',
  });
  await habits.shouldHaveNote('Morning run', { on: 'today', note: { length: 'longest-allowed' } });
});
