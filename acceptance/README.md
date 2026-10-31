# Acceptance tests

HabitCraft's four-layer acceptance suite (Dave Farley's ATDD). The why and the
rules are in [docs/TESTING.md](../docs/TESTING.md#acceptance-tests-four-layer-atdd);
this file covers the layout and how to run it.

| Layer | Where | Knows about |
|---|---|---|
| 1. Test cases | `tests/*.test.ts` | Habits, users and days. Nothing else |
| 2. DSL | `dsl/` | Aliases, dates, assertions, which driver to use |
| 3. Protocol drivers | `drivers/` | One channel each. `driver.ts` is the contract |
| 4. System under test | — | Found through `ACCEPTANCE_API_URL`, `ACCEPTANCE_WEB_URL` and `ACCEPTANCE_SPA_URL` |

Each Playwright project is one protocol driver, and every test case runs once
per project, unchanged. There are three:

| Project | Drives | Against |
|---|---|---|
| `api` | HTTP calls | the Node backend, or the Go server with `ACCEPTANCE_BACKEND=go` |
| `web` | the Next.js app in a browser | the Node backend behind it |
| `spa` | the Vite app (`web/`) in a browser | the Go server, which serves it |

## Running

```bash
# From the repo root: the test database, the Node backend on :3010, the Go
# server and the Vite app on :3020, and the Next.js app on :3110 (the web
# project's system under test)
docker compose -f docker-compose.test.yml up -d postgres-test db-migrate-test backend-test server-test frontend-test

cd acceptance
npm ci
npx playwright install chromium                  # once, for the web and spa projects
npm test -- --project api --project web          # the Node backend and the Next.js app
npm test -- --project api                        # one project; no frontend needed
ACCEPTANCE_API_URL=http://localhost:3020 ACCEPTANCE_BACKEND=go npm test -- --project api --project spa  # the Go server (server-test) and its SPA
npm run typecheck
```

`ACCEPTANCE_WEB_URL` (default `http://localhost:3110`) points the web project at
another app. The app finds its backend itself; `frontend-test` talks to `:3010`.
`ACCEPTANCE_SPA_URL` (default `http://localhost:3020`) points the spa project at
another Go server. A local one built from `server/` serves the SPA when
`web/` was built first (see [server/README.md](../server/README.md#the-web-app)).
`ACCEPTANCE_BACKEND` (`node`, the default, or `go`) says which server the api
and web URLs reach, which decides where the [known bugs](#known-bugs) are
expected to fail. The spa project is always on `go`.

CI runs `api` and `web` against Node in the `acceptance-tests` job, then `api`
and `spa` against the Go server (`server-test`), and `scripts/test-all.sh` does
the same in its last two phases, so a failing acceptance test blocks a deploy.
See [docs/TESTING.md](../docs/TESTING.md#all-tests).

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
| `habits` | create, rename, archive, restore, delete; check off and uncheck days; notes; every habit's days over a period; completion rates |
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

It covers a feature the SPA has not built yet too. A bead listed on `spa`
marks the test as an expected failure in the spa project only. A test that
needs several features names all their beads, and stays an expected failure
until the last of them lands. The period scenarios needed both the Dots view
and the habit detail page:

```ts
test("a period shows every habit's checked-off days in it", async ({ users, habits, knownBug }) => {
  knownBug('habitcraft-vxln.15', 'habitcraft-vxln.16');
  // ...
});
```

When the Dots view (habitcraft-vxln.15) landed, its bead came off them, and
they waited on the detail page alone until it landed too (habitcraft-vxln.16).

When a view lands, take `spa` off its bead in `dsl/knownBugs.ts`. Each test
that names it then either passes, and its mark comes out, or is still held by
another bead it names.

Behaviour that has no words in the user's language — a request for another
user's habit by id, a malformed token, an expired one — stays in the backend's
integration tests, which talk HTTP directly.

## The API driver and the contract

`drivers/api/` sends each action as the HTTP calls a client would make, with a
bearer token. It checks **every** response against
`shared/api-spec/openapi.yaml` (`apiDescription.ts`). A passing scenario
therefore also proves the server kept the contract, whichever server it was.
It reads checked-off days through `GET /api/v1/completions`, as the SPA's
Today and Dots views will, rather than the year `GET /api/v1/habits` embeds,
so every completions scenario exercises the range endpoint on both backends
(habitcraft-vxln.12).
`api.generated.ts` is generated by `npm run api:codegen` at the repo root;
never edit it by hand.

## The web driver

`drivers/web/` clicks through the Next.js app in a real Chromium, and reads
every observation off the screen. Its selectors live there and nowhere else.
It goes with the Next.js app at cutover, when the [SPA driver](#the-spa-driver)
takes its place; the test cases stay as they are.

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
- A period is read day by day off each habit's week view, one habit at a time,
  so keep a period scenario to a week or so.
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
- The Next.js app shows no completion rates, so the rate scenarios are
  **skipped on `web`** the same way. The SPA shows them on its habit detail
  page.

## The SPA driver

`drivers/spa/` clicks through the Vite app (`web/`) that the Go server serves,
in a real Chromium, and reads every observation off the screen. It works like
the web driver: a fresh browser context for each sign-in, contexts in UTC, and
on-screen messages mapped onto refusals, with an unknown one thrown.

- Its selectors are roles, labels and accessible names, never classes: the
  Habits page's `Active habits` and `Archived habits` regions, each habit's name
  as a level-3 heading, the Profile page's sections by their titles.
- A form field refuses a value when it cuts it short at its `maxLength` or the
  browser marks it invalid (`required`, `type=email`, `minLength`). The driver
  reports that as `invalid-input` and never submits.
- Renewing the session drops the access-token cookie and reloads, as for the
  web driver. The app renews from the refresh token or shows sign-in.
- Habits are added, renamed, archived, restored and deleted on the Habits page.
- Today is checked off, read and unchecked on the Today view, where signing in
  lands: its `To do` region, and the collapsed `Completed today` region, which
  the driver opens to read. Like the web driver, it reports a second check-off
  as `already-checked-off` from the habit already showing as done, without a
  click. Undoing a day with a note asks first, and the driver confirms.
- A period is read off the Dots view: each active habit's card, whose dots
  are `<time>` elements naming their dates, each titled with whether that day
  is done. The view shows the last 196 days, and the driver throws for a
  period that starts earlier.
- Any other day, any note, and a habit's completion rates are read and
  changed on the habit's detail page, opened by clicking its name on the Dots
  view. The driver steps the month calendar back or forward a month at a
  time, as a person would, and finds a day by the `<time>` inside its toggle;
  `aria-pressed` says whether it is done. A day after today is a disabled
  toggle, and a month after this one cannot be shown at all: either is
  reported as `invalid-input`. As on Today, it reports a second check-off as
  `already-checked-off` without a click, and confirms when undoing a day with
  a note.
- A note is written in its day's dialog, opened from the month's `Days done`
  list, which also shows each note. A check-off with a note is a check-off
  followed by that dialog. Clearing a note is the dialog's `Delete note`.
- Rates are read off the page's `Completion rate` region as "N of M days".
