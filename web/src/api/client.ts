/**
 * The API, typed from the spec. Every call goes through the renewing fetch,
 * so an expired access token is renewed without the caller knowing.
 */
import createClient from 'openapi-fetch';
import type { paths } from '../types/api.ts';
import { createRenewingFetch } from './renewingFetch.ts';

const signedOutListeners = new Set<() => void>();

/** Hear when the session ends without the user signing out. */
export function onSignedOut(listener: () => void): () => void {
  signedOutListeners.add(listener);
  return () => signedOutListeners.delete(listener);
}

export const api = createClient<paths>({
  // The page's own origin: the Go server serves the app and the API together.
  baseUrl: globalThis.location?.origin ?? '',
  // Looked up on each call, so tests can stub the global fetch.
  fetch: createRenewingFetch(
    (input, init) => globalThis.fetch(input, init),
    () => signedOutListeners.forEach((listener) => listener())
  ),
});
