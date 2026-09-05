/**
 * Unit tests for the response validator and its coverage bookkeeping.
 *
 * The coverage file path is redirected to a scratch file per test so these
 * never disturb a real integration run's record.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const VALID_HABIT = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  userId: '11111111-1111-1111-1111-111111111111',
  name: 'Morning Exercise',
  description: null,
  color: '#3B82F6',
  icon: '🏃',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  completions: [],
};

const LIST_HABITS = {
  method: 'GET',
  urlPath: '/api/v1/habits',
  statusCode: 200,
  isJson: true,
  hasBody: true,
};

describe('openapi/responseValidator', () => {
  let scratchDir;
  let validator;

  beforeEach(() => {
    scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openapi-cov-'));
    process.env.OPENAPI_COVERAGE_FILE = path.join(scratchDir, 'coverage.json');

    // Fresh module registry per test: `covered` is module state, and one
    // test's requests must not show up in another's coverage report.
    jest.resetModules();
    validator = require('./responseValidator');
  });

  afterEach(() => {
    delete process.env.OPENAPI_COVERAGE_FILE;
    fs.rmSync(scratchDir, { recursive: true, force: true });
  });

  describe('checkResponse', () => {
    it('records nothing for a response that matches the spec', () => {
      validator.checkResponse({ ...LIST_HABITS, body: [VALID_HABIT] });

      expect(validator.drainViolations()).toEqual([]);
    });

    it('rejects a renamed field, naming both halves of the rename', () => {
      const renamed = { ...VALID_HABIT, user_id: VALID_HABIT.userId };
      delete renamed.userId;

      validator.checkResponse({ ...LIST_HABITS, body: [renamed] });
      const [violation] = validator.drainViolations();

      expect(violation).toContain("must have required property 'userId'");
      expect(violation).toContain("must NOT have additional properties: 'user_id'");
    });

    it('rejects a field the spec does not document', () => {
      validator.checkResponse({ ...LIST_HABITS, body: [{ ...VALID_HABIT, streak: 7 }] });

      expect(validator.drainViolations()[0]).toContain("additional properties: 'streak'");
    });

    it('rejects a field of the wrong type', () => {
      validator.checkResponse({ ...LIST_HABITS, body: [{ ...VALID_HABIT, status: 'paused' }] });

      expect(validator.drainViolations()[0]).toContain(
        'must be equal to one of the allowed values'
      );
    });

    it('accepts null where the spec marks a field nullable', () => {
      validator.checkResponse({
        ...LIST_HABITS,
        body: [{ ...VALID_HABIT, completions: [] }],
      });

      expect(validator.drainViolations()).toEqual([]);
    });

    it('includes the offending body so the failure is actionable', () => {
      validator.checkResponse({ ...LIST_HABITS, body: [{ ...VALID_HABIT, streak: 7 }] });

      expect(validator.drainViolations()[0]).toContain('"streak":7');
    });

    it('rejects a status the operation does not document, listing the ones it does', () => {
      validator.checkResponse({ ...LIST_HABITS, statusCode: 418, body: { error: 'teapot' } });
      const [violation] = validator.drainViolations();

      expect(violation).toContain('status not documented');
      expect(violation).toContain('200, 401, 500');
    });

    it('rejects a path the spec never mentions', () => {
      validator.checkResponse({ ...LIST_HABITS, urlPath: '/api/v1/nope', body: {} });

      expect(validator.drainViolations()[0]).toContain('path not documented');
    });

    it('distinguishes an undocumented method from an undocumented path', () => {
      validator.checkResponse({ ...LIST_HABITS, method: 'PATCH', body: {} });

      expect(validator.drainViolations()[0]).toContain('method not documented for this path');
    });

    it('rejects a body on a status documented as bodiless', () => {
      validator.checkResponse({
        method: 'DELETE',
        urlPath: '/api/v1/habits/abc',
        statusCode: 204,
        isJson: true,
        hasBody: true,
        body: { surprise: 1 },
      });

      expect(validator.drainViolations()[0]).toContain('spec documents no response body');
    });

    it('accepts an empty body on a status documented as bodiless', () => {
      validator.checkResponse({
        method: 'DELETE',
        urlPath: '/api/v1/habits/abc',
        statusCode: 204,
        isJson: false,
        hasBody: false,
        body: '',
      });

      expect(validator.drainViolations()).toEqual([]);
    });

    it('rejects a non-JSON body where the spec documents JSON', () => {
      validator.checkResponse({
        ...LIST_HABITS,
        isJson: false,
        body: '<html>Cannot GET</html>',
      });

      expect(validator.drainViolations()[0]).toContain('was not JSON');
    });
  });

  describe('drainViolations', () => {
    it('clears the list so each test only sees its own failures', () => {
      validator.checkResponse({ ...LIST_HABITS, urlPath: '/api/v1/nope', body: {} });

      expect(validator.drainViolations()).toHaveLength(1);
      expect(validator.drainViolations()).toEqual([]);
    });
  });

  describe('coverage bookkeeping', () => {
    it('records the operation template, not the concrete path', () => {
      validator.checkResponse({
        method: 'DELETE',
        urlPath: '/api/v1/habits/aaaa-bbbb',
        statusCode: 204,
        isJson: false,
        hasBody: false,
        body: '',
      });
      validator.flushCoverage('/repo/backend/integration/habits.test.js');

      const written = JSON.parse(fs.readFileSync(validator.getCoverageFile(), 'utf8'));

      expect(written.operations).toContain('DELETE /api/v1/habits/{habitId}');
      expect(written.files).toEqual(['habits.test.js']);
    });

    it('counts an operation as covered even when the response failed validation', () => {
      // Otherwise a broken endpoint would report as untested as well as
      // broken, and the second message would drown the first.
      validator.checkResponse({ ...LIST_HABITS, body: [{ ...VALID_HABIT, streak: 7 }] });
      validator.drainViolations();
      validator.flushCoverage('habits.test.js');

      expect(validator.readCoverageReport().covered).toContain('GET /api/v1/habits');
    });

    it('merges across test files rather than overwriting', () => {
      validator.checkResponse({ ...LIST_HABITS, body: [VALID_HABIT] });
      validator.flushCoverage('habits.test.js');

      jest.resetModules();
      const second = require('./responseValidator');
      second.checkResponse({
        method: 'GET',
        urlPath: '/hello',
        statusCode: 200,
        isJson: true,
        hasBody: true,
        body: { message: 'Hello World!' },
      });
      second.flushCoverage('health.test.js');

      const report = second.readCoverageReport();

      expect(report.files).toEqual(['habits.test.js', 'health.test.js']);
      expect(report.covered).toEqual(expect.arrayContaining(['GET /api/v1/habits', 'GET /hello']));
    });

    it('reports every documented operation as uncovered before anything runs', () => {
      const { covered, uncovered, files } = validator.readCoverageReport();

      expect(covered).toEqual([]);
      expect(files).toEqual([]);
      expect(uncovered).toContain('GET /api/v1/habits');
    });

    it('treats a corrupt coverage file as empty rather than crashing the run', () => {
      fs.writeFileSync(validator.getCoverageFile(), 'not json');

      expect(validator.readCoverageReport().covered).toEqual([]);
    });

    it('resetCoverage deletes the accumulated file', () => {
      validator.checkResponse({ ...LIST_HABITS, body: [VALID_HABIT] });
      validator.flushCoverage('habits.test.js');
      validator.resetCoverage();

      expect(fs.existsSync(validator.getCoverageFile())).toBe(false);
    });

    it('resetCoverage is a no-op when there is no file yet', () => {
      expect(() => validator.resetCoverage()).not.toThrow();
    });

    it('defaults the coverage file to backend/coverage when unconfigured', () => {
      delete process.env.OPENAPI_COVERAGE_FILE;

      expect(validator.getCoverageFile()).toBe(
        path.join(__dirname, '..', 'coverage', 'openapi-coverage.json')
      );
    });
  });

  describe('listIntegrationTestFiles', () => {
    it('lists the integration suite as it exists on disk', () => {
      const files = validator.listIntegrationTestFiles();

      expect(files).toContain('habits.test.js');
      expect(files.every((name) => name.endsWith('.test.js'))).toBe(true);
      expect(files).toEqual([...files].sort());
    });
  });
});
