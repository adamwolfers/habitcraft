const baseConfig = require('./jest.config');

/**
 * The subset of the detox suite that gates CI (habitcraft-bqhe.12).
 *
 * WHY A SUBSET. The suite is serial by configuration (maxWorkers: 1), so test
 * count converts directly into wall clock on the critical path of every
 * relevant push, and habitcraft-5et already names E2E as the pipeline's long
 * pole. A large share of the full suite asserts client-side form validation,
 * which RNTL covers in milliseconds from mocked props -- running it on a
 * device buys nothing. The nine cases marked @smoke are the ones RNTL cannot
 * reach: habit CRUD against the real backend, a real account returning an
 * empty list, the native delete alert, and the keychain actually clearing on
 * logout. Every dropped case was checked against a named RNTL case in
 * mobile/src; the mapping is on habitcraft-bqhe.12.
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
 * TWO KNOWN HOLES, both tracked, both deliberate:
 * - No offline coverage. All six offline cases are unusable until
 *   habitcraft-bqhe.10 lands (setURLBlacklist is a Detox-side request
 *   interceptor and cannot move NetInfo, which reports device connectivity).
 *   Offline sync is real detox-only coverage, so this gate does not cover it.
 * - No session-across-relaunch coverage. habitcraft-bqhe.16 has E2E seeding
 *   re-running on every JS reload, so a reloaded app always comes up signed
 *   in: one Session Persistence case fails and the other cannot fail.
 *   habitcraft-bqhe.18 adds that leg once .16 lands.
 */
module.exports = {
  ...baseConfig,
  // Within-file order is preserved under name filtering, which the empty-state
  // case in habits.test.ts depends on -- it is only true before the first
  // create, so it has to stay ahead of the create case in the same file.
  testNamePattern: '@smoke',
};
