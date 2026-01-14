# Smoke Test Cleanup Plan

## Problem

The GCP smoke tests currently:
1. Create a new test user each run (`gcp-smoke-{timestamp}@example.com`)
2. Do NOT delete the user afterward
3. Hit registration rate limits after multiple runs
4. Accumulate orphan test users in production

## Solution

Make tests self-sufficient and isolated by cleaning up after themselves.

### Backend Changes

1. **Add DELETE /api/v1/users/me endpoint**
   - Requires authentication
   - Deletes user's completions, habits, refresh_tokens, then user
   - Uses transaction to ensure atomicity
   - Add `ACCOUNT_DELETED` security event

2. **Add tests for the new endpoint**

### Frontend/E2E Changes

1. **Add `test.afterAll` cleanup hook**
   - Login with test user
   - Call DELETE /api/v1/users/me
   - Handle case where user wasn't created (test failed early)

2. **Store auth token from Setup test**
   - Save accessToken after registration
   - Use it in afterAll for cleanup

### Test Structure

```typescript
let authToken: string | null = null;

test.describe('GCP Smoke Tests', () => {
  test.afterAll(async ({ request }) => {
    if (authToken) {
      await request.delete('/api/v1/users/me', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
    }
  });

  test('Setup - create test user', async ({ page }) => {
    // ... register user
    // Store token from response/cookies for cleanup
  });

  // ... other tests
});
```

## Rate Limit Consideration

Even with cleanup, running smoke tests repeatedly could hit rate limits. Options:
- Current registration limit: 10/hour
- Could increase to 20/hour for more headroom
- Or add bypass header for smoke tests (more complex)

## Files to Modify

- `backends/node/routes/users.js` - Add DELETE endpoint
- `backends/node/routes/users.test.js` - Add tests
- `backends/node/utils/securityLogger.js` - Add ACCOUNT_DELETED event
- `frontends/nextjs/e2e/gcp-smoke.spec.ts` - Add cleanup hook
