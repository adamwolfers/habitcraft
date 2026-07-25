#!/usr/bin/env node
'use strict';

/**
 * Verifies the path-filter configuration in .github/workflows/ci.yml.
 *
 * The detect-changes filter block is subtle enough that reading it does not
 * reveal defects: patterns that match nothing, and files that trigger the
 * workflow while matching no filter (a green run that tests nothing), both
 * degrade CI silently rather than failing loudly.
 *
 * What this checks:
 *   1. A table of representative files produces the expected trigger decision
 *      and the expected set of true filter outputs.
 *   2. No filter is dead -- every filter is matched by at least one case.
 *   3. No tracked file triggers the workflow while matching zero filters.
 *
 * How it works: the live `filters: |` block, the `predicate-quantifier`, and
 * the push trigger's `paths-ignore` list are parsed out of ci.yml itself, so
 * this tests the real config rather than a copy that can drift. Patterns are
 * evaluated with picomatch (the library dorny/paths-filter uses) with
 * { dot: true }, and per-pattern results are combined with .every() or .some()
 * to mirror the action's own predicate-quantifier handling.
 *
 * Scope: this verifies PATTERN SEMANTICS only. It cannot verify GitHub's own
 * paths-ignore evaluation or the action's git diff behaviour, so it
 * complements a real push rather than replacing one.
 *
 * Usage: node scripts/verify-ci-filters.js [path/to/ci.yml]
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const picomatch = require('picomatch');

const REPO_ROOT = path.resolve(__dirname, '..');
const WORKFLOW_PATH = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(REPO_ROOT, '.github', 'workflows', 'ci.yml');

// ---------------------------------------------------------------------------
// Expected behaviour
//
// trigger: does the push/pull_request paths-ignore list let this file start
//          the workflow at all?
// filters: exactly which detect-changes outputs are 'true' for it.
// ---------------------------------------------------------------------------
const CASES = [
  // --- Backend: tests count as a change, but must not ship a revision ------
  ['backend/routes/habits.js', true, ['backend', 'backend-deploy']],
  ['backend/routes/habits.test.js', true, ['backend']],
  ['backend/integration/habits.integration.test.js', true, ['backend']],
  ['backend/jest.config.js', true, ['backend']],
  ['backend/.env.test', true, ['backend']],

  // --- Frontend: same split -------------------------------------------------
  ['frontend/app/page.tsx', true, ['frontend', 'frontend-deploy']],
  ['frontend/app/page.test.tsx', true, ['frontend']],
  ['frontend/e2e/auth.spec.ts', true, ['frontend']],
  ['frontend/playwright.config.ts', true, ['frontend']],
  ['frontend/.env.test', true, ['frontend']],

  // --- Other packages -------------------------------------------------------
  ['mobile/app/index.tsx', true, ['mobile']],
  ['db/migrations/20250101000000_init.sql', true, ['db']],
  ['shared/database/test-fixtures.sql', true, ['shared']],
  ['shared/types/habit.ts', true, ['shared']],

  // --- e2e-infra ------------------------------------------------------------
  // Regression: under predicate-quantifier 'every' these three alternatives
  // were once three separate patterns, which no file could satisfy at once --
  // the filter matched NOTHING. They must stay a single extglob.
  ['docker-compose.test.yml', true, ['e2e-infra']],
  ['docker-compose.yml', true, ['e2e-infra']],
  ['docker-bake.test.hcl', true, ['e2e-infra']],
  ['backend/Dockerfile', true, ['backend', 'backend-deploy', 'e2e-infra']],
  ['frontend/Dockerfile.dev', true, ['frontend', 'frontend-deploy', 'e2e-infra']],

  // --- tooling: repo-level files that belong to no single package -----------
  ['scripts/test-all.sh', true, ['tooling']],
  ['scripts/verify-ci-filters.js', true, ['tooling']], // this harness gates itself
  ['.husky/pre-commit', true, ['tooling']], // dotfile: requires { dot: true }
  ['package.json', true, ['tooling']],
  ['package-lock.json', true, ['tooling']],
  ['backend/package.json', true, ['backend', 'backend-deploy']], // not root tooling

  // --- workflow -------------------------------------------------------------
  ['.github/workflows/ci.yml', true, ['workflow']],
  // Regression: link-check.yml triggered ci.yml while matching no filter --
  // a green run that tested nothing. It must be in paths-ignore.
  ['.github/workflows/link-check.yml', false, []],

  // --- Markdown: ignored at the trigger, and matched by no filter -----------
  // The six READMEs that live inside package directories. Each matches a
  // package pattern on path alone, so only '!**/*.md' plus paths-ignore keeps
  // a README edit from firing migrations and deploys.
  ['backend/README.md', false, []],
  ['backend/db/README.md', false, []],
  ['frontend/README.md', false, []],
  ['db/README.md', false, []],
  ['shared/database/README.md', false, []],
  ['shared/types/README.md', false, []],
  ['README.md', false, []],
  ['docs/architecture.md', false, []],

  // --- Other paths that must not start the workflow -------------------------
  ['.beads/issues.jsonl', false, []],
  ['infrastructure/main.tf', false, []],
  ['.claude/settings.json', false, []],
  ['.gitattributes', false, []],
  ['.git-blame-ignore-revs', false, []],
  ['.dbmaterc', false, []],
  ['lychee.toml', false, []],
  ['LICENSE', false, []],
  ['.gitignore', false, []],
  ['docker-compose.override.yml.example', false, []],
];

// ---------------------------------------------------------------------------
// Parsing ci.yml
// ---------------------------------------------------------------------------

/** Indentation width of a line, or null for blank/comment-only lines. */
function indentOf(line) {
  if (line.trim() === '' || line.trim().startsWith('#')) return null;
  return line.length - line.trimStart().length;
}

function fail(message) {
  throw new Error(`${message}\n  (workflow: ${WORKFLOW_PATH})`);
}

/** Lines of the block that follows `header`, i.e. all lines indented deeper. */
function blockAfter(lines, headerIndex) {
  const headerIndent = indentOf(lines[headerIndex]);
  const block = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const indent = indentOf(lines[i]);
    if (indent === null) {
      block.push(lines[i]);
      continue;
    }
    if (indent <= headerIndent) break;
    block.push(lines[i]);
  }
  return block;
}

function unquote(value) {
  const trimmed = value.trim();
  const quoted = /^'(.*)'$/.exec(trimmed) || /^"(.*)"$/.exec(trimmed);
  return quoted ? quoted[1] : trimmed;
}

/** The `paths-ignore:` list inside the `push:` trigger. */
function parsePathsIgnore(lines) {
  const pushIndex = lines.findIndex((l) => /^ {2}push:\s*$/.test(l));
  if (pushIndex === -1) fail("Could not find the 'push:' trigger");

  const pushBlock = blockAfter(lines, pushIndex);
  const ignoreIndex = pushBlock.findIndex((l) => /^\s*paths-ignore:\s*$/.test(l));
  if (ignoreIndex === -1) fail("Could not find 'paths-ignore:' under the push trigger");

  const patterns = blockAfter(pushBlock, ignoreIndex)
    .filter((l) => indentOf(l) !== null)
    .map((l) => {
      const item = /^\s*-\s+(.*)$/.exec(l);
      if (!item) fail(`Unparsable paths-ignore entry: ${l}`);
      return unquote(item[1]);
    });

  if (patterns.length === 0) fail('paths-ignore list parsed as empty');
  return patterns;
}

function parseQuantifier(text) {
  const match = /predicate-quantifier:\s*'?([a-z]+)'?/.exec(text);
  if (!match) fail("Could not find 'predicate-quantifier'");
  if (match[1] !== 'every' && match[1] !== 'some') {
    fail(`Unknown predicate-quantifier: ${match[1]}`);
  }
  return match[1];
}

/** The `filters: |` block scalar, as { name: [patterns] } in file order. */
function parseFilters(lines) {
  const filtersIndex = lines.findIndex((l) => /^\s*filters:\s*\|\s*$/.test(l));
  if (filtersIndex === -1) fail("Could not find the 'filters: |' block");

  const filters = new Map();
  let current = null;

  for (const line of blockAfter(lines, filtersIndex)) {
    if (indentOf(line) === null) continue;

    const name = /^\s*([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (name) {
      current = name[1];
      filters.set(current, []);
      continue;
    }

    const item = /^\s*-\s+(.*)$/.exec(line);
    if (item) {
      if (!current) fail(`Pattern outside any filter: ${line}`);
      filters.get(current).push(unquote(item[1]));
      continue;
    }

    fail(`Unparsable line in filters block: ${line}`);
  }

  if (filters.size === 0) fail('filters block parsed as empty');
  for (const [name, patterns] of filters) {
    if (patterns.length === 0) fail(`Filter '${name}' has no patterns`);
  }
  return filters;
}

// ---------------------------------------------------------------------------
// Evaluation -- mirrors dorny/paths-filter
// ---------------------------------------------------------------------------

const matcherCache = new Map();
function matches(pattern, file) {
  if (!matcherCache.has(pattern)) {
    matcherCache.set(pattern, picomatch(pattern, { dot: true }));
  }
  return matcherCache.get(pattern)(file);
}

function makeEvaluator(config) {
  const combine = config.quantifier === 'every' ? 'every' : 'some';
  return {
    /** Does GitHub start the workflow for a push touching only this file? */
    triggers(file) {
      return !config.pathsIgnore.some((pattern) => matches(pattern, file));
    },
    /** Which detect-changes outputs are 'true' for this file. */
    filtersFor(file) {
      const matched = [];
      for (const [name, patterns] of config.filters) {
        if (patterns[combine]((pattern) => matches(pattern, file))) matched.push(name);
      }
      return matched;
    },
  };
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

const failures = [];
function check(ok, message) {
  if (!ok) failures.push(message);
}

function sameSet(actual, expected) {
  const a = [...actual].sort();
  const b = [...expected].sort();
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function trackedFiles() {
  const output = execFileSync('git', ['ls-files', '-z'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  return output.split('\0').filter(Boolean);
}

function main() {
  const text = fs.readFileSync(WORKFLOW_PATH, 'utf8');
  const lines = text.split('\n');

  const config = {
    pathsIgnore: parsePathsIgnore(lines),
    quantifier: parseQuantifier(text),
    filters: parseFilters(lines),
  };
  const evaluator = makeEvaluator(config);
  const filterNames = [...config.filters.keys()];

  console.log(`Parsed ${path.relative(REPO_ROOT, WORKFLOW_PATH)}:`);
  console.log(`  predicate-quantifier: ${config.quantifier}`);
  console.log(`  filters: ${filterNames.join(', ')}`);
  console.log(`  paths-ignore entries: ${config.pathsIgnore.length}`);
  console.log('');

  // 1. Case table.
  const exercised = new Set();
  for (const [file, expectedTrigger, expectedFilters] of CASES) {
    for (const name of expectedFilters) {
      check(
        filterNames.includes(name),
        `case '${file}' expects unknown filter '${name}' -- filter renamed or removed?`
      );
    }

    const actualTrigger = evaluator.triggers(file);
    check(
      actualTrigger === expectedTrigger,
      `${file}: expected workflow trigger=${expectedTrigger}, got ${actualTrigger}`
    );

    const actualFilters = evaluator.filtersFor(file);
    actualFilters.forEach((name) => exercised.add(name));
    check(
      sameSet(actualFilters, expectedFilters),
      `${file}: expected filters [${[...expectedFilters].sort().join(', ')}], ` +
        `got [${[...actualFilters].sort().join(', ')}]`
    );
  }
  console.log(`Checked ${CASES.length} filter cases.`);

  // 2. No dead filters.
  for (const name of filterNames) {
    check(
      exercised.has(name),
      `filter '${name}' matched none of the ${CASES.length} cases -- it is dead ` +
        `(or needs a case). Under 'every', multiple positive patterns can never ` +
        `all match one file; express alternatives as one extglob '@(a|b|c)'.`
    );
  }
  console.log(`Checked ${filterNames.length} filters for dead patterns.`);

  // 3. No tracked file triggers the workflow while matching zero filters.
  const tracked = trackedFiles();
  const orphans = tracked.filter(
    (file) => evaluator.triggers(file) && evaluator.filtersFor(file).length === 0
  );
  check(
    orphans.length === 0,
    `${orphans.length} tracked file(s) trigger CI but match no filter, so every ` +
      `job is skipped -- a green run that verified nothing. Add them to ` +
      `paths-ignore, or widen a filter:\n    ` +
      orphans.slice(0, 20).join('\n    ') +
      (orphans.length > 20 ? `\n    ... and ${orphans.length - 20} more` : '')
  );
  console.log(`Swept ${tracked.length} tracked files for no-op triggers.`);
  console.log('');

  if (failures.length > 0) {
    console.error(`FAIL: ${failures.length} problem(s) in ci.yml path filters:\n`);
    failures.forEach((message, i) => console.error(`  ${i + 1}. ${message}\n`));
    process.exit(1);
  }
  console.log('OK: ci.yml path filters behave as expected.');
}

try {
  main();
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
}
