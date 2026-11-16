import { test } from '@playwright/test';
import { ApiDriver } from '../drivers/api/apiDriver.ts';
import { habitRoundTrip, throwawayAccount } from './habitRoundTrip.ts';

/**
 * The entry point scripts/smoke-check.sh runs against a deployed server. It is
 * not a test case of the acceptance suite: that suite assumes a disposable
 * database, and this runs against production.
 *
 *   SMOKE_BASE_URL   the server's base URL, e.g. https://habitcraft.org
 */
test('one habit round trip works, and its user is deleted', async () => {
  const baseUrl = process.env.SMOKE_BASE_URL;
  if (!baseUrl) throw new Error('SMOKE_BASE_URL is not set');
  await habitRoundTrip(new ApiDriver(baseUrl), throwawayAccount());
});
