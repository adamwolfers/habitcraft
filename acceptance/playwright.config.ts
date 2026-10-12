import { defineConfig } from '@playwright/test';
import type { ProtocolOptions } from './dsl/index.ts';

/**
 * One Playwright project per protocol driver. Every test case runs once per project,
 * unchanged; the project only picks which protocol driver the DSL talks to.
 *
 * The system under test is found through the environment, so the same run
 * targets the Node backend today and the Go server after the rebuild:
 *
 *   ACCEPTANCE_API_URL   default http://localhost:3010 (docker-compose.test.yml)
 *   ACCEPTANCE_WEB_URL   default http://localhost:3110 (frontend-test, which talks
 *                        to the backend on 3010 itself)
 */
export default defineConfig<ProtocolOptions>({
  testDir: './tests',
  testMatch: '**/*.test.ts',

  // Safe because the DSL gives every test its own users; nothing is shared.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: [['list']],

  projects: [
    {
      name: 'api',
      use: {
        protocol: 'api',
        apiUrl: process.env.ACCEPTANCE_API_URL ?? 'http://localhost:3010',
      },
    },
    {
      name: 'web',
      // The Next.js dev server compiles each page on its first visit.
      timeout: 60_000,
      use: {
        protocol: 'web',
        webUrl: process.env.ACCEPTANCE_WEB_URL ?? 'http://localhost:3110',
      },
    },
  ],
});
