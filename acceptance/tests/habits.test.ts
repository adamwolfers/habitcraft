/**
 * Layer 1: test cases, in the language of habits and days only.
 */

import { test } from '../dsl/index.ts';

test('a new habit is listed and can be checked off today', async ({ users, habits }) => {
  await users.register('Alice');
  await habits.create('Morning run');

  await habits.shouldInclude('Morning run');
  await habits.shouldNotBeCheckedOff('Morning run', { on: 'today' });

  await habits.checkOff('Morning run', { on: 'today' });

  await habits.shouldBeCheckedOff('Morning run', { on: 'today' });
  await habits.shouldNotBeCheckedOff('Morning run', { on: 'yesterday' });
});

test("one user's habits are not visible to another", async ({ users, habits }) => {
  await users.register('Alice');
  await habits.create('Morning run');

  await users.register('Bob');

  await habits.shouldNotInclude('Morning run');
});
