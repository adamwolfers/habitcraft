import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { firstDay } from '../dots/dots.ts';
import { alice, fakeServer, habit, type Answer } from '../test/fakeServer.ts';
import { renderApp } from '../test/renderApp.tsx';

beforeEach(() => {
  // Only the clock: user-event and React Query need real timers.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 22, 9, 0));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

type Route = Answer | ((request: Request) => Answer | Promise<Answer>);

const TODAY = '2026-10-22';

/** Created at nine in the morning, local time, on a day in October 2026. */
const createdOn = (day: number) => new Date(2026, 9, day, 9).toISOString();

const run = habit('Morning run', { createdAt: createdOn(20), color: '#22C55E' });
const read = habit('Read', { createdAt: createdOn(22) });
const stretch = habit('Stretch', { status: 'archived', createdAt: createdOn(1) });

const completion = (h: { id: string }, date: string) => ({
  id: `c-${h.id}-${date}`,
  habitId: h.id,
  date,
  notes: null,
  createdAt: `${date}T09:00:00Z`,
});

/** Each habit's checked-off days, by habit id. */
type Days = Record<string, string[]>;

/** The Dots view, on a server that answers the range endpoint from `days`. */
async function openDots(
  habits: ReturnType<typeof habit>[],
  days: Days = {},
  routes: Record<string, Route> = {}
) {
  const server = fakeServer({
    'GET /api/v1/users/me': [200, alice],
    'GET /api/v1/habits': [200, habits.map((h) => ({ ...h, completions: [] }))],
    'GET /api/v1/completions': (request) => {
      const query = new URL(request.url).searchParams;
      const [start, end] = [query.get('startDate')!, query.get('endDate')!];
      return [
        200,
        habits.map((h) => ({
          habitId: h.id,
          completions: (days[h.id] ?? [])
            .filter((date) => date >= start && date <= end)
            .sort()
            .reverse()
            .map((date) => completion(h, date)),
        })),
      ];
    },
    ...routes,
  });
  const view = renderApp('/dots');
  await screen.findByRole('heading', { level: 1, name: 'Dots' });
  return { ...view, server };
}

/** A habit's card, found by its name. */
async function card(name: string) {
  const heading = await screen.findByRole('heading', { level: 3, name });
  return heading.closest('li')!;
}

/** The days a card shows, oldest first, with whether each is done. */
function dots(cardElement: HTMLElement) {
  return Array.from(cardElement.querySelectorAll('time')).map((dot) => [
    dot.dateTime,
    dot.title.endsWith(': done'),
  ]);
}

describe('Dots view', () => {
  it('shows a card for each active habit, and none for an archived one', async () => {
    await openDots([run, read, stretch]);

    await card('Morning run');
    await card('Read');
    expect(screen.queryByRole('heading', { level: 3, name: 'Stretch' })).not.toBeInTheDocument();
  });

  it('reads every habit’s days in one request, from the first day a grid can show to today', async () => {
    const { server } = await openDots([run]);
    await card('Morning run');

    const ranges = server.requests
      .filter((request) => new URL(request.url).pathname === '/api/v1/completions')
      .map((request) => Object.fromEntries(new URL(request.url).searchParams));
    expect(ranges).toEqual([{ startDate: firstDay(TODAY), endDate: TODAY }]);
  });

  it('shows a dot for each day since the habit was created, ending today', async () => {
    await openDots([run], { [run.id]: ['2026-10-20', TODAY] });

    expect(dots(await card('Morning run'))).toEqual([
      ['2026-10-20', true],
      ['2026-10-21', false],
      [TODAY, true],
    ]);
  });

  it('starts at a day checked off before the habit was created', async () => {
    await openDots([read], { [read.id]: ['2026-10-19'] });

    expect(dots(await card('Read'))).toEqual([
      ['2026-10-19', true],
      ['2026-10-20', false],
      ['2026-10-21', false],
      [TODAY, false],
    ]);
  });

  it('fills a done day in the habit’s colour and outlines the rest', async () => {
    await openDots([run], { [run.id]: [TODAY] });
    const [first, , last] = (await card('Morning run')).querySelectorAll('time');

    expect(last).toHaveStyle({ backgroundColor: 'rgb(34, 197, 94)' });
    expect(first).toHaveStyle({ borderColor: 'rgb(34, 197, 94)' });
    expect(first).not.toHaveStyle({ backgroundColor: 'rgb(34, 197, 94)' });
  });

  it('names each dot’s date, for hovering', async () => {
    await openDots([run], { [run.id]: [TODAY] });
    const [first, , last] = (await card('Morning run')).querySelectorAll('time');

    expect(first).toHaveAttribute('title', 'Tue, Oct 20, 2026: not done');
    expect(last).toHaveAttribute('title', 'Thu, Oct 22, 2026: done');
  });

  it('sums up each grid for a screen reader', async () => {
    await openDots([run, read], { [run.id]: ['2026-10-20', TODAY] });

    expect(within(await card('Morning run')).getByRole('img')).toHaveAccessibleName(
      'Completed 2 of 3 days'
    );
    expect(within(await card('Read')).getByRole('img')).toHaveAccessibleName(
      'Completed 0 of 1 day'
    );
  });

  it('prompts to create a habit when there are none', async () => {
    await openDots([stretch]);

    expect(await screen.findByText(/No habits yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create a habit' })).toHaveAttribute('href', '/habits');
  });

  it('says so when the days cannot be loaded', async () => {
    await openDots([run], {}, { 'GET /api/v1/completions': [500, { error: 'boom' }] });

    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded');
  });

  it('shows a day checked off on the Today view', async () => {
    const days: Days = {};
    fakeServer({
      'GET /api/v1/users/me': [200, alice],
      'GET /api/v1/habits': [200, [{ ...run, completions: [] }]],
      'GET /api/v1/completions': () => [
        200,
        [{ habitId: run.id, completions: (days[run.id] ?? []).map((d) => completion(run, d)) }],
      ],
      [`POST /api/v1/habits/${run.id}/completions`]: () => {
        days[run.id] = [TODAY];
        return [201, completion(run, TODAY)];
      },
    });
    const { user } = renderApp('/dots');
    expect(within(await card('Morning run')).getByRole('img')).toHaveAccessibleName(
      'Completed 0 of 3 days'
    );

    await user.click(screen.getByRole('link', { name: 'Today' }));
    await user.click(await screen.findByRole('button', { name: 'Check off Morning run' }));
    await screen.findByText('All done for today');
    await user.click(screen.getByRole('link', { name: 'Dots' }));

    expect(
      await within(await card('Morning run')).findByRole('img', { name: 'Completed 1 of 3 days' })
    ).toBeInTheDocument();
  });
});
