import { test as teardown, request } from '@playwright/test';
import path from 'path';
import fs from 'fs';

/**
 * GCP Auth Teardown
 *
 * This teardown project runs after all GCP smoke tests complete.
 * It cleans up the test user created during setup.
 */

const AUTH_STATE_DIR = path.join(__dirname, '.auth');
const AUTH_STATE_PATH = path.join(AUTH_STATE_DIR, 'gcp-user.json');
const TEST_USER_PATH = path.join(AUTH_STATE_DIR, 'gcp-test-user.json');

teardown('delete test user and cleanup', async ({}) => {
  console.log('\n🧹 Cleaning up test user...');

  // Check if test user file exists
  if (!fs.existsSync(TEST_USER_PATH)) {
    console.log('⚠️  No test user file found, skipping cleanup');
    return;
  }

  // Read test user credentials
  const testUser = JSON.parse(fs.readFileSync(TEST_USER_PATH, 'utf-8'));
  console.log(`📝 Cleaning up user: ${testUser.email}`);

  // Get backend URL - same logic as playwright.gcp.config.ts
  const USE_CLOUDRUN_URLS = process.env.USE_CLOUDRUN_URLS === '1';
  const apiBaseURL = USE_CLOUDRUN_URLS
    ? 'https://habitcraft-backend-iz7ggma5ga-uc.a.run.app'
    : 'https://api.habitcraft.org';

  try {
    // Create API request context
    const apiContext = await request.newContext({
      baseURL: apiBaseURL,
    });

    // Login to get auth cookies
    const loginResponse = await apiContext.post('/api/v1/auth/login', {
      data: {
        email: testUser.email,
        password: testUser.password,
      },
    });

    if (!loginResponse.ok()) {
      console.log(
        `⚠️  Could not login for cleanup (status ${loginResponse.status()}) - user may already be deleted`
      );
      await apiContext.dispose();
      cleanupFiles();
      return;
    }

    // Extract JWT token from login response
    const loginData = await loginResponse.json();
    const accessToken = loginData.accessToken;

    if (!accessToken) {
      console.log('⚠️  No access token in login response, cannot delete user');
      await apiContext.dispose();
      cleanupFiles();
      return;
    }

    // Delete the test user (requires JWT auth and password confirmation)
    const deleteResponse = await apiContext.delete('/api/v1/users/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        password: testUser.password,
      },
    });

    if (deleteResponse.status() === 204) {
      console.log(`✅ Deleted test user: ${testUser.email}`);
    } else {
      const errorText = await deleteResponse.text().catch(() => 'Could not read response body');
      console.log(
        `⚠️  Failed to delete test user (status ${deleteResponse.status()}): ${errorText}`
      );
    }

    await apiContext.dispose();
  } catch (error) {
    console.log('⚠️  Error during user cleanup:', error);
  }

  // Clean up auth files
  cleanupFiles();
});

function cleanupFiles() {
  try {
    if (fs.existsSync(AUTH_STATE_PATH)) {
      fs.unlinkSync(AUTH_STATE_PATH);
      console.log('✅ Removed auth state file');
    }
    if (fs.existsSync(TEST_USER_PATH)) {
      fs.unlinkSync(TEST_USER_PATH);
      console.log('✅ Removed test user file');
    }
    // Try to remove the directory if empty
    if (fs.existsSync(AUTH_STATE_DIR)) {
      const files = fs.readdirSync(AUTH_STATE_DIR);
      if (files.length === 0) {
        fs.rmdirSync(AUTH_STATE_DIR);
        console.log('✅ Removed auth directory');
      }
    }
  } catch (error) {
    console.log('⚠️  Error cleaning up files:', error);
  }
  console.log('🧹 Cleanup complete\n');
}
