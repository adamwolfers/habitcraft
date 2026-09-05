/**
 * Jest globalTeardown for the integration suite: report OpenAPI operation
 * coverage and fail the run if any documented operation was never exercised.
 *
 * Per-response validation (see responseValidator.js) can only judge responses
 * that actually happened; an endpoint no integration test calls is documented
 * by nobody and checked by nothing. This is the half of the enforcement that
 * catches that (habitcraft-34d.2).
 */

const { readCoverageReport, listIntegrationTestFiles } = require('./responseValidator');

/**
 * Report coverage, and fail a FULL run that left an operation unexercised.
 *
 * Whether the run was full is decided by comparing the test files that
 * reported coverage against the test files on disk, not by reading jest's
 * config: `-t`, a path filter, `--bail` and a crashed suite all narrow the run,
 * and only some of them are visible in globalConfig.
 * @returns {void}
 */
module.exports = function globalTeardown() {
  const { covered, uncovered, files } = readCoverageReport();
  const total = covered.length + uncovered.length;
  const expectedFiles = listIntegrationTestFiles();
  const missingFiles = expectedFiles.filter((name) => !files.includes(name));

  console.log(`\n📋 OpenAPI operation coverage: ${covered.length}/${total} documented operations`);

  if (uncovered.length === 0) {
    return;
  }

  const list = uncovered.map((key) => `  - ${key}`).join('\n');

  if (missingFiles.length > 0) {
    console.log(
      `⏭️  ${uncovered.length} operation(s) unexercised, but ${missingFiles.length} test ` +
        `file(s) did not report (${missingFiles.join(', ')}) -- this was not a full run, ` +
        `so coverage is not enforced:\n${list}`
    );
    return;
  }

  throw new Error(
    `${uncovered.length} operation(s) documented in shared/api-spec/openapi.yaml are not ` +
      `exercised by any integration test:\n${list}\n\n` +
      `Either add an integration test that calls the operation, or remove it from the spec ` +
      `if the endpoint no longer exists. A documented-but-untested operation is a claim ` +
      `nothing checks (habitcraft-34d.2).`
  );
};
