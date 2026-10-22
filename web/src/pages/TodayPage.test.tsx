import { act, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

const run = habit('Morning run');
const read = habit('Read');
const stretch = habit('Stretch', { status: 'archived' });

const completion = (h: { id: string }, notes: string | null = null) => ({
  id: `c-${h.id}`,
  habitId: h.id,
  date: TODAY,
  notes,
  createdAt: '2026-10-22T09:00:00Z',
});

type Done = Record<string, string | null>;

/**
 * A server that keeps today's completions, keyed by habit id, with each one's
 * note: the range endpoint answers from them, and checking off and undoing
 * change them.
 */
async function openToday(
  habits: ReturnType<typeof habit>[],
  done: Done = {},
  routes: Record<string, Route> = {}
) {
  const days = { ...done };
  const path = (h: { id: string }) => `/api/v1/habits/${h.id}/completions`;
  const server = fakeServer({
    'GET /api/v1/users/me': [200, alice],
    'GET /api/v1/habits': [200, habits.map((h) => ({ ...h, completions: [] }))],
    'GET /api/v1/completions': (request) => {
      const day = new URL(request.url).searchParams.get('startDate');
      return [
        200,
        habits.map((h) => ({
          habitId: h.id,
          completions: day === TODAY && h.id in days ? [completion(h, days[h.id])] : [],
        })),
      ];
    },
    ...Object.fromEntries(
      habits.flatMap((h) => [
        [
          `POST ${path(h)}`,
          () => {
            days[h.id] = null;
            return [201, completion(h)] as Answer;
          },
        ],
        [
          `DELETE ${path(h)}/${TODAY}`,
          () => {
            delete days[h.id];
            return [200, { message: 'Completion removed', habitId: h.id, date: TODAY }] as Answer;
          },
        ],
      ])
    ),
    ...routes,
  });
  const view = renderApp('/');
  await screen.findByRole('heading', { level: 1, name: 'Today' });
  await vi.waitFor(() => expect(screen.queryByText(/^Loading/)).not.toBeInTheDocument());
  return { server, ...view };
}

const toDo = () =>
  within(screen.queryByRole('region', { name: 'To do' }) ?? document.createElement('div'))
    .queryAllByRole('heading', { level: 3 })
    .map((heading) => heading.textContent);

const completedToggle = () => screen.queryByRole('button', { name: /^Completed today/ });

async function completed(user: ReturnType<typeof renderApp>['user']) {
  const toggle = completedToggle();
  if (!toggle) return [];
  if (toggle.getAttribute('aria-expanded') === 'false') await user.click(toggle);
  return within(screen.getByRole('region', { name: 'Completed today' }))
    .queryAllByRole('heading', { level: 3 })
    .map((heading) => heading.textContent);
}

const doneRow = (name: string) =>
  within(screen.getByRole('region', { name: 'Completed today' }))
    .getByRole('heading', { level: 3, name })
    .closest('li') as HTMLElement;

describe('TodayPage', () => {
  it("lists the active habits not yet done today, asking only for today's days", async () => {
    const { server } = await openToday([run, read, stretch], { [read.id]: null });

    expect(toDo()).toEqual(['Morning run']);
    const asked = server.requests
      .map((request) => new URL(request.url))
      .filter((url) => url.pathname === '/api/v1/completions');
    expect(asked[0]?.searchParams.get('startDate')).toBe(TODAY);
    expect(asked[0]?.searchParams.get('endDate')).toBe(TODAY);
  });

  it('is where a signed-in user lands', async () => {
    await openToday([run]);

    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
  });

  it('checks a habit off for today and takes it off the list, with no toast', async () => {
    const { server, user } = await openToday([run, read]);

    await user.click(screen.getByRole('button', { name: 'Check off Morning run' }));

    await vi.waitFor(() => expect(toDo()).toEqual(['Read']));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(await server.bodiesSentTo(`POST /api/v1/habits/${run.id}/completions`)).toEqual([
      { date: TODAY },
    ]);
    expect(completedToggle()).toHaveTextContent('Completed today (1)');
  });

  it("keeps the completed row collapsed until it's opened", async () => {
    const { user } = await openToday([run, read], { [read.id]: null });

    expect(completedToggle()).toHaveAttribute('aria-expanded', 'false');
    expect(completedToggle()).toHaveTextContent('Completed today (1)');
    expect(
      within(screen.getByRole('region', { name: 'Completed today' })).queryByRole('listitem')
    ).not.toBeInTheDocument();

    expect(await completed(user)).toEqual(['Read']);
    expect(completedToggle()).toHaveAttribute('aria-expanded', 'true');

    await user.click(completedToggle()!);
    expect(completedToggle()).toHaveAttribute('aria-expanded', 'false');
  });

  it('hides the completed row when nothing is done yet', async () => {
    await openToday([run]);

    expect(completedToggle()).not.toBeInTheDocument();
  });

  it('undoes a completion, returning the habit to the list', async () => {
    const { user } = await openToday([run], { [run.id]: null });
    await completed(user);

    await user.click(
      within(doneRow('Morning run')).getByRole('button', { name: 'Undo Morning run' })
    );

    await vi.waitFor(() => expect(toDo()).toEqual(['Morning run']));
    expect(completedToggle()).not.toBeInTheDocument();
  });

  describe('undoing a day with a note', () => {
    it('asks first, since the note goes with it', async () => {
      const { server, user } = await openToday([run], { [run.id]: '5k in the rain' });
      await completed(user);

      await user.click(
        within(doneRow('Morning run')).getByRole('button', { name: 'Undo Morning run' })
      );

      expect(within(doneRow('Morning run')).getByText(/delete its note/)).toBeVisible();
      const deletes = server.requests.filter((request) => request.method === 'DELETE');
      expect(deletes).toHaveLength(0);

      await user.click(
        within(doneRow('Morning run')).getByRole('button', { name: 'Undo and delete note' })
      );
      await vi.waitFor(() => expect(toDo()).toEqual(['Morning run']));
    });

    it('keeps the day when the user thinks better of it', async () => {
      const { server, user } = await openToday([run], { [run.id]: '5k in the rain' });
      await completed(user);

      await user.click(
        within(doneRow('Morning run')).getByRole('button', { name: 'Undo Morning run' })
      );
      await user.click(within(doneRow('Morning run')).getByRole('button', { name: 'Keep it' }));

      expect(within(doneRow('Morning run')).queryByText(/delete its note/)).not.toBeInTheDocument();
      expect(toDo()).toEqual([]);
      expect(server.requests.filter((request) => request.method === 'DELETE')).toHaveLength(0);
    });
  });

  describe('empty states', () => {
    it('invites a user with no habits to create one', async () => {
      await openToday([stretch]);

      expect(screen.getByText(/No habits yet/)).toBeVisible();
      expect(screen.getByRole('link', { name: /create a habit/i })).toHaveAttribute(
        'href',
        '/habits'
      );
      expect(completedToggle()).not.toBeInTheDocument();
    });

    it('says all is done, with the completed row below', async () => {
      await openToday([run], { [run.id]: null });

      expect(screen.getByText('All done for today')).toBeVisible();
      expect(completedToggle()).toHaveTextContent('Completed today (1)');
    });
  });

  describe('failures', () => {
    it('shows why a check-off failed, and keeps the habit on the list', async () => {
      const { user } = await openToday(
        [run],
        {},
        {
          [`POST /api/v1/habits/${run.id}/completions`]: [500, { error: 'Internal server error' }],
        }
      );

      await user.click(screen.getByRole('button', { name: 'Check off Morning run' }));

      const row = screen.getByRole('heading', { level: 3, name: 'Morning run' }).closest('li')!;
      expect(await within(row as HTMLElement).findByRole('alert')).toHaveTextContent(
        'Something went wrong'
      );
      expect(toDo()).toEqual(['Morning run']);
    });

    it('says so when a check-off gets no answer', async () => {
      const { user } = await openToday(
        [run],
        {},
        {
          [`POST /api/v1/habits/${run.id}/completions`]: () => {
            throw new TypeError('Failed to fetch');
          },
        }
      );

      await user.click(screen.getByRole('button', { name: 'Check off Morning run' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
    });

    it('catches up when the habit was already checked off elsewhere', async () => {
      let elsewhere = false;
      const { user } = await openToday(
        [run],
        {},
        {
          'GET /api/v1/completions': () => [
            200,
            [{ habitId: run.id, completions: elsewhere ? [completion(run)] : [] }],
          ],
          [`POST /api/v1/habits/${run.id}/completions`]: () => {
            elsewhere = true;
            return [409, { error: 'Habit already completed for this date' }];
          },
        }
      );

      await user.click(screen.getByRole('button', { name: 'Check off Morning run' }));

      await vi.waitFor(() => expect(toDo()).toEqual([]));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('shows why an undo failed, and keeps the habit done', async () => {
      const { user } = await openToday(
        [run],
        { [run.id]: null },
        {
          [`DELETE /api/v1/habits/${run.id}/completions/${TODAY}`]: [
            500,
            { error: 'Internal server error' },
          ],
        }
      );
      await completed(user);

      await user.click(
        within(doneRow('Morning run')).getByRole('button', { name: 'Undo Morning run' })
      );

      expect(await within(doneRow('Morning run')).findByRole('alert')).toHaveTextContent(
        'Something went wrong'
      );
      expect(toDo()).toEqual([]);
    });

    it('counts an undo of a day already gone as done', async () => {
      const { user } = await openToday(
        [run],
        { [run.id]: null },
        {
          [`DELETE /api/v1/habits/${run.id}/completions/${TODAY}`]: [
            404,
            { error: 'Completion not found' },
          ],
        }
      );
      await completed(user);

      await user.click(
        within(doneRow('Morning run')).getByRole('button', { name: 'Undo Morning run' })
      );

      await vi.waitFor(() => expect(toDo()).toEqual(['Morning run']));
    });

    it("says so when today's habits cannot be loaded", async () => {
      fakeServer({
        'GET /api/v1/users/me': [200, alice],
        'GET /api/v1/habits': [200, []],
        'GET /api/v1/completions': [500, { error: 'Internal server error' }],
      });
      renderApp('/');

      expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded');
    });
  });

  it('moves on to the new day when the page comes back after midnight', async () => {
    const { server } = await openToday([run], { [run.id]: null });
    expect(toDo()).toEqual([]);

    vi.setSystemTime(new Date(2026, 9, 23, 7, 0));
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await vi.waitFor(() => expect(toDo()).toEqual(['Morning run']));
    const days = server.requests
      .map((request) => new URL(request.url))
      .filter((url) => url.pathname === '/api/v1/completions')
      .map((url) => url.searchParams.get('startDate'));
    expect(days).toContain('2026-10-23');
  });
});
