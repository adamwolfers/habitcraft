const fs = require('fs');
const os = require('os');
const path = require('path');

const { findProjectRoot, ROOT_MARKER } = require('./findProjectRoot');

describe('findProjectRoot', () => {
  let tmpRoot;

  beforeEach(() => {
    // realpath: macOS /var/folders symlinks to /private/var, which would make
    // the returned (resolved) path mismatch the raw mkdtemp path.
    tmpRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'findroot-')));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('returns the start dir when the marker is in it', () => {
    fs.writeFileSync(path.join(tmpRoot, ROOT_MARKER), '');

    expect(findProjectRoot(tmpRoot)).toBe(tmpRoot);
  });

  it('walks up any number of levels to find the marker', () => {
    fs.writeFileSync(path.join(tmpRoot, ROOT_MARKER), '');
    const deep = path.join(tmpRoot, 'a', 'b', 'c', 'd');
    fs.mkdirSync(deep, { recursive: true });

    expect(findProjectRoot(deep)).toBe(tmpRoot);
  });

  it('returns the nearest ancestor holding the marker', () => {
    fs.writeFileSync(path.join(tmpRoot, ROOT_MARKER), '');
    const nested = path.join(tmpRoot, 'outer', 'inner');
    fs.mkdirSync(nested, { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, 'outer', ROOT_MARKER), '');

    expect(findProjectRoot(nested)).toBe(path.join(tmpRoot, 'outer'));
  });

  it('resolves relative start dirs', () => {
    fs.writeFileSync(path.join(tmpRoot, ROOT_MARKER), '');
    const cwd = process.cwd();
    process.chdir(tmpRoot);

    try {
      expect(findProjectRoot('.')).toBe(tmpRoot);
    } finally {
      process.chdir(cwd);
    }
  });

  it('throws a descriptive error when no marker exists up to the filesystem root', () => {
    const orphan = path.join(tmpRoot, 'no-marker-here');
    fs.mkdirSync(orphan);

    expect(() => findProjectRoot(orphan)).toThrow(/Could not locate project root/);
    expect(() => findProjectRoot(orphan)).toThrow(new RegExp(ROOT_MARKER));
  });

  it('locates the real repo root from this file', () => {
    const root = findProjectRoot(__dirname);

    expect(fs.existsSync(path.join(root, ROOT_MARKER))).toBe(true);
    expect(fs.existsSync(path.join(root, 'scripts', 'test-db-reset.sh'))).toBe(true);
  });
});
