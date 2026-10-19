/**
 * Bugs a system under test is known to have, kept as acceptance tests that
 * say what the product should do.
 *
 * A test case for one of these starts with `knownBug('<bead>')`. On a backend
 * listed below, Playwright then expects the test to fail and reports it as an
 * expected failure; on any other backend it must pass. When the bug is fixed,
 * the test passes where it was expected to fail, and that is reported as a
 * failure, so the entry here cannot outlive the bug.
 *
 * The backend comes from ACCEPTANCE_BACKEND (see playwright.config.ts), since
 * the URL alone does not say which server answers it.
 */

export type Backend = 'node' | 'go';

interface KnownBug {
  /** Where the bug still lives. */
  on: Backend[];
  /** What goes wrong, for the report. */
  summary: string;
}

export const KNOWN_BUGS = {
  'habitcraft-0roi': {
    on: ['node'],
    summary: "an email at the spec's length limit is refused as malformed",
  },
  // Not a bug but a gap: the Go server answers 501 for habits, completions,
  // profile updates and account deletion until this bead lands. Marked the
  // same way so CI can run the whole suite against Go now, and so each test
  // vxln.5 makes pass fails the run until its mark is removed.
  'habitcraft-vxln.5': {
    on: ['go'],
    summary: 'users, habits and completions are not built on the Go server yet',
  },
} satisfies Record<string, KnownBug>;

export type KnownBugId = keyof typeof KNOWN_BUGS;
