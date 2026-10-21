import { defineConfig } from '@playwright/test';
import type { ProtocolOptions } from './dsl/index.ts';
import type { Backend } from './dsl/knownBugs.ts';

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
 *   ACCEPTANCE_SPA_URL   default http://localhost:3020 (server-test: the Go
 *                        server, which serves the Vite SPA beside its API)
 *   ACCEPTANCE_BACKEND   node (default) or go: which server the api and web
 *                        URLs reach, so the tests for its known bugs are
 *                        expected to fail. The spa project is always on go.
 */
const backend = backendFromEnv(process.env.ACCEPTANCE_BACKEND);

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
        backend,
        apiUrl: process.env.ACCEPTANCE_API_URL ?? 'http://localhost:3010',
      },
    },
    {
      name: 'web',
      // The Next.js dev server compiles each page on its first visit.
      timeout: 60_000,
      use: {
        protocol: 'web',
        backend,
        webUrl: process.env.ACCEPTANCE_WEB_URL ?? 'http://localhost:3110',
      },
    },
    {
      name: 'spa',
      use: {
        protocol: 'spa',
        backend: 'go',
        spaUrl: process.env.ACCEPTANCE_SPA_URL ?? 'http://localhost:3020',
      },
    },
  ],
});

function backendFromEnv(value = 'node'): Backend {
  if (value === 'node' || value === 'go') return value;
  throw new Error(`ACCEPTANCE_BACKEND must be node or go, not "${value}"`);
}
