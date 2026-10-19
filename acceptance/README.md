# Acceptance tests

HabitCraft's four-layer acceptance suite (Dave Farley's ATDD). The why and the
rules are in [docs/TESTING.md](../docs/TESTING.md#acceptance-tests-four-layer-atdd);
this file covers the layout and how to run it.

| Layer | Where | Knows about |
|---|---|---|
| 1. Test cases | `tests/*.test.ts` | Habits, users and days. Nothing else |
| 2. DSL | `dsl/` | Aliases, dates, assertions, which driver to use |
| 3. Protocol drivers | `drivers/` | One channel each. `driver.ts` is the contract |
| 4. System under test | — | Found through `ACCEPTANCE_API_URL` and `ACCEPTANCE_WEB_URL` |

Each Playwright project is one protocol driver, and every test case runs once
per project, unchanged. There are two: `api` and `web`.

## Running

```bash
# From the repo root: the test database, the Node backend on :3010, the Go
# server on :3020 and the Next.js app on :3110 (the web project's system under
# test)
docker compose -f docker-compose.test.yml up -d postgres-test db-migrate-test backend-test server-test frontend-test

cd acceptance
npm ci
npx playwright install chromium                  # once, for the web project
npm test                                         # every project
npm test -- --project api                        # one project; no frontend needed
ACCEPTANCE_API_URL=http://localhost:3020 ACCEPTANCE_BACKEND=go npm test -- --project api  # the Go server (server-test)
npm run typecheck
```

`ACCEPTANCE_WEB_URL` (default `http://localhost:3110`) points the web project at
another app. The app finds its backend itself; `frontend-test` talks to `:3010`.
`ACCEPTANCE_BACKEND` (`node`, the default, or `go`) says which server those URLs
reach, which decides where the [known bugs](#known-bugs) are expected to fail.

CI runs both projects in the `acceptance-tests` job, then the `api` project
again against the Go server (`server-test`), and `scripts/test-all.sh` does the
same in its last two phases, so a failing acceptance test blocks a deploy. See
[docs/TESTING.md](../docs/TESTING.md#all-tests).

No database reset is needed between runs, and none happens. The DSL registers
fresh users with unique emails for every test, so tests share nothing and run
in parallel against a database that earlier runs have already written to.

## Writing a test

Import `test` from `dsl/`, never from `@playwright/test`, and use only the DSL
fixtures:

```ts
import { test } from '../dsl/index.ts';

test('a new habit can be checked off today', async ({ users, habits }) => {
  await users.register('Alice');
  await habits.create('Morning run');
  await habits.checkOff('Morning run', { on: 'today' });
  await habits.shouldBeCheckedOff('Morning run', { on: 'today' });
});
```

A step the product may refuse takes `{ expect: '<refusal>' }`. Without it the
step must succeed; with it the step must be refused for exactly that reason. The
refusals (`email-taken`, `wrong-password`, …) are listed in `drivers/driver.ts`,
and each driver maps its own channel's signal onto them:

```ts
await users.signInAs('Alice', { withPassword: 'wrong', expect: 'invalid-credentials' });
await habits.checkOff('Morning run', { on: 'today', expect: 'already-checked-off' });
```

The DSL keeps each alias's current email and password, so after
`users.changePassword()` or `profile.changeEmail()`, `users.signInAs('Alice')`
uses the new ones. `withPassword: 'previous'` tries the old password.

A test about the product's rules names the *shape* of a value, never the value
itself. The DSL makes it up, unique as ever, and takes every limit from
`dsl/apiLimits.generated.ts` (generated from the spec by `npm run api:codegen`),
so no number appears in a test:

```ts
await users.register('Alice', { email: 'malformed', expect: 'invalid-input' });
await users.register('Alice', { password: 'too-short', expect: 'invalid-input' });
await profile.changeEmail({ to: 'longest-allowed' }); // also 'in-capitals', 'too-long'
await profile.rename({ length: 'too-long' }, { expect: 'invalid-input' });
await habits.setNote('Morning run', { on: 'today', note: { length: 'longest-allowed' } });
```

Text made up to a length is the same every time, so a test can name it again
in an assertion. Days are `'today'`, `'yesterday'`, `'tomorrow'`, `'10 days ago'`
or a `YYYY-MM-DD` date.

| Fixture | Covers |
|---|---|
| `users` | register, sign in and out, renew the session, change password, delete the account |
| `profile` | the acting user's name and email |
| `habits` | create, rename, archive, restore, delete; check off and uncheck days; notes |
| `knownBug` | marks a test as one the backend under test is known to fail |

If a step needs something the DSL can't say yet, add it to the DSL and to
`ProtocolDriver`, then implement it in every driver. A test case that only makes
sense for one driver is written at the wrong level.

### Known bugs

A bug the Node backend keeps until the Go server replaces it is still written as
a test of what the product *should* do, marked with its bead:

```ts
test('an email address as long as the limit allows can register', async ({ users, knownBug }) => {
  knownBug('habitcraft-0roi');
  // ...
});
```

`dsl/knownBugs.ts` lists each bead and the backends it lives on. There the test
is expected to fail: the list reporter prints it with a `✘` but counts it as
passed. Anywhere else it must pass. When a fix lands, the test passes where it
was expected to fail, which *is* reported as a failure, so the entry cannot
outlive the bug. Check that an expected failure fails for the right reason by
running it as the other backend:

```bash
ACCEPTANCE_BACKEND=go npx playwright test -g 'as long as the limit allows'
```

The same mark covers a feature one backend has not built yet: list its bead
on that backend, and the tests pass there the moment it lands, failing the
run until the mark is removed. habitcraft-vxln.5 brought the Go server to
the whole suite this way (habitcraft-8ml9).

Behaviour that has no words in the user's language — a request for another
user's habit by id, a malformed token, an expired one — stays in the backend's
integration tests, which talk HTTP directly.

## The API driver and the contract

`drivers/api/` sends each action as the HTTP calls a client would make, with a
bearer token. It checks **every** response against
`shared/api-spec/openapi.yaml` (`apiDescription.ts`). A passing scenario
therefore also proves the server kept the contract, whichever server it was.
`api.generated.ts` is generated by `npm run api:codegen` at the repo root;
never edit it by hand.

## The web driver

`drivers/web/` clicks through the web app in a real Chromium, and reads every
observation off the screen. Its selectors live there and nowhere else. They
target the Next.js app today and get rewritten when the Vite SPA's Today, Dots
and habit detail views replace it; the test cases stay as they are.

- Every sign-in or registration opens a fresh browser context, as a second
  person would use their own browser. Contexts run in UTC, like the DSL's
  "today".
- Refusals arrive as messages on screen. The driver maps the messages it knows
  onto a refusal and throws on any other, so a reworded message fails loudly.
- Renewing the session drops the access-token cookie, as the browser does when
  it expires, and reloads. The app renews from the refresh token or shows the
  login page (`signed-out`).
- Days are toggles in this UI, so a second check-off is reported as
  `already-checked-off` from the day already showing as done, without a click.
  A future day's toggle is disabled, which is reported as `invalid-input`.
- The forms refuse some input before sending it: a field the browser marks
  invalid, a Save button held disabled, or a field with a `maxLength` that
  stops taking characters. The driver reports each as `invalid-input` and never
  submits a cut-off value.
- The Next.js app shows only "Update failed" or "Registration failed" for the
  server's validation errors (it reads `error` where the server sends
  `errors`), so the driver maps those generic messages onto `invalid-input`.
- The Next.js app cannot archive or restore a habit, so the archive scenario is
  **skipped on `web`** with that reason in the report. It shows archived habits
  with the rest, so the driver's archived list is always empty.
