import { clearDeviceSession } from './testSetup';

/**
 * Enforces the suite's one unstated precondition: every spec file starts with
 * no session on the device.
 *
 * WHY THIS IS HERE AND NOT IN EACH SPEC. The bug this closes
 * (habitcraft-bqhe.7) is that the specs *assumed* a logged-out app and nothing
 * made it true. Putting the reset in each beforeAll would leave the same
 * assumption one commit away from returning, because a new spec file can
 * simply forget it. Jest runs setupFilesAfterEnv once per test file, so a
 * top-level beforeAll here runs exactly once per file, before any hook the
 * file registers, and a new file gets it for free.
 *
 * WHY PER FILE RATHER THAN ONCE PER RUN. scripts/prepare-ios-simulator.sh
 * already clears the keychain once before the run, which fixes only whichever
 * file happens to go first; every later file still inherits the previous
 * file's session. Detox runs the files serially (maxWorkers: 1), so that
 * leakage is deterministic and ordered -- the suite would pass or fail
 * depending on file order, which is what made this bug hard to see.
 *
 * This only clears the keychain. Launching is left to the file, because the
 * files disagree about what they want: three seed a session through launch
 * arguments, and auth.test.ts wants the Welcome screen.
 */
beforeAll(async () => {
  clearDeviceSession();
});
