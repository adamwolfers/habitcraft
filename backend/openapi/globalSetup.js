/**
 * Jest globalSetup for the integration suite.
 *
 * Clears the accumulated OpenAPI coverage file. Without this, a previous run's
 * coverage would satisfy this run's check and an endpoint that quietly lost
 * its only test would still look covered.
 * @returns {void}
 */
module.exports = function globalSetup() {
  require('./responseValidator').resetCoverage();
};
