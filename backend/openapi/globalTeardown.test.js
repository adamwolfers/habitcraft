/**
 * Unit tests for the OpenAPI coverage gate that closes the integration run.
 *
 * The distinction that matters here is full run vs. filtered run: a filtered
 * run must REPORT missing coverage without failing, or `npm run
 * test:integration -- habits.test.js` would be unusable.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

describe('openapi/globalTeardown', () => {
  let scratchDir;
  let globalTeardown;
  let validator;
  let logSpy;

  /**
   * Write a coverage record as the suite would have left it.
   * @param {object} record What to write
   * @param {string[]} record.files Test file basenames that reported
   * @param {string[]} record.operations Operation keys exercised
   * @returns {void}
   */
  function writeCoverage({ files, operations }) {
    fs.writeFileSync(validator.getCoverageFile(), JSON.stringify({ files, operations }));
  }

  /**
   * Every operation the spec documents -- i.e. full coverage.
   *
   * Read from the spec rather than hard-coded, so adding an endpoint does not
   * break these tests for reasons that have nothing to do with them.
   * @returns {string[]} Operation keys
   */
  function allOperations() {
    return validator.readCoverageReport().uncovered;
  }

  beforeEach(() => {
    scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openapi-teardown-'));
    process.env.OPENAPI_COVERAGE_FILE = path.join(scratchDir, 'coverage.json');

    jest.resetModules();
    validator = require('./responseValidator');
    globalTeardown = require('./globalTeardown');
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    delete process.env.OPENAPI_COVERAGE_FILE;
    fs.rmSync(scratchDir, { recursive: true, force: true });
  });

  it('passes quietly when every documented operation was exercised', () => {
    const documented = allOperations();
    writeCoverage({ files: validator.listIntegrationTestFiles(), operations: documented });

    expect(() => globalTeardown()).not.toThrow();
    expect(logSpy.mock.calls.flat().join('\n')).toContain(
      `OpenAPI operation coverage: ${documented.length}/${documented.length}`
    );
  });

  it('fails a full run that left an operation unexercised, naming it', () => {
    const operations = allOperations().filter((key) => key !== 'GET /api/v1/habits');
    writeCoverage({ files: validator.listIntegrationTestFiles(), operations });

    expect(() => globalTeardown()).toThrow(/GET \/api\/v1\/habits/);
    expect(() => globalTeardown()).toThrow(/not\s+exercised by any integration test/);
  });

  it('only reports when a test file did not run, since the run was narrowed', () => {
    // `npm run test:integration -- habits.test.js` must not fail on the
    // operations the files it skipped would have covered.
    writeCoverage({ files: ['habits.test.js'], operations: ['GET /api/v1/habits'] });

    expect(() => globalTeardown()).not.toThrow();

    const logged = logSpy.mock.calls.flat().join('\n');
    expect(logged).toContain('not a full run');
    expect(logged).toContain('auth.test.js');
  });

  it('reports zero coverage without throwing when no test file reported at all', () => {
    const total = allOperations().length;

    expect(() => globalTeardown()).not.toThrow();
    expect(logSpy.mock.calls.flat().join('\n')).toContain(`coverage: 0/${total}`);
  });
});

describe('openapi/globalSetup', () => {
  let scratchDir;

  beforeEach(() => {
    scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openapi-setup-'));
    process.env.OPENAPI_COVERAGE_FILE = path.join(scratchDir, 'coverage.json');
    jest.resetModules();
  });

  afterEach(() => {
    delete process.env.OPENAPI_COVERAGE_FILE;
    fs.rmSync(scratchDir, { recursive: true, force: true });
  });

  it("clears a previous run's coverage so it cannot satisfy this run", () => {
    const file = process.env.OPENAPI_COVERAGE_FILE;
    fs.writeFileSync(file, '{"files":["stale.test.js"],"operations":[]}');

    require('./globalSetup')();

    expect(fs.existsSync(file)).toBe(false);
  });
});
