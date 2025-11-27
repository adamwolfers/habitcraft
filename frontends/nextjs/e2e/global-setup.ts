import { execSync } from 'child_process';
import { resolve } from 'path';

/**
 * Global setup for Playwright E2E tests
 *
 * This runs once before all tests and:
 * 1. Resets the test database to a clean state with fixtures
 *
 * Prerequisites:
 * - Test database container must be running (./scripts/test-db-start.sh)
 * - Test backend and frontend must be running (docker compose -f docker-compose.test.yml up)
 */
async function globalSetup() {
  console.log('\n🚀 Setting up E2E tests...\n');

  // Path from frontends/nextjs/e2e/ up to project root
  const projectRoot = resolve(__dirname, '../../..');

  try {
    // Reset test database to clean state with fixtures
    console.log('📦 Resetting test database...');
    execSync(`${projectRoot}/scripts/test-db-reset.sh`, {
      stdio: 'inherit',
      cwd: projectRoot,
    });
    console.log('✅ Test database reset complete\n');
  } catch (error) {
    console.error('❌ Failed to reset test database');
    console.error('Make sure the test database is running: ./scripts/test-db-start.sh');
    throw error;
  }

  // Verify services are accessible
  console.log('🔍 Verifying test services...');

  const services = [
    { name: 'Backend API', url: 'http://localhost:3010/health' },
    { name: 'Frontend', url: 'http://localhost:3110' },
  ];

  for (const service of services) {
    try {
      const response = await fetch(service.url, { method: 'GET' });
      if (response.ok || response.status === 200) {
        console.log(`✅ ${service.name} is accessible`);
      } else {
        throw new Error(`${service.name} returned status ${response.status}`);
      }
    } catch (error) {
      console.error(`❌ ${service.name} is not accessible at ${service.url}`);
      console.error('Make sure test services are running: docker compose -f docker-compose.test.yml up');
      throw error;
    }
  }

  console.log('\n✨ E2E test setup complete!\n');
}

export default globalSetup;
