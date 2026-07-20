/**
 * Global teardown for Playwright E2E tests
 *
 * This runs once after all tests complete.
 * Currently just logs completion - services are left running
 * so developers can inspect state or run tests again.
 */
async function globalTeardown() {
  console.log('\n🏁 E2E tests complete!\n');
  console.log('Note: Test services are still running.');
  console.log('To stop them: docker compose -f docker-compose.test.yml down');
  console.log('To reset database: ./scripts/test-db-reset.sh\n');
}

export default globalTeardown;
