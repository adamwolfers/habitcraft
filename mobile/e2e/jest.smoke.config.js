const baseConfig = require('./jest.config');

/**
 * The subset of the detox suite that gates CI (habitcraft-bqhe.12).
 *
 * WHY A SUBSET. The suite is serial by configuration (maxWorkers: 1), so test
 * count converts directly into wall clock on the critical path of every
 * relevant push, and habitcraft-5et already names E2E as the pipeline's long
 * pole. A large share of the full suite asserts client-side form validation,
 * which RNTL covers in milliseconds from mocked props -- running it on a
 * device buys nothing. The cases marked @smoke are the ones RNTL cannot
 * reach: habit CRUD against the real backend, a real account returning an
 * empty list, the native delete alert, and what a logout, a reload and a
 * process restart each do to the keychain session. Every dropped case was
 * checked against a named RNTL case in mobile/src; the mapping is on
 * habitcraft-bqhe.12.
 *
 * WHY testNamePattern AND NOT A SEPARATE SPEC FILE. A dedicated smoke file
 * would duplicate nine test bodies, and the duplicate is what rots when a
 * screen changes -- exactly the failure mode this epic exists to clean up
 * (a suite no gate ran, quietly broken by earlier green commits).
 *
 * WHY HERE AND NOT `detox test -t`. Detox re-invokes jest through a shell, so
 * a pattern on the command line needs escaping and an unescaped pipe kills the
 * run with EPIPE, exit 127 (habitcraft-bqhe.17). A pattern in a config file
 * never reaches a shell.
 *
 * This gate does not cover everything detox could. What it leaves out, and
 * why, is tracked on habitcraft-bqhe.12 rather than restated here.
 */
module.exports = {
  ...baseConfig,
  // Within-file order is preserved under name filtering, which the empty-state
  // case in habits.test.ts depends on -- it is only true before the first
  // create, so it has to stay ahead of the create case in the same file.
  testNamePattern: '@smoke',
};
