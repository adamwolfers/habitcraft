/**
 * Tests for the review page generator (habitcraft-ser3). The page shows the
 * acceptance tests verbatim, so these pin down the only two things the
 * generator may change, and that it refuses anything it cannot show as is.
 */

import { expect, test } from '@playwright/test';
import { parseTestFile, renderPage } from './render.mjs';

const FILE = `/**
 * Layer 1: test cases, in the language of habits only.
 */

import { test } from '../dsl/index.ts';

test('a new habit is listed', async ({ users, habits }) => {
  await users.register('Alice');

  await habits.create('Morning run');
});

test("a period shows every habit's days", async ({ users, habits, knownBug }) => {
  knownBug('habitcraft-0roi');
  // Read has none
  await habits.shouldShowDays(
    { from: '6 days ago', to: 'today' },
    { 'Morning run': ['today'], Read: [] }
  );
});
`;

test('keeps each title and says where the test is', () => {
  const { scenarios } = parseTestFile(FILE, 'habits.test.ts');

  expect(scenarios.map((s) => [s.title, s.line])).toEqual([
    ['a new habit is listed', 7],
    ["a period shows every habit's days", 13],
  ]);
});

test('drops only await and the trailing semicolons from the steps', () => {
  const { scenarios } = parseTestFile(FILE, 'habits.test.ts');

  expect(scenarios[0].steps).toBe("users.register('Alice')\n\nhabits.create('Morning run')");
  expect(scenarios[1].steps).toBe(
    [
      "knownBug('habitcraft-0roi')",
      '// Read has none',
      'habits.shouldShowDays(',
      "  { from: '6 days ago', to: 'today' },",
      "  { 'Morning run': ['today'], Read: [] }",
      ')',
    ].join('\n')
  );
});

test("keeps the file's own description", () => {
  expect(parseTestFile(FILE, 'habits.test.ts').description).toBe(
    'Layer 1: test cases, in the language of habits only.'
  );
});

test('refuses a statement it would have to leave out', () => {
  const withDescribe = `${FILE}\ntest.describe('later', () => {});\n`;

  expect(() => parseTestFile(withDescribe, 'habits.test.ts')).toThrow(
    /habits\.test\.ts:22: .*test\.describe/
  );
});

test('refuses a title that is not written out', () => {
  const computed = "import { test } from '../dsl/index.ts';\ntest(name, async () => {});\n";

  expect(() => parseTestFile(computed, 'x.test.ts')).toThrow(/x\.test\.ts:2: /);
});

test('shows every scenario on the page, escaped', () => {
  const html = renderPage([
    parseTestFile(FILE, 'habits.test.ts'),
    parseTestFile(FILE.replace('a new habit is listed', 'a <b>bold</b> & new habit'), 'x.test.ts'),
  ]);

  expect(html).toContain('a period shows every habit&#39;s days');
  expect(html).toContain('a &lt;b&gt;bold&lt;/b&gt; &amp; new habit');
  expect(html).not.toContain('<b>bold</b>');
  expect(html).toContain('habits.test.ts:13');
  expect(html).toContain('4 scenarios');
});
