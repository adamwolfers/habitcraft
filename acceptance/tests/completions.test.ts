/**
 * Layer 1: test cases, in the language of checking habits off on days.
 */

import { test } from '../dsl/index.ts';

test('a habit checked off today is done today and only today', async ({
  users,
  habits,
  knownBug,
}) => {
  knownBug('habitcraft-vxln.16');
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

test('unchecking a day undoes it', async ({ users, habits, knownBug }) => {
  knownBug('habitcraft-vxln.16');
  await users.register('Alice');
  await habits.create('Morning run');
  await habits.checkOff('Morning run', { on: 'yesterday' });

  await habits.uncheck('Morning run', { on: 'yesterday' });

  await habits.shouldNotBeCheckedOff('Morning run', { on: 'yesterday' });
});

test('a checked-off day can carry a note', async ({ users, habits, knownBug }) => {
  knownBug('habitcraft-vxln.16');
  await users.register('Alice');
  await habits.create('Morning run');

  await habits.checkOff('Morning run', { on: 'today', note: '5k in the rain' });
  await habits.shouldHaveNote('Morning run', { on: 'today', note: '5k in the rain' });

  await habits.setNote('Morning run', { on: 'today', note: '5k, new personal best' });
  await habits.shouldHaveNote('Morning run', { on: 'today', note: '5k, new personal best' });

  await habits.clearNote('Morning run', { on: 'today' });
  await habits.shouldHaveNote('Morning run', { on: 'today', note: null });
});

test('unchecking a day takes its note with it', async ({ users, habits, knownBug }) => {
  knownBug('habitcraft-vxln.16');
  await users.register('Alice');
  await habits.create('Morning run');
  await habits.checkOff('Morning run', { on: 'today', note: '5k in the rain' });

  await habits.uncheck('Morning run', { on: 'today' });
  await habits.checkOff('Morning run', { on: 'today' });

  await habits.shouldHaveNote('Morning run', { on: 'today', note: null });
});

test('a day in the future cannot be checked off', async ({ users, habits, knownBug }) => {
  knownBug('habitcraft-vxln.16');
  await users.register('Alice');
  await habits.create('Morning run');

  await habits.checkOff('Morning run', { on: 'tomorrow', expect: 'invalid-input' });

  await habits.shouldNotBeCheckedOff('Morning run', { on: 'tomorrow' });
});

test('each day is checked off on its own', async ({ users, habits, knownBug }) => {
  knownBug('habitcraft-vxln.16');
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

test('each habit is checked off on its own', async ({ users, habits }) => {
  await users.register('Alice');
  await habits.create('Morning run');
  await habits.create('Read');

  await habits.checkOff('Morning run', { on: 'today' });

  await habits.shouldBeCheckedOff('Morning run', { on: 'today' });
  await habits.shouldNotBeCheckedOff('Read', { on: 'today' });
});

test("one user's check-offs do not touch another's", async ({ users, habits }) => {
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
  knownBug('habitcraft-vxln.16');
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

test("a period shows every habit's checked-off days in it", async ({ users, habits, knownBug }) => {
  knownBug('habitcraft-vxln.16');
  await users.register('Alice');
  await habits.create('Morning run');
  await habits.create('Read');
  await habits.create('Stretch');
  await habits.checkOff('Morning run', { on: '7 days ago' });
  await habits.checkOff('Morning run', { on: '6 days ago' });
  await habits.checkOff('Morning run', { on: 'yesterday' });
  await habits.checkOff('Morning run', { on: 'today' });
  await habits.checkOff('Read', { on: '3 days ago' });

  await habits.shouldShowDays(
    { from: '6 days ago', to: 'today' },
    {
      'Morning run': ['6 days ago', 'yesterday', 'today'],
      Read: ['3 days ago'],
      Stretch: [],
    }
  );
});

test('a period shows the days checked off today, and not those undone', async ({
  users,
  habits,
}) => {
  await users.register('Alice');
  await habits.create('Morning run');
  await habits.create('Read');
  await habits.create('Stretch');
  await habits.checkOff('Morning run', { on: 'today' });
  await habits.checkOff('Read', { on: 'today' });

  await habits.uncheck('Read', { on: 'today' });

  await habits.shouldShowDays(
    { from: '6 days ago', to: 'today' },
    { 'Morning run': ['today'], Read: [], Stretch: [] }
  );
});

test("a period shows only the acting user's days", async ({ users, habits, knownBug }) => {
  knownBug('habitcraft-vxln.16');
  await users.register('Alice');
  await habits.create('Morning run');
  await habits.checkOff('Morning run', { on: 'yesterday' });

  await users.register('Bob');
  await habits.create('Read');
  await habits.checkOff('Read', { on: 'today' });

  await habits.shouldShowDays({ from: '6 days ago', to: 'today' }, { Read: ['today'] });

  await users.signInAs('Alice');
  await habits.shouldShowDays(
    { from: '6 days ago', to: 'today' },
    { 'Morning run': ['yesterday'] }
  );
});

test('a new habit is measured from the day it started', async ({ users, habits, knownBug }) => {
  knownBug('habitcraft-vxln.16');
  await users.register('Alice');
  await habits.create('Morning run');
  await habits.shouldHaveCompletionRates('Morning run', {
    last30Days: [0, 1],
    last365Days: [0, 1],
  });

  await habits.checkOff('Morning run', { on: 'today' });
  await habits.shouldHaveCompletionRates('Morning run', {
    last30Days: [1, 1],
    last365Days: [1, 1],
  });
});

test('a day checked off before the habit was created starts it earlier', async ({
  users,
  habits,
  knownBug,
}) => {
  knownBug('habitcraft-vxln.16');
  await users.register('Alice');
  await habits.create('Morning run');
  await habits.checkOff('Morning run', { on: '9 days ago' });
  await habits.checkOff('Morning run', { on: '4 days ago' });
  await habits.checkOff('Morning run', { on: 'today' });

  await habits.shouldHaveCompletionRates('Morning run', {
    last30Days: [3, 10],
    last365Days: [3, 10],
  });
});

test('each rate counts only the days in its window', async ({ users, habits, knownBug }) => {
  knownBug('habitcraft-vxln.16');
  await users.register('Alice');
  await habits.create('Morning run');
  await habits.checkOff('Morning run', { on: '400 days ago' });
  await habits.checkOff('Morning run', { on: '100 days ago' });
  await habits.checkOff('Morning run', { on: '30 days ago' });
  await habits.checkOff('Morning run', { on: '29 days ago' });
  await habits.checkOff('Morning run', { on: 'yesterday' });

  await habits.shouldHaveCompletionRates('Morning run', {
    last30Days: [2, 30],
    last365Days: [4, 365],
  });
});

test("a habit's rates count only its own days", async ({ users, habits, knownBug }) => {
  knownBug('habitcraft-vxln.16');
  await users.register('Alice');
  await habits.create('Morning run');
  await habits.create('Read');
  await habits.checkOff('Read', { on: 'today' });

  await users.register('Bob');
  await habits.create('Morning run');
  await habits.checkOff('Morning run', { on: 'today' });

  await users.signInAs('Alice');
  await habits.shouldHaveCompletionRates('Morning run', {
    last30Days: [0, 1],
    last365Days: [0, 1],
  });
});
