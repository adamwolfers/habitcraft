import { execFile } from 'node:child_process';
import { createServer, request as forward, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import type { Credentials } from '../drivers/driver.ts';
import { ApiDriver } from '../drivers/api/apiDriver.ts';

/**
 * The post-deploy smoke check's own tests (habitcraft-vxln.9.1). Each runs the
 * real command, scripts/smoke-check.sh, against a proxy in front of a running
 * server, so the proxy can see which user the check registered and can break
 * the habits API the way habitcraft-0jq feared: /health and auth fine, every
 * habits request a 500.
 *
 *   SMOKE_TEST_TARGET_URL   default http://localhost:3020 (server-test)
 */
const TARGET = process.env.SMOKE_TEST_TARGET_URL ?? 'http://localhost:3020';
const SMOKE_CHECK = path.join(import.meta.dirname, '..', '..', 'scripts', 'smoke-check.sh');

test.describe.configure({ mode: 'serial' });

test('passes against a working server and leaves no user behind', async () => {
  const proxy = await startProxy({ breakHabits: false });
  try {
    const run = await smokeCheck(proxy.url);
    expect(run.code, run.output).toBe(0);
    expect(proxy.registered).toHaveLength(1);
    await expectNoSuchUser(proxy.registered[0]);
  } finally {
    await proxy.close();
  }
});

test('fails when the habits API is broken and still leaves no user behind', async () => {
  const proxy = await startProxy({ breakHabits: true });
  try {
    const run = await smokeCheck(proxy.url);
    expect(run.code, run.output).not.toBe(0);
    expect(run.output).toContain('expected 201, got 500');
    expect(proxy.registered).toHaveLength(1);
    await expectNoSuchUser(proxy.registered[0]);
  } finally {
    await proxy.close();
  }
});

test('fails when no base URL is given', async () => {
  const run = await smokeCheck(undefined);
  expect(run.code, run.output).not.toBe(0);
});

test('makes one register call and signs in no further', async () => {
  const proxy = await startProxy({ breakHabits: false });
  try {
    const run = await smokeCheck(proxy.url);
    expect(run.code, run.output).toBe(0);
    expect(proxy.registered).toHaveLength(1);
    expect(proxy.logins).toBe(0);
  } finally {
    await proxy.close();
  }
});

// --- helpers ----------------------------------------------------------------

/** The account is gone: its own credentials no longer sign in. */
async function expectNoSuchUser(credentials: Credentials): Promise<void> {
  const driver = new ApiDriver(TARGET);
  expect(await driver.signIn(credentials)).toEqual({ ok: false, refusal: 'invalid-credentials' });
}

function smokeCheck(baseUrl: string | undefined): Promise<{ code: number; output: string }> {
  // A clean environment for the nested Playwright run: this worker's own
  // loader settings and test indexes are not meant for it.
  const env: NodeJS.ProcessEnv = { PATH: process.env.PATH, HOME: process.env.HOME };
  return new Promise((resolve) => {
    execFile(
      SMOKE_CHECK,
      baseUrl === undefined ? [] : [baseUrl],
      { env, timeout: 60_000 },
      (error, stdout, stderr) => {
        const code = error ? (typeof error.code === 'number' ? error.code : 1) : 0;
        resolve({ code, output: `${stdout}\n${stderr}` });
      }
    );
  });
}

interface Proxy {
  url: string;
  registered: Credentials[];
  logins: number;
  close(): Promise<void>;
}

async function startProxy({ breakHabits }: { breakHabits: boolean }): Promise<Proxy> {
  const target = new URL(TARGET);
  const proxy: Proxy = { url: '', registered: [], logins: 0, close: async () => {} };

  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const pathname = new URL(req.url ?? '/', 'http://proxy').pathname;

      if (req.method === 'POST' && pathname === '/api/v1/auth/register') {
        const { email, password } = JSON.parse(body.toString()) as Credentials;
        proxy.registered.push({ email, password });
      }
      if (req.method === 'POST' && pathname === '/api/v1/auth/login') proxy.logins += 1;

      if (breakHabits && pathname.startsWith('/api/v1/habits')) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        // A documented 500, so the check fails on the status, not the contract.
        res.end(
          JSON.stringify({ error: 'Internal Server Error', message: 'broken', statusCode: 500 })
        );
        return;
      }

      const upstream = forward(
        {
          host: target.hostname,
          port: target.port,
          method: req.method,
          path: req.url,
          headers: { ...req.headers, host: target.host },
        },
        (upstreamRes) => {
          res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
          upstreamRes.pipe(res);
        }
      );
      upstream.on('error', (error) => {
        res.writeHead(502);
        res.end(String(error));
      });
      upstream.end(body);
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  proxy.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  proxy.close = () => new Promise((resolve) => server.close(() => resolve()));
  return proxy;
}
