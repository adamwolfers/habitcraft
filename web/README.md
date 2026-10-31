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
| `src/App.tsx` | The routes: `/login` and `/register` signed out; `/` (Today, where signing in lands), `/dots`, `/habits`, `/habits/:habitId` (a habit's detail page) and `/profile` signed in |
| `src/api/` | The API client, typed from the spec by openapi-fetch, and the messages for its failures |
| `src/today/` | Today's date on the user's own calendar, kept current past midnight |
| `src/dots/` | Which days each habit's grid on the Dots view shows |
| `src/calendar/` | The months on the habit detail page, and the date words every page shows |
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

## The Today view

Today lists the active habits not yet checked off on the user's local date,
read with one `GET /api/v1/completions` for that day. Checking one off takes
it off the list at once. The ones done today sit under a collapsed
`Completed today (N)`, and each can be undone. The date turns over at local
midnight and catches up when the page regains focus, as a sleeping machine
runs no timers.

A note lives on its day's completion, so undoing a day deletes its note. A
day with a note therefore asks before it is undone; one without is undone at
once.

## The Dots view

Dots shows a card for each active habit, its last 196 days as a grid of dots:
7 rows of 28 days, each row running left to right, the last one ending today
in the bottom-right corner. Every card shows the whole grid, however new the
habit, so the cards line up. A done day is filled in the habit's colour, and
the rest are outlined. Hovering a dot names its date. Each grid is one image
to a screen reader, summed up as "Completed 120 of 196 days".

The grid's shape is `ROWS` and `DAYS_PER_ROW` in `src/dots/dots.ts`. One
`GET /api/v1/completions` reads every habit's days at once. A check-off on
Today marks that range stale, so Dots reloads it when it next opens.

A card opens its habit's detail page: the name is a link stretched over the
whole card.

## The habit detail page

`/habits/:habitId` shows one habit: its completion rates over the last 30 and
365 days, from `GET /api/v1/habits/{habitId}/stats`, and a month calendar.
There are no streaks, by design.

The calendar opens on this month, with weeks from Sunday, and steps back a
month at a time; it stops at this month, since a later one would hold only
days that cannot be checked off. The month shown is in the address as
`?month=YYYY-MM`, left off for this month, so a reload keeps it. Each day is a
toggle. Tapping a past day, or today, checks it off or undoes it; the days
after today are disabled. One `GET /api/v1/habits/{habitId}/completions` reads
the month. A change marks the rates and every other view's completions stale.

Below the calendar, `Days done` lists the month's checked-off days, newest
first, with their notes. Each has an `Add note` or `Edit note` button that
opens the note dialog, which sets the note with
`PUT /api/v1/habits/{habitId}/completions/{date}`. Saving it empty, or
`Delete note`, clears it. The note's length limit comes from the spec.

As on Today, undoing a day with a note asks first, since the note lives on
the day's completion and goes with it; a day without one is undone at once.

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
