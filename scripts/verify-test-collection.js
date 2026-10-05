#!/usr/bin/env node
'use strict';

/**
 * Verifies that every test-shaped file in the repo is collected by a runner.
 *
 * A file named *.spec.ts in mobile/src, or a *.test.js dropped in a directory
 * its package's config ignores, is never collected -- and the run goes green
 * having not executed it. That is the same silent failure as an E2E shard that
 * ran zero tests (habitcraft-u1o) and a path filter that matched nothing
 * (scripts/verify-ci-filters.js), and nothing else catches it (habitcraft-hxw3).
 *
 * What this checks:
 *   1. Every tracked or untracked-but-not-ignored file matching TEST_SHAPED is
 *      collected by at least one runner of the package that owns it.
 *   2. Every runner collects at least one file, so a runner whose listing
 *      silently broke cannot make the check pass by collecting nothing.
 *
 * How it works: each runner is asked for its own collection (jest
 * --listTests, playwright test --list), so the real configs -- testMatch,
 * testPathIgnorePatterns, testIgnore, next/jest's wrapper -- are what is
 * tested, not a copy of their globs that can drift. Listing needs no database,
 * browser or device.
 *
 * A test-shaped file outside every package has no runner at all, so it always
 * fails. That is the "root" package, which needs no installed dependencies.
 *
 * Usage: node scripts/verify-test-collection.js [package...]
 *   package: backend | frontend | mobile | root   (default: all of them)
 */

const path = require('path');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');

// Either suffix, so a misnamed *.spec.* file is found rather than ignored.
const TEST_SHAPED = /\.(test|spec)\.[cm]?[jt]sx?$/;

// ---------------------------------------------------------------------------
// Runners
//
// Every config that collects tests, per package. A config added to a package
// must be added here, or the files only it collects are reported as orphans.
// ---------------------------------------------------------------------------
const jest = (config) => ({
  label: `jest${config ? ` -c ${config}` : ''}`,
  command: 'node_modules/.bin/jest',
  args: [...(config ? ['-c', config] : []), '--listTests'],
  parse: (stdout) => stdout.split('\n').filter(Boolean),
});

const playwright = (config) => ({
  label: `playwright -c ${config}`,
  command: 'node_modules/.bin/playwright',
  args: ['test', '-c', config, '--list', '--reporter=json'],
  parse: (stdout) => {
    const report = JSON.parse(stdout);
    return report.suites.map((suite) => path.join(report.config.rootDir, suite.file));
  },
});

const PACKAGES = {
  backend: [jest(), jest('jest.integration.config.js')],
  frontend: [jest(), playwright('playwright.config.ts'), playwright('playwright.gcp.config.ts')],
  // jest.smoke.config.js is jest.config.js narrowed by test name, not by file,
  // so it collects the same files and needs no entry of its own.
  mobile: [jest(), jest('e2e/jest.config.js')],
  root: [],
};

// The package that owns a repo-relative path: its first segment, when that is
// a package with runners; anything else belongs to root.
function owningPackage(file) {
  const first = file.split('/')[0];
  const isPackageDir = file.includes('/') && first !== 'root' && Object.hasOwn(PACKAGES, first);
  return isPackageDir ? first : 'root';
}

// Test-shaped files in `files` that `collected` (a Set of repo-relative paths)
// does not contain, restricted to the given packages.
function findUncollected(files, collected, packages) {
  return files.filter(
    (file) =>
      TEST_SHAPED.test(file) && packages.includes(owningPackage(file)) && !collected.has(file),
  );
}

// ---------------------------------------------------------------------------
// Expected behaviour of the classifier, checked before the live sweep so a
// regression in this file fails loudly rather than reporting a false OK.
// [file, collected by a runner?, expected to be reported?]
// ---------------------------------------------------------------------------
const CASES = [
  ['backend/routes/habits.test.js', true, false],
  ['backend/routes/habits.spec.js', false, true], // the misnamed file
  ['backend/routes/habits.js', false, false], // not test-shaped
  ['frontend/e2e/auth.test.ts', true, false],
  ['frontend/components/Foo.test.tsx', false, true], // wrong directory or ignored
  ['mobile/src/screens/Login.spec.tsx', false, true],
  ['mobile/src/lib/api.test.mjs', false, true], // any js/ts extension counts
  ['mobile/e2e/config/perFileSetup.ts', false, false], // harness, not a test
  ['frontend/e2e/gcp-auth.setup.ts', false, false],
  ['scripts/helper.test.js', false, true], // no package runs scripts/
  ['foo.test.js', false, true], // nor the repo root
  ['shared/fixtures.spec.ts', false, true],
];

function selfCheck() {
  const failures = [];
  const files = CASES.map(([file]) => file);
  const collected = new Set(CASES.filter(([, isCollected]) => isCollected).map(([file]) => file));
  const reported = new Set(findUncollected(files, collected, Object.keys(PACKAGES)));
  for (const [file, , expected] of CASES) {
    if (reported.has(file) !== expected) {
      failures.push(`self-check: ${file} should ${expected ? '' : 'not '}be reported`);
    }
  }
  // Scoping: checking only backend must not report another package's file.
  if (findUncollected(['mobile/src/x.spec.ts'], new Set(), ['backend']).length !== 0) {
    failures.push('self-check: a mobile file was reported when checking only backend');
  }
  return failures;
}

function listFiles() {
  const out = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard'],
    { cwd: REPO_ROOT, encoding: 'utf8' },
  );
  return out.split('\n').filter(Boolean);
}

function collect(pkg, failures) {
  const collected = new Set();
  for (const runner of PACKAGES[pkg]) {
    const cwd = path.join(REPO_ROOT, pkg);
    let files;
    try {
      const stdout = execFileSync(runner.command, runner.args, {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 64 * 1024 * 1024,
      });
      files = runner.parse(stdout).map((abs) => path.relative(REPO_ROOT, path.resolve(cwd, abs)));
    } catch (err) {
      failures.push(`${pkg}: ${runner.label} could not list its tests:\n     ${err.message}`);
      continue;
    }
    if (files.length === 0) {
      failures.push(`${pkg}: ${runner.label} collected no files -- its listing is broken`);
    }
    console.log(`  ${pkg}: ${runner.label} collects ${files.length} file(s)`);
    files.forEach((file) => collected.add(file));
  }
  return collected;
}

function main() {
  const requested = process.argv.slice(2);
  const unknown = requested.filter((pkg) => !PACKAGES[pkg]);
  if (unknown.length > 0) {
    console.error(`Unknown package(s): ${unknown.join(', ')}. Known: ${Object.keys(PACKAGES).join(', ')}`);
    process.exit(2);
  }
  const packages = requested.length > 0 ? requested : Object.keys(PACKAGES);

  const failures = selfCheck();
  console.log(`Checked ${CASES.length} classifier cases.`);

  const collected = new Set();
  for (const pkg of packages) {
    collect(pkg, failures).forEach((file) => collected.add(file));
  }

  const files = listFiles();
  const uncollected = findUncollected(files, collected, packages);
  const swept = files.filter((file) => TEST_SHAPED.test(file) && packages.includes(owningPackage(file)));
  console.log(`Swept ${swept.length} test-shaped file(s) in: ${packages.join(', ')}.`);
  for (const file of uncollected) {
    const pkg = owningPackage(file);
    const fix =
      pkg === 'root'
        ? 'Nothing runs tests outside backend/, frontend/ and mobile/; move it into one.'
        : 'Rename it to *.test.* and put it where its package config looks, ' +
          'or add the config that runs it to PACKAGES in this script.';
    failures.push(`${file} looks like a test but no ${pkg} runner collects it. ${fix}`);
  }

  console.log('');
  if (failures.length > 0) {
    console.error(`FAIL: ${failures.length} problem(s) with test collection:\n`);
    failures.forEach((message, i) => console.error(`  ${i + 1}. ${message}\n`));
    process.exit(1);
  }
  console.log('OK: every test-shaped file is collected by a runner.');
}

main();
