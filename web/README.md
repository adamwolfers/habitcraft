# HabitCraft web app

The React + Vite single-page app that replaces `frontend/` in the rebuild
(habitcraft-vxln.8; see [README.md](../README.md#direction)). It is a static
bundle. The Go server embeds it and serves it beside the API, so in production
there is no Node at all (see [server/README.md](../server/README.md#the-web-app)).

## Running

```bash
npm ci
npm run dev        # http://localhost:3200, proxying the API to a Go server on :8080
```

Start the Go server first ([server/README.md](../server/README.md#running)).
`npm run dev` proxies `/api` and `/health` to it, so the app and the API share
an origin as they do in production, and the auth cookies work unchanged.
`HABITCRAFT_API_URL` points the proxy at another server, such as
`server-test` on `http://localhost:3020`.

`npm run build` typechecks, then writes the bundle into
`../server/cmd/habitcraft/spa/dist/`, where `go build` embeds it.

## Layout

| Path | What it is |
|---|---|
| `src/App.tsx` | The routes: `/login` and `/register` signed out, `/habits` and `/profile` signed in |
| `src/api/` | The API client, typed from the spec by openapi-fetch, and the messages for its failures |
| `src/session/` | Who is signed in, as a React Query query of `GET /api/v1/users/me` |
| `src/pages/` | One component per page |
| `src/components/` | The layout around the signed-in pages, and the form parts every page uses |

The access token is an httpOnly cookie the app cannot read. Every request
goes through `src/api/renewingFetch.ts`: on a 401 it renews the session from
the refresh-token cookie once and sends the request again. Requests that fail
together share one renewal, since a refresh token works once. When the
session cannot be renewed, the app drops the user's data and shows sign-in.

Server data lives in React Query's cache. Signing in or out drops everything
in it but the current user, so nothing of one user's shows to the next.

## Testing

```bash
npm test               # Vitest + React Testing Library, in jsdom
npm run test:coverage
npm run lint           # ESLint, with Prettier as a lint rule
npm run typecheck
```

These are phases 6, 7 and 16 of `scripts/test-all.sh`, and the
`web-unit-tests` CI job, which also builds the bundle. The unit tests render
the whole app against a fake API (`src/test/fakeServer.ts`). The acceptance
suite's `spa` project drives the real thing, served by the Go server (see
[acceptance/README.md](../acceptance/README.md#the-spa-driver)). Vitest 5 needs Node
22.12 or later. TypeScript is pinned to 6.0 because typescript-eslint does not
support 7 yet.

## The API's types and limits

`src/types/api.generated.ts` and `src/types/apiLimits.generated.ts` are
generated from `shared/api-spec/openapi.yaml` by `npm run api:codegen` at the
repo root. Never edit them by hand. Import from `src/types/api.ts`, and never
write a length limit as a literal (see
[shared/api-spec/README.md](../shared/api-spec/README.md)).
