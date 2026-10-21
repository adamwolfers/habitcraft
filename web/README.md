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

## Testing

```bash
npm test               # Vitest + React Testing Library, in jsdom
npm run test:coverage
npm run lint           # ESLint, with Prettier as a lint rule
npm run typecheck
```

These are phases 6, 7 and 16 of `scripts/test-all.sh`, and the
`web-unit-tests` CI job, which also builds the bundle. Vitest 5 needs Node
22.12 or later. TypeScript is pinned to 6.0 because typescript-eslint does not
support 7 yet.

## The API's types and limits

`src/types/api.generated.ts` and `src/types/apiLimits.generated.ts` are
generated from `shared/api-spec/openapi.yaml` by `npm run api:codegen` at the
repo root. Never edit them by hand. Import from `src/types/api.ts`, and never
write a length limit as a literal (see
[shared/api-spec/README.md](../shared/api-spec/README.md)).
