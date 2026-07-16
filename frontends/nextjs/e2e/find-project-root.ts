/**
 * Project root resolution for E2E setup/teardown.
 *
 * Mirrors backend/utils/findProjectRoot.js. The two packages have no shared
 * module graph (no workspace linking), so the walk is duplicated rather than
 * imported across package boundaries.
 *
 * Level-counting (e.g. resolve(__dirname, '../../..')) hardcodes this file's
 * depth relative to the repo root and breaks *silently* when dirs move: the
 * resolved path just points somewhere else, with no import error to catch it.
 */

import { existsSync } from 'fs';
import { dirname, join, resolve } from 'path';

// Root-only file: present at the repo root and nowhere below it.
export const ROOT_MARKER = 'docker-compose.test.yml';

/**
 * Walk up from startDir to the nearest ancestor containing ROOT_MARKER.
 *
 * @param startDir - Directory to start from (typically __dirname).
 * @returns Absolute path to the project root.
 * @throws If no ancestor contains the marker.
 */
export function findProjectRoot(startDir: string): string {
  let dir = resolve(startDir);

  for (;;) {
    if (existsSync(join(dir, ROOT_MARKER))) {
      return dir;
    }

    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(
        `Could not locate project root: no ${ROOT_MARKER} found in any ancestor of ${startDir}`
      );
    }
    dir = parent;
  }
}
