/**
 * Global setup for GCP E2E tests
 *
 * This runs once before all tests and verifies GCP services are accessible.
 * Unlike the local setup, this does NOT reset the database.
 */

// Use Cloud Run URLs directly (before DNS cutover) or custom domains (after cutover)
const USE_CLOUDRUN_URLS = process.env.USE_CLOUDRUN_URLS === '1';

const GCP_FRONTEND_URL = USE_CLOUDRUN_URLS
  ? 'https://habitcraft-frontend-iz7ggma5ga-uc.a.run.app'
  : 'https://www.habitcraft.org';
const GCP_BACKEND_URL = USE_CLOUDRUN_URLS
  ? 'https://habitcraft-backend-iz7ggma5ga-uc.a.run.app'
  : 'https://api.habitcraft.org';

async function globalSetup() {
  console.log('\n🚀 Setting up GCP E2E tests...\n');
  console.log('⚠️  Testing against PRODUCTION GCP environment\n');

  // Verify services are accessible
  console.log('🔍 Verifying GCP services...');

  const services = [
    { name: 'GCP Backend API', url: `${GCP_BACKEND_URL}/health` },
    { name: 'GCP Frontend', url: GCP_FRONTEND_URL },
  ];

  for (const service of services) {
    try {
      const response = await fetch(service.url, {
        method: 'GET',
        // Allow time for cold start
        signal: AbortSignal.timeout(30000),
      });
      if (response.ok || response.status === 200) {
        console.log(`✅ ${service.name} is accessible`);
      } else {
        throw new Error(`${service.name} returned status ${response.status}`);
      }
    } catch (error) {
      console.error(`❌ ${service.name} is not accessible at ${service.url}`);
      throw error;
    }
  }

  // Verify backend health response
  console.log('\n🔍 Checking backend health details...');
  try {
    const healthResponse = await fetch(`${GCP_BACKEND_URL}/health`);
    const health = await healthResponse.json();
    console.log(`   Service: ${health.service}`);
    console.log(`   Version: ${health.version}`);
    console.log(`   Status: ${health.status}`);
    console.log(`   Database: ${health.database}`);

    if (health.database !== 'connected') {
      throw new Error('Database is not connected!');
    }
  } catch (error) {
    console.error('❌ Backend health check failed');
    throw error;
  }

  console.log('\n✨ GCP E2E test setup complete!\n');
}

export default globalSetup;
