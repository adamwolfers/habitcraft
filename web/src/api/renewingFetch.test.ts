import { describe, expect, it, vi } from 'vitest';
import { createRenewingFetch } from './renewingFetch.ts';

const json = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** A fake server: answers each request from `answer`, and records what it saw. */
function server(answer: (request: Request) => Response | Promise<Response>) {
  const seen: string[] = [];
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    seen.push(`${request.method} ${new URL(request.url).pathname}`);
    return answer(request);
  });
  return { fetchImpl, seen };
}

const get = (path: string) => new Request(`http://localhost${path}`);

describe('createRenewingFetch', () => {
  it('passes a successful response straight through', async () => {
    const { fetchImpl, seen } = server(() => json(200, { ok: true }));
    const signedOut = vi.fn();

    const response = await createRenewingFetch(fetchImpl, signedOut)(get('/api/v1/habits'));

    expect(response.status).toBe(200);
    expect(seen).toEqual(['GET /api/v1/habits']);
    expect(signedOut).not.toHaveBeenCalled();
  });

  it('renews the session on a 401 and sends the request again', async () => {
    let renewed = false;
    const { fetchImpl, seen } = server((request) => {
      if (request.url.endsWith('/api/v1/auth/refresh')) {
        renewed = true;
        return json(200);
      }
      return renewed ? json(200, { ok: true }) : json(401, { error: 'Token expired' });
    });

    const response = await createRenewingFetch(fetchImpl, vi.fn())(get('/api/v1/habits'));

    expect(response.status).toBe(200);
    expect(seen).toEqual(['GET /api/v1/habits', 'POST /api/v1/auth/refresh', 'GET /api/v1/habits']);
  });

  it('sends a request body again when it retries', async () => {
    const bodies: string[] = [];
    let renewed = false;
    const { fetchImpl } = server(async (request) => {
      if (request.url.endsWith('/api/v1/auth/refresh')) {
        renewed = true;
        return json(200);
      }
      bodies.push(await request.text());
      return renewed ? json(201) : json(401);
    });
    const post = new Request('http://localhost/api/v1/habits', {
      method: 'POST',
      body: JSON.stringify({ name: 'Read' }),
    });

    await createRenewingFetch(fetchImpl, vi.fn())(post);

    expect(bodies).toEqual(['{"name":"Read"}', '{"name":"Read"}']);
  });

  it('reports the user signed out when the session cannot be renewed', async () => {
    const { fetchImpl, seen } = server(() => json(401, { error: 'No token provided' }));
    const signedOut = vi.fn();

    const response = await createRenewingFetch(fetchImpl, signedOut)(get('/api/v1/users/me'));

    expect(response.status).toBe(401);
    expect(seen).toEqual(['GET /api/v1/users/me', 'POST /api/v1/auth/refresh']);
    expect(signedOut).toHaveBeenCalledOnce();
  });

  it('returns a second 401 as it is, without renewing again', async () => {
    // A wrong password on change-password is a 401 from a live session.
    const { fetchImpl, seen } = server((request) =>
      request.url.endsWith('/api/v1/auth/refresh')
        ? json(200)
        : json(401, { error: 'Invalid current password' })
    );
    const signedOut = vi.fn();

    const response = await createRenewingFetch(
      fetchImpl,
      signedOut
    )(new Request('http://localhost/api/v1/users/me/password', { method: 'PUT', body: '{}' }));

    expect(await response.json()).toEqual({ error: 'Invalid current password' });
    expect(seen).toEqual([
      'PUT /api/v1/users/me/password',
      'POST /api/v1/auth/refresh',
      'PUT /api/v1/users/me/password',
    ]);
    expect(signedOut).not.toHaveBeenCalled();
  });

  it('never renews for the auth routes themselves', async () => {
    // A wrong password at sign-in is a 401 too, and means just that.
    const { fetchImpl, seen } = server(() => json(401, { error: 'Invalid credentials' }));
    const signedOut = vi.fn();

    const response = await createRenewingFetch(
      fetchImpl,
      signedOut
    )(new Request('http://localhost/api/v1/auth/login', { method: 'POST', body: '{}' }));

    expect(response.status).toBe(401);
    expect(seen).toEqual(['POST /api/v1/auth/login']);
    expect(signedOut).not.toHaveBeenCalled();
  });

  it('renews once for requests that fail together', async () => {
    // A refresh token works once, so a second renewal at the same moment
    // would be refused and sign the user out.
    let renewals = 0;
    let finishRenewal: () => void = () => {};
    const { fetchImpl } = server((request) => {
      if (!request.url.endsWith('/api/v1/auth/refresh')) {
        return renewals > 0 ? json(200) : json(401);
      }
      renewals++;
      return new Promise((resolve) => (finishRenewal = () => resolve(json(200))));
    });
    const renewingFetch = createRenewingFetch(fetchImpl, vi.fn());

    const both = Promise.all([
      renewingFetch(get('/api/v1/habits')),
      renewingFetch(get('/api/v1/users/me')),
    ]);
    await vi.waitFor(() => expect(renewals).toBe(1));
    finishRenewal();

    expect((await both).map((response) => response.status)).toEqual([200, 200]);
    expect(renewals).toBe(1);
  });

  it('renews again after an earlier renewal has finished', async () => {
    let renewals = 0;
    let expired = true;
    const { fetchImpl } = server((request) => {
      if (request.url.endsWith('/api/v1/auth/refresh')) {
        renewals++;
        expired = false;
        return json(200);
      }
      return expired ? json(401) : json(200);
    });
    const renewingFetch = createRenewingFetch(fetchImpl, vi.fn());

    await renewingFetch(get('/api/v1/habits'));
    expired = true;
    await renewingFetch(get('/api/v1/habits'));

    expect(renewals).toBe(2);
  });

  it('treats a renewal that cannot reach the server as signed out', async () => {
    const { fetchImpl } = server((request) => {
      if (request.url.endsWith('/api/v1/auth/refresh')) throw new TypeError('Failed to fetch');
      return json(401);
    });
    const signedOut = vi.fn();

    const response = await createRenewingFetch(fetchImpl, signedOut)(get('/api/v1/habits'));

    expect(response.status).toBe(401);
    expect(signedOut).toHaveBeenCalledOnce();
  });
});
