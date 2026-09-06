# OpenAPI enforcement

This directory makes `shared/api-spec/openapi.yaml` **load-bearing**: every
response the backend integration suite provokes is validated against it, and
the run fails if a documented operation is never exercised.

Nothing in the running app imports anything here. It is test-only code, and
`.github/workflows/ci.yml` excludes `backend/openapi/**` from the
`backend-deploy` filter for that reason.

## Why

The spec used to be 911 lines with **zero** code references repo-wide — no
test, no lint rule, no CI job, no codegen step read it. Six documents pointed
new work at it as "the contract". An unchecked spec is worse than no spec: it
is a confident wrong answer, and this one had drifted badly (the auth
responses returned tokens the spec said were cookie-only, `User.updatedAt` did
not exist, `/health` returned two fields the spec had never heard of,
`DELETE /users/me` was absent entirely).

Enforcing it was option (a) of the three in habitcraft-34d.2. Generating the
spec from the handlers instead — option (b) — stays the plausible end state,
and is much more tractable once the backend is TypeScript (habitcraft-83h);
this gets the drift under control now and does not block that.

## How it fits together

| File | Role |
|---|---|
| `spec.js` | Loads the YAML, inlines `$ref`s, translates OpenAPI `nullable` into JSON Schema, and matches a live request's method + path to a documented operation |
| `responseValidator.js` | Compiles response schemas with ajv, records violations and operation coverage |
| `httpInterceptor.js` | Patches `writeHead`/`write`/`end` on the raw `ServerResponse` to capture what actually went on the wire |
| `globalSetup.js` | Clears the accumulated coverage file before the run |
| `globalTeardown.js` | Prints coverage and fails a full run that left an operation unexercised |

The interceptor is installed in `integration/setup.js`, which wraps the shared
test server rather than adding express middleware — so a route mounted later,
or a response express generates by itself, is still seen. Violations are
collected rather than thrown (throwing inside `res.json` would surface as a
500 from the route under test) and drained by an `afterEach` in
`jest.integration.setup.js`, which attributes each one to the test that caused
it.

## What fails the suite

- a renamed field (`userId` → `user_id`) — reported as both a missing required
  property and a stray one
- a field the spec does not document
- a missing field, a wrong type, a value outside an `enum`
- a status code the operation does not document
- a request to a path, or a method on a path, the spec never mentions
- a body on a status documented as bodiless (204)
- a non-JSON body where the spec documents JSON
- any documented operation no integration test exercises

## Working with it

**A response changed on purpose.** Update the schema in `openapi.yaml`
alongside the handler, then run `npm run api:codegen` from the repo root and
commit the regenerated client files. Both clients now *generate* their types
and validation limits from that spec (habitcraft-467), so changing one without
the other is the drift this exists to catch — and a separate CI job catches the
half this one cannot see. See
[shared/api-spec/README.md](../../shared/api-spec/README.md).

**A new endpoint.** Document it in `openapi.yaml` and add an integration test
that calls it. Either half alone fails the run — the spec half fails coverage,
the test half fails as an undocumented path.

**Keep response schemas closed.** Every response schema sets
`additionalProperties: false` and lists all of its fields in `required`.
`spec.test.js` asserts this for every documented response, so relaxing one to
make a test pass fails a different test instead.

**`allOf` does not work here.** `additionalProperties: false` inside an `allOf`
branch is evaluated against the whole object, so a branch that does not know
about a sibling's properties rejects them and nothing validates. That is why
`HabitWithCompletions` repeats `Habit`'s properties in full rather than
extending it.

**Running a subset.** `npm run test:integration -- habits.test.js` reports
missing coverage but does not fail on it: `globalTeardown` compares the test
files that reported against the files on disk and only enforces once all of
them have run.
