/**
 * Project root resolution
 *
 * Locates the repo root by walking up from a starting dir until a root marker
 * is found, instead of counting `../` levels from __dirname.
 *
 * Level-counting (e.g. path.resolve(__dirname, '../../..')) hardcodes a file's
 * depth relative to the repo root and breaks *silently* when files or dirs
 * move: the resolved path just points somewhere else, with no import error to
 * catch it. Anchoring to a marker survives relocation at any depth.
 */

const fs = require('fs');
const path = require('path');

// Root-only file: present at the repo root and nowhere below it.
const ROOT_MARKER = 'docker-compose.test.yml';

/**
 * Walk up from startDir to the nearest ancestor containing ROOT_MARKER.
 *
 * @param {string} startDir - Directory to start from (typically __dirname).
 * @returns {string} Absolute path to the project root.
 * @throws {Error} If no ancestor contains the marker.
 */
function findProjectRoot(startDir) {
  let dir = path.resolve(startDir);

  for (;;) {
    if (fs.existsSync(path.join(dir, ROOT_MARKER))) {
      return dir;
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        `Could not locate project root: no ${ROOT_MARKER} found in any ancestor of ${startDir}`
      );
    }
    dir = parent;
  }
}

module.exports = { findProjectRoot, ROOT_MARKER };
