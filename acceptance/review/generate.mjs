#!/usr/bin/env node
/**
 * Writes review/acceptance-tests.html from tests/*.test.ts (habitcraft-ser3).
 *
 *   node review/generate.mjs           # regenerate; commit the result
 *   node review/generate.mjs --check   # what CI runs: fail if it is stale
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTestFile, renderPage } from './render.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const testsDir = join(here, '..', 'tests');
const output = join(here, 'acceptance-tests.html');

// Accounts first: every other scenario starts by registering a user.
const ORDER = ['accounts', 'profile', 'habits', 'completions'];
const rank = (file) => {
  const i = ORDER.indexOf(file.replace(/\.test\.ts$/, ''));
  return i === -1 ? ORDER.length : i;
};

const files = readdirSync(testsDir)
  .filter((f) => f.endsWith('.test.ts'))
  .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
  .map((f) => parseTestFile(readFileSync(join(testsDir, f), 'utf8'), f));
const html = renderPage(files);

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(output, 'utf8');
  } catch {}
  if (current !== html) {
    console.error(
      'review/acceptance-tests.html is out of date. Run: cd acceptance && npm run review'
    );
    process.exit(1);
  }
  console.log('review/acceptance-tests.html matches tests/');
} else {
  writeFileSync(output, html);
  console.log(`Wrote review/acceptance-tests.html (${files.length} files)`);
}
