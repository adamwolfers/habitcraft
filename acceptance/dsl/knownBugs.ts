/**
 * Bugs a system under test is known to have, and features it has not built
 * yet, kept as acceptance tests that say what the product should do.
 *
 * A test case for one of these starts with `knownBug('<bead>')`, or with
 * several beads when it needs them all. On a system listed below for any of
 * them, Playwright expects the test to fail and reports it as an expected
 * failure; anywhere else it must pass. When the bug is fixed or the feature
 * lands, the test passes where it was expected to fail, and that is reported
 * as a failure, so the entry here cannot outlive it.
 *
 * The systems are the two backends, from ACCEPTANCE_BACKEND (see
 * playwright.config.ts) since the URL alone does not say which server answers
 * it, and the Vite SPA, for the `spa` project only.
 */

export type Backend = 'node' | 'go';

/** A backend, or the Vite SPA as the client in front of one. */
export type System = Backend | 'spa';

interface KnownBug {
  /** Where the bug still lives, or the feature is still missing. */
  on: System[];
  /** What goes wrong, for the report. */
  summary: string;
}

export const KNOWN_BUGS = {
  'habitcraft-0roi': {
    on: ['node'],
    summary: "an email at the spec's length limit is refused as malformed",
  },
  'habitcraft-vxln.15': {
    on: ['spa'],
    summary: "the SPA has no Dots view to show a period's days",
  },
  'habitcraft-vxln.16': {
    on: ['spa'],
    summary: 'the SPA has no habit detail page to check off or note any day',
  },
} satisfies Record<string, KnownBug>;

export type KnownBugId = keyof typeof KNOWN_BUGS;
