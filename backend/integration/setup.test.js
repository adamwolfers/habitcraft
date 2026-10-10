/**
 * Integration Test Pool Timeouts (habitcraft-l3r)
 *
 * Every test's beforeEach runs quickReset() on the test pool. Without
 * timeouts, anything that blocks it -- a lock holder, a connect stalled in
 * Docker's port forward -- waits forever, and jest blames whichever test is
 * next with a bare 30000ms timeout. These tests prove each stall instead fails
 * fast with an error that says what it was waiting on.
 */

const net = require('net');
const { Client, Pool } = require('pg');
const { getTestServer, quickReset, testDbConfig } = require('./setup');

// Well under the config-wide 30000ms testTimeout, which is the failure these
// timeouts exist to pre-empt.
const FAIL_FAST_MS = 15000;

describe('Integration test pool timeouts', () => {
  it('fails a blocked quickReset() fast, naming the timeout and the statement', async () => {
    const lockHolder = new Client(testDbConfig);
    await lockHolder.connect();

    try {
      await lockHolder.query('BEGIN');
      // completions is the first table quickReset() clears, so nothing is
      // deleted before it blocks and the next test's reset starts clean.
      await lockHolder.query('LOCK TABLE completions IN ACCESS EXCLUSIVE MODE');

      const started = Date.now();
      await expect(quickReset()).rejects.toThrow(/DELETE FROM completions.*lock timeout/);
      expect(Date.now() - started).toBeLessThan(FAIL_FAST_MS);
    } finally {
      await lockHolder.query('ROLLBACK');
      await lockHolder.end();
    }
  });

  it('fails a stalled connect fast instead of waiting forever', async () => {
    // Accepts the TCP connection but never speaks the postgres protocol: the
    // shape of a connect stalled inside a port forward.
    const sockets = [];
    const blackHole = net.createServer((socket) => sockets.push(socket));
    await new Promise((resolve) => blackHole.listen(0, '127.0.0.1', resolve));

    const pool = new Pool({
      ...testDbConfig,
      host: '127.0.0.1',
      port: blackHole.address().port,
    });

    try {
      const started = Date.now();
      await expect(pool.query('SELECT 1')).rejects.toThrow(/timeout/i);
      expect(Date.now() - started).toBeLessThan(FAIL_FAST_MS);
    } finally {
      await pool.end();
      sockets.forEach((socket) => socket.destroy());
      await new Promise((resolve) => blackHole.close(resolve));
    }
  });
});

describe('Integration test server', () => {
  // supertest connects to 127.0.0.1. A wildcard listen(0) lets another process
  // on macOS bind 127.0.0.1 on the same port and take the suite's requests
  // (habitcraft-oft7). supertest.test.js guards the per-request servers.
  it('binds to loopback, not to every interface', () => {
    expect(getTestServer().address().address).toBe('127.0.0.1');
  });
});
