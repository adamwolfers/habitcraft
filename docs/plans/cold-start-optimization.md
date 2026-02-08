# Cold Start Optimization Plan

**Bead:** habitcraft-6ck
**Priority:** P1

## Problem

Cold starts take 7-20+ seconds due to lazy DB pool initialization and zero warm instances.

## Solution (3 changes)

### 1. Keep one warm instance (~$25/month)
**File:** `infrastructure/terraform/gcp/prod/main.tf`
```hcl
scaling {
  min_instance_count = 1  # was 0
  max_instance_count = 10
}
```
**Impact:** Eliminates most cold starts entirely

### 2. Pre-warm database pool at startup (free)
**File:** `backends/node/db/pool.js`
```javascript
async function warmPool() {
  const client = await pool.connect();
  await client.query('SELECT 1');
  client.release();
}
// Call after pool creation in production
```
**Impact:** Saves 1-3s when cold starts do occur

### 3. Add fast readiness endpoint (free)
**File:** `backends/node/app.js`
```javascript
app.get('/ready', (req, res) => res.status(200).json({ status: 'ready' }));
```
**File:** `infrastructure/terraform/gcp/prod/main.tf` - use `/ready` for startup_probe

**Impact:** Service becomes ready faster

## Expected Results

| Metric | Before | After |
|--------|--------|-------|
| Cold starts/day | Many | Rare |
| Cold start time | 12-20s | 3-5s |
| Monthly cost | ~$X | ~$X + $25 |
