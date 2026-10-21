/**
 * A fetch that keeps the session going. The access token lives a short while
 * in an httpOnly cookie, so the app only learns it has expired from a 401.
 * Then this renews the session from the refresh-token cookie and sends the
 * request once more. When the session cannot be renewed, it reports the user
 * signed out and returns the 401.
 *
 * Requests that fail together share one renewal: a refresh token works once,
 * and a second renewal with it would be refused (habitcraft-d586).
 */

const RENEW = '/api/v1/auth/refresh';
const AUTH_ROUTES = '/api/v1/auth/';

type Fetch = (input: Request) => Promise<Response>;

export function createRenewingFetch(
  fetchImpl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  onSignedOut: () => void
): Fetch {
  let renewing: Promise<boolean> | undefined;

  // At the origin of the request that failed, which holds the cookie.
  const renew = (failed: Request): Promise<boolean> => {
    renewing ??= fetchImpl(new URL(RENEW, failed.url), { method: 'POST' })
      .then(
        (response) => response.ok,
        () => false
      )
      .finally(() => (renewing = undefined));
    return renewing;
  };

  return async (request) => {
    // Sign-in and the rest answer 401 for what the user typed, and renewing
    // cannot change that.
    if (new URL(request.url).pathname.startsWith(AUTH_ROUTES)) return fetchImpl(request);

    const again = request.clone();
    const response = await fetchImpl(request);
    if (response.status !== 401) return response;

    if (!(await renew(request))) {
      onSignedOut();
      return response;
    }
    // A second 401 is the request's own answer, such as a wrong password.
    return fetchImpl(again);
  };
}
