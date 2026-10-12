/**
 * Layer 1: test cases, in the language of checking habits off on days.
 */

import { test } from '../dsl/index.ts';

test('a habit checked off today is done today and only today', async ({ users, habits }) => {
  await users.register('Alice');
  await habits.create('Morning run');
  await habits.shouldNotBeCheckedOff('Morning run', { on: 'today' });

  await habits.checkOff('Morning run', { on: 'today' });

  await habits.shouldBeCheckedOff('Morning run', { on: 'today' });
  await habits.shouldNotBeCheckedOff('Morning run', { on: 'yesterday' });
});

test('a day can only be checked off once', async ({ users, habits }) => {
  await users.register('Alice');
  await habits.create('Morning run');
  await habits.checkOff('Morning run', { on: 'today' });

  await habits.checkOff('Morning run', { on: 'today', expect: 'already-checked-off' });
});

test('unchecking a day undoes it', async ({ users, habits }) => {
  await users.register('Alice');
  await habits.create('Morning run');
  await habits.checkOff('Morning run', { on: 'yesterday' });

  await habits.uncheck('Morning run', { on: 'yesterday' });

  await habits.shouldNotBeCheckedOff('Morning run', { on: 'yesterday' });
});

test('a checked-off day can carry a note', async ({ users, habits }) => {
  await users.register('Alice');
  await habits.create('Morning run');

  await habits.checkOff('Morning run', { on: 'today', note: '5k in the rain' });
  await habits.shouldHaveNote('Morning run', { on: 'today', note: '5k in the rain' });

  await habits.setNote('Morning run', { on: 'today', note: '5k, new personal best' });
  await habits.shouldHaveNote('Morning run', { on: 'today', note: '5k, new personal best' });

  await habits.clearNote('Morning run', { on: 'today' });
  await habits.shouldHaveNote('Morning run', { on: 'today', note: null });
});
