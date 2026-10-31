import { vi } from 'vitest';

/** One canned answer: a status and an optional JSON body. */
export type Answer = readonly [status: number, body?: unknown];

type Route = Answer | ((request: Request) => Answer | Promise<Answer>);

/** The route for a request: an exact "METHOD /path", or one with :params. */
function routeFor(routes: Record<string, Route>, key: string): Route | undefined {
  if (routes[key]) return routes[key];
  const pattern = (route: string) =>
    new RegExp(`^${route.replace(/:[^/]+/g, '[^/]+').replace(/[.?]/g, '\\$&')}$`);
  const match = Object.keys(routes).find(
    (route) => route.includes(':') && pattern(route).test(key)
  );
  return match ? routes[match] : undefined;
}

/**
 * Stubs the global fetch with a fake API. `routes` maps "METHOD /path" to an
 * answer, or to a function of the request for one that depends on it. A path
 * segment written `:name` matches any one segment. Any other request fails
 * the test that made it.
 */
export function fakeServer(routes: Record<string, Route>) {
  const requests: Request[] = [];
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    requests.push(request.clone());
    const key = `${request.method} ${new URL(request.url).pathname}`;
    const route = routeFor(routes, key);
    if (!route) throw new Error(`Unexpected request: ${key}`);
    const [status, body] = typeof route === 'function' ? await route(request) : route;
    return new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchImpl);
  return {
    requests,
    /** The JSON bodies sent to one route, in order. */
    async bodiesSentTo(key: string): Promise<unknown[]> {
      const sent = requests.filter(
        (request) => `${request.method} ${new URL(request.url).pathname}` === key
      );
      return Promise.all(sent.map((request) => request.clone().json()));
    },
  };
}

export const alice = {
  id: '0b6f1d2e-0000-4000-8000-000000000001',
  email: 'alice@example.com',
  name: 'Alice',
  createdAt: '2026-10-01T00:00:00Z',
};

export function habit(name: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `0b6f1d2e-0000-4000-8000-${String(name.length).padStart(12, '0')}`,
    userId: alice.id,
    name,
    description: null,
    color: '#3B82F6',
    icon: '',
    status: 'active',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}
