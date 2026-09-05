/**
 * Validates live HTTP responses against shared/api-spec/openapi.yaml, and
 * records which documented operations were exercised.
 *
 * Wired up by backend/integration/setup.js, which wraps the test HTTP server
 * so EVERY response any integration test provokes passes through here. Nothing
 * in production loads this module.
 *
 * Failures are collected rather than thrown: throwing inside res.json would
 * surface as a 500 from the route under test, blaming the wrong thing. The
 * afterEach hook in jest.integration.setup.js drains the list, so a mismatch
 * fails the specific test that caused it (habitcraft-34d.2).
 */

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const { findOperation, isDocumentedPath, getResponseSchema, getOperations } = require('./spec');

// allErrors so one response reports every field it got wrong, not just the
// first. strict:false because OpenAPI schemas legitimately carry annotation
// keywords (description, format on non-string types) that ajv's strict mode
// rejects outright.
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const compiledSchemas = new Map();

/** Violations seen since the last drain. @type {string[]} */
let violations = [];

/** Operation keys ('GET /api/v1/habits') exercised so far. @type {Set<string>} */
const covered = new Set();

/**
 * Where the accumulated coverage lives.
 *
 * Coverage has to outlive the process: jest gives every test FILE its own
 * module registry, so an in-memory set would only ever see one file's worth of
 * requests. Each file appends here in afterAll; globalTeardown reads the union.
 *
 * Read from the environment on every call so this module's own unit tests can
 * redirect it to a scratch file instead of stomping a real run's record.
 * @returns {string} Absolute path to the coverage file
 */
function getCoverageFile() {
  return (
    process.env.OPENAPI_COVERAGE_FILE ||
    path.join(__dirname, '..', 'coverage', 'openapi-coverage.json')
  );
}

/**
 * Compile (and cache) a response schema.
 * @param {string} cacheKey Stable key for this operation+status
 * @param {object} schema JSON Schema
 * @returns {Function} ajv validate function
 */
function compile(cacheKey, schema) {
  if (!compiledSchemas.has(cacheKey)) {
    compiledSchemas.set(cacheKey, ajv.compile(schema));
  }
  return compiledSchemas.get(cacheKey);
}

/**
 * Render ajv errors as one line each, with the offending value inline so the
 * failure message is actionable without re-running under a debugger.
 * @param {Array} errors ajv error objects
 * @param {*} body The response body
 * @returns {string} Indented, newline-separated detail
 */
function formatErrors(errors, body) {
  return errors
    .map((err) => {
      const where = err.instancePath || '(root)';
      const extra = err.params && err.params.additionalProperty;
      const detail = extra ? `${err.message}: '${extra}'` : err.message;
      return `    ${where} ${detail}`;
    })
    .concat(`    received: ${JSON.stringify(body)}`)
    .join('\n');
}

/**
 * Check one response against the spec, recording any mismatch.
 *
 * @param {object} response Observed response
 * @param {string} response.method HTTP method
 * @param {string} response.urlPath Request path, query string already stripped
 * @param {number} response.statusCode Response status
 * @param {boolean} response.isJson Whether the response declared JSON
 * @param {boolean} response.hasBody Whether any body bytes were written
 * @param {*} response.body Parsed JSON body, when isJson
 * @returns {void}
 */
function checkResponse({ method, urlPath, statusCode, isJson, hasBody, body }) {
  const where = `${method} ${urlPath} -> ${statusCode}`;
  const operation = findOperation(method, urlPath);

  if (!operation) {
    // A request to a path the spec never mentions. Either the spec is missing
    // an endpoint or the test is hitting something that does not exist -- both
    // are worth failing on, since a silent skip is how the old spec stayed
    // wrong.
    const reason = isDocumentedPath(urlPath)
      ? 'method not documented for this path'
      : 'path not documented';
    violations.push(`${where}: ${reason} in openapi.yaml`);
    return;
  }

  covered.add(`${operation.method} ${operation.template}`);

  const { documented, schema } = getResponseSchema(operation, statusCode);

  if (!documented) {
    violations.push(
      `${where}: status not documented for ${operation.method} ${operation.template} ` +
        `(documented: ${Object.keys(operation.responses).join(', ')})`
    );
    return;
  }

  if (!schema) {
    // Documented as bodiless (204). Anything on the wire contradicts that.
    if (hasBody) {
      violations.push(
        `${where}: spec documents no response body, but the handler sent one:\n` +
          `    received: ${JSON.stringify(body)}`
      );
    }
    return;
  }

  if (!isJson) {
    violations.push(
      `${where}: spec documents an application/json body, but the response was not JSON`
    );
    return;
  }

  const validate = compile(`${operation.method} ${operation.template} ${statusCode}`, schema);
  if (!validate(body)) {
    violations.push(
      `${where}: response does not match the spec\n${formatErrors(validate.errors, body)}`
    );
  }
}

/**
 * Return and clear the violations recorded since the last call.
 * @returns {string[]} Violation messages
 */
function drainViolations() {
  const drained = violations;
  violations = [];
  return drained;
}

/**
 * Read the accumulated coverage file, tolerating absence and corruption.
 * @returns {{files: string[], operations: string[]}} Whatever has been recorded
 */
function readCoverageFile() {
  const file = getCoverageFile();
  if (fs.existsSync(file)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      return {
        files: Array.isArray(parsed.files) ? parsed.files : [],
        operations: Array.isArray(parsed.operations) ? parsed.operations : [],
      };
    } catch {
      /* fall through to the empty record */
    }
  }
  return { files: [], operations: [] };
}

/**
 * Append this test file's coverage to the shared coverage file.
 *
 * The file records which test FILES contributed as well as which operations
 * they hit. globalTeardown needs the former to tell a full run from a filtered
 * one: missing coverage means something only when every test file ran.
 *
 * Read-modify-write is safe because jest.integration.config.js pins
 * maxWorkers: 1, so test files never run concurrently.
 *
 * @param {string} testFile Absolute path of the test file that just finished
 * @returns {void}
 */
function flushCoverage(testFile) {
  const file = getCoverageFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const existing = readCoverageFile();
  const record = {
    files: Array.from(new Set([...existing.files, path.basename(testFile || '')])).sort(),
    operations: Array.from(new Set([...existing.operations, ...covered])).sort(),
  };

  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
}

/**
 * Compare the accumulated coverage against everything the spec documents.
 * @returns {{covered: string[], uncovered: string[], files: string[]}} Report
 */
function readCoverageReport() {
  const { files, operations } = readCoverageFile();
  const seen = new Set(operations);
  const documented = getOperations().map((op) => `${op.method} ${op.template}`);

  return {
    covered: documented.filter((key) => seen.has(key)),
    uncovered: documented.filter((key) => !seen.has(key)),
    files,
  };
}

/**
 * Every integration test file on disk, by basename.
 *
 * globalTeardown compares this against the files that reported coverage. If
 * they differ, the run was narrowed (a path filter, a bail, a crash) and an
 * unexercised operation proves nothing.
 * @returns {string[]} Sorted basenames
 */
function listIntegrationTestFiles() {
  const dir = path.join(__dirname, '..', 'integration');
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.test.js'))
    .sort();
}

/**
 * Delete the accumulated coverage file so a run starts from zero.
 * @returns {void}
 */
function resetCoverage() {
  fs.rmSync(getCoverageFile(), { force: true });
}

module.exports = {
  getCoverageFile,
  checkResponse,
  drainViolations,
  flushCoverage,
  readCoverageReport,
  listIntegrationTestFiles,
  resetCoverage,
};
