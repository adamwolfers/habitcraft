import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { alice, fakeServer, habit, type Answer } from '../test/fakeServer.ts';
import { renderApp } from '../test/renderApp.tsx';
import { requestLimits } from '../types/api.ts';

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

const run = habit('Morning run', { color: '#22C55E' });

/** The habit's checked-off days, each with its note. */
type Days = Record<string, string | null>;

const completion = (date: string, notes: string | null) => ({
  id: `c-${date}`,
  habitId: run.id,
  date,
  notes,
  createdAt: `${date}T09:00:00Z`,
});

/**
 * The detail page for Morning run, on a server that keeps its days: the
 * completions endpoint answers from them, and checking off, undoing and
 * noting change them. The rates count the days kept, out of 30 and 365.
 */
async function openDetail(days: Days = {}, routes: Record<string, Route> = {}, query = '') {
  const kept = { ...days };
  const base = `/api/v1/habits/${run.id}`;
  const dateIn = (request: Request) => new URL(request.url).pathname.split('/').at(-1)!;
  const server = fakeServer({
    'GET /api/v1/users/me': [200, alice],
    'GET /api/v1/habits': [200, [{ ...run, completions: [] }]],
    [`GET ${base}/completions`]: (request) => {
      const params = new URL(request.url).searchParams;
      const [start, end] = [params.get('startDate')!, params.get('endDate')!];
      return [
        200,
        Object.keys(kept)
          .filter((date) => date >= start && date <= end)
          .sort()
          .reverse()
          .map((date) => completion(date, kept[date]!)),
      ];
    },
    [`POST ${base}/completions`]: async (request) => {
      const { date } = (await request.json()) as { date: string };
      kept[date] = null;
      return [201, completion(date, null)];
    },
    [`DELETE ${base}/completions/:date`]: (request) => {
      const date = dateIn(request);
      delete kept[date];
      return [200, { message: 'Completion removed', habitId: run.id, date }];
    },
    [`PUT ${base}/completions/:date`]: async (request) => {
      const date = dateIn(request);
      const { notes } = (await request.json()) as { notes: string | null };
      kept[date] = notes;
      return [200, completion(date, notes)];
    },
    [`GET ${base}/stats`]: () => {
      const done = Object.keys(kept).length;
      return [
        200,
        {
          habitId: run.id,
          last30Days: { completedDays: done, totalDays: 30, rate: done / 30 },
          last365Days: { completedDays: done, totalDays: 365, rate: done / 365 },
        },
      ];
    },
    ...routes,
  });
  const view = renderApp(`/habits/${run.id}${query}`);
  await screen.findByRole('heading', { level: 1, name: 'Morning run' });
  await within(calendar()).findByRole('table');
  return { server, ...view };
}

const calendar = () => screen.getByRole('region', { name: 'Calendar' });

/** The month the calendar shows, as its heading names it. */
const shownMonth = () =>
  within(calendar()).getByRole('heading', { level: 2 }).querySelector('time')!.dateTime;

/** A day's toggle in the calendar. */
function day(date: string): HTMLElement {
  const time = within(calendar()).getByRole('table').querySelector(`time[datetime="${date}"]`);
  if (!time) throw new Error(`${date} is not in the calendar`);
  return time.closest('button')!;
}

const daysDone = () => screen.getByRole('region', { name: 'Days done' });

/** The dates in the month's list of days done, in the order shown. */
const doneDates = () =>
  Array.from(daysDone().querySelectorAll('li time')).map(
    (time) => (time as HTMLTimeElement).dateTime
  );

function doneItem(date: string): HTMLElement {
  return daysDone().querySelector(`time[datetime="${date}"]`)!.closest('li')!;
}

const rate = (window: string) =>
  within(screen.getByRole('region', { name: 'Completion rate' }))
    .getByText(window)
    .closest('li');

describe('HabitDetailPage', () => {
  it("shows the habit's month, with its done days pressed", async () => {
    await openDetail({ '2026-10-03': null, '2026-10-21': null });

    expect(shownMonth()).toBe('2026-10');
    expect(within(calendar()).getByRole('heading', { level: 2 })).toHaveTextContent('October 2026');
    expect(day('2026-10-03')).toHaveAttribute('aria-pressed', 'true');
    expect(day('2026-10-21')).toHaveAttribute('aria-pressed', 'true');
    expect(day('2026-10-22')).toHaveAttribute('aria-pressed', 'false');
    expect(within(calendar()).getAllByRole('button', { pressed: true })).toHaveLength(2);
  });

  it('asks only for the days of the month it shows', async () => {
    const { server } = await openDetail();

    const asked = server.requests
      .map((request) => new URL(request.url))
      .find((url) => url.pathname.endsWith('/completions'))!;
    expect(asked.searchParams.get('startDate')).toBe('2026-10-01');
    expect(asked.searchParams.get('endDate')).toBe('2026-10-31');
  });

  it('lays the month out in weeks from Sunday', async () => {
    await openDetail();

    const rows = within(within(calendar()).getByRole('table')).getAllByRole('row');
    // A header of weekdays, then five weeks: 1 October 2026 is a Thursday.
    expect(rows).toHaveLength(6);
    const firstWeek = within(rows[1]!).getAllByRole('cell');
    expect(firstWeek).toHaveLength(7);
    expect(firstWeek[4]!.querySelector('time')!.dateTime).toBe('2026-10-01');
    expect(firstWeek[3]!.querySelector('time')).toBeNull();
  });

  it('holds back the days after today, and today is open', async () => {
    await openDetail();

    expect(day('2026-10-23')).toBeDisabled();
    expect(day('2026-10-31')).toBeDisabled();
    expect(day('2026-10-22')).toBeEnabled();
    expect(day('2026-10-01')).toBeEnabled();
  });

  it('names each day in full for a screen reader', async () => {
    await openDetail({ '2026-10-21': 'Hills' });

    expect(day('2026-10-20')).toHaveAccessibleName('Tue, Oct 20, 2026');
    expect(day('2026-10-21')).toHaveAccessibleName('Wed, Oct 21, 2026, with a note');
  });

  describe('checking off and undoing a day', () => {
    it('checks off a past day when it is tapped, and the rates follow', async () => {
      const { server, user } = await openDetail();
      await vi.waitFor(() => expect(rate('Last 30 days')).toHaveTextContent('0 of 30 days'));

      await user.click(day('2026-10-10'));

      await vi.waitFor(() => expect(day('2026-10-10')).toHaveAttribute('aria-pressed', 'true'));
      expect(await server.bodiesSentTo(`POST /api/v1/habits/${run.id}/completions`)).toEqual([
        { date: '2026-10-10' },
      ]);
      await vi.waitFor(() => expect(rate('Last 30 days')).toHaveTextContent('1 of 30 days'));
      expect(doneDates()).toEqual(['2026-10-10']);
    });

    it('undoes a done day without a note at once', async () => {
      const { server, user } = await openDetail({ '2026-10-10': null });

      await user.click(day('2026-10-10'));

      await vi.waitFor(() => expect(day('2026-10-10')).toHaveAttribute('aria-pressed', 'false'));
      const deleted = server.requests.filter((request) => request.method === 'DELETE');
      expect(new URL(deleted[0]!.url).pathname).toBe(
        `/api/v1/habits/${run.id}/completions/2026-10-10`
      );
    });

    it('asks before undoing a day with a note, since the note goes with it', async () => {
      const { server, user } = await openDetail({ '2026-10-10': 'Hills' });

      await user.click(day('2026-10-10'));

      expect(within(calendar()).getByText(/delete its note/)).toBeVisible();
      expect(server.requests.filter((request) => request.method === 'DELETE')).toHaveLength(0);

      await user.click(within(calendar()).getByRole('button', { name: 'Undo and delete note' }));
      await vi.waitFor(() => expect(day('2026-10-10')).toHaveAttribute('aria-pressed', 'false'));
      expect(within(calendar()).queryByText(/delete its note/)).not.toBeInTheDocument();
    });

    it('keeps the day and its note when the user thinks better of it', async () => {
      const { server, user } = await openDetail({ '2026-10-10': 'Hills' });

      await user.click(day('2026-10-10'));
      await user.click(within(calendar()).getByRole('button', { name: 'Keep it' }));

      expect(within(calendar()).queryByText(/delete its note/)).not.toBeInTheDocument();
      expect(day('2026-10-10')).toHaveAttribute('aria-pressed', 'true');
      expect(server.requests.filter((request) => request.method === 'DELETE')).toHaveLength(0);
    });

    it('treats a day already done elsewhere as done', async () => {
      const { user } = await openDetail(
        {},
        {
          [`POST /api/v1/habits/${run.id}/completions`]: [
            409,
            { error: 'Habit already completed for this date' },
          ],
        }
      );

      await user.click(day('2026-10-10'));

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('says so when a change fails, and leaves the day as it was', async () => {
      const { user } = await openDetail(
        {},
        { [`POST /api/v1/habits/${run.id}/completions`]: [500, { error: 'boom' }] }
      );

      await user.click(day('2026-10-10'));

      expect(await within(calendar()).findByRole('alert')).toHaveTextContent(
        'Something went wrong'
      );
      expect(day('2026-10-10')).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('moving between months', () => {
    it('steps back a month, and forward again as far as this one', async () => {
      const { user } = await openDetail({ '2026-09-30': null });
      // Looked up afresh each time: each month is drawn anew.
      const next = () => within(calendar()).getByRole('button', { name: 'Next month' });
      expect(next()).toBeDisabled();

      await user.click(within(calendar()).getByRole('button', { name: 'Previous month' }));

      await vi.waitFor(() => expect(shownMonth()).toBe('2026-09'));
      await vi.waitFor(() => expect(day('2026-09-30')).toHaveAttribute('aria-pressed', 'true'));
      expect(day('2026-09-30')).toBeEnabled();
      expect(next()).toBeEnabled();

      await user.click(next());
      await vi.waitFor(() => expect(shownMonth()).toBe('2026-10'));
    });

    it('opens on the month the address names', async () => {
      await openDetail({}, {}, '?month=2025-12');

      expect(shownMonth()).toBe('2025-12');
    });

    it('opens on this month when the address names a later one, or none that exists', async () => {
      await openDetail({}, {}, '?month=2027-01');
      expect(shownMonth()).toBe('2026-10');
    });

    it('ignores a month that is not one', async () => {
      await openDetail({}, {}, '?month=soon');
      expect(shownMonth()).toBe('2026-10');
    });
  });

  describe('the completion rates', () => {
    it('shows each window as days done of days counted, and a percentage', async () => {
      await openDetail(
        {},
        {
          [`GET /api/v1/habits/${run.id}/stats`]: [
            200,
            {
              habitId: run.id,
              last30Days: { completedDays: 3, totalDays: 10, rate: 0.3 },
              last365Days: { completedDays: 120, totalDays: 365, rate: 120 / 365 },
            },
          ],
        }
      );

      await vi.waitFor(() =>
        expect(rate('Last 30 days')).toHaveTextContent('Last 30 days3 of 10 days30%')
      );
      expect(rate('Last 365 days')).toHaveTextContent('Last 365 days120 of 365 days33%');
    });

    it('says so when they cannot be loaded', async () => {
      await openDetail({}, { [`GET /api/v1/habits/${run.id}/stats`]: [500, { error: 'boom' }] });

      expect(
        await within(screen.getByRole('region', { name: 'Completion rate' })).findByRole('alert')
      ).toHaveTextContent('could not be loaded');
    });
  });

  describe('notes', () => {
    it("lists the month's done days newest first, each with its note", async () => {
      await openDetail({ '2026-10-03': null, '2026-10-21': 'Hills', '2026-09-30': 'Not shown' });

      expect(doneDates()).toEqual(['2026-10-21', '2026-10-03']);
      expect(within(doneItem('2026-10-21')).getByRole('paragraph')).toHaveTextContent('Hills');
      expect(within(doneItem('2026-10-03')).queryByRole('paragraph')).not.toBeInTheDocument();
    });

    it('says when no day this month is done yet', async () => {
      await openDetail();

      expect(within(daysDone()).getByText(/No days done/)).toBeVisible();
    });

    it('adds a note to a done day', async () => {
      const { server, user } = await openDetail({ '2026-10-21': null });

      await user.click(within(doneItem('2026-10-21')).getByRole('button', { name: /^Add note/ }));
      const dialog = screen.getByRole('dialog', { name: /Note for Wed, Oct 21, 2026/ });
      expect(within(dialog).queryByRole('button', { name: 'Delete note' })).not.toBeInTheDocument();
      await user.type(within(dialog).getByLabelText('Note'), '  Hills  ');
      await user.click(within(dialog).getByRole('button', { name: 'Save' }));

      await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(within(doneItem('2026-10-21')).getByRole('paragraph')).toHaveTextContent('Hills');
      expect(
        await server.bodiesSentTo(`PUT /api/v1/habits/${run.id}/completions/2026-10-21`)
      ).toEqual([{ notes: 'Hills' }]);
    });

    it('edits a note, and saving it empty clears it', async () => {
      const { server, user } = await openDetail({ '2026-10-21': 'Hills' });

      await user.click(within(doneItem('2026-10-21')).getByRole('button', { name: /^Edit note/ }));
      const field = within(screen.getByRole('dialog')).getByLabelText('Note');
      expect(field).toHaveValue('Hills');
      await user.clear(field);
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }));

      await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(within(doneItem('2026-10-21')).queryByRole('paragraph')).not.toBeInTheDocument();
      expect(
        await server.bodiesSentTo(`PUT /api/v1/habits/${run.id}/completions/2026-10-21`)
      ).toEqual([{ notes: null }]);
    });

    it('deletes a note', async () => {
      const { server, user } = await openDetail({ '2026-10-21': 'Hills' });

      await user.click(within(doneItem('2026-10-21')).getByRole('button', { name: /^Edit note/ }));
      await user.click(
        within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete note' })
      );

      await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(
        await server.bodiesSentTo(`PUT /api/v1/habits/${run.id}/completions/2026-10-21`)
      ).toEqual([{ notes: null }]);
    });

    it('closes without saving on Cancel or Escape', async () => {
      const { server, user } = await openDetail({ '2026-10-21': 'Hills' });
      const edit = () =>
        user.click(within(doneItem('2026-10-21')).getByRole('button', { name: /^Edit note/ }));

      await edit();
      await user.type(within(screen.getByRole('dialog')).getByLabelText('Note'), ' and more');
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      await edit();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(server.requests.filter((request) => request.method === 'PUT')).toHaveLength(0);
    });

    it("stops a note at the spec's limit, and counts down to it", async () => {
      const { user } = await openDetail({ '2026-10-21': null });
      const limit = requestLimits.updateCompletionNote.notes.maxLength;

      await user.click(within(doneItem('2026-10-21')).getByRole('button', { name: /^Add note/ }));
      const dialog = screen.getByRole('dialog');

      expect(within(dialog).getByLabelText('Note')).toHaveAttribute('maxLength', String(limit));
      await user.type(within(dialog).getByLabelText('Note'), 'Hills');
      expect(within(dialog).getByText(`5/${limit}`)).toBeVisible();
    });

    it('keeps the dialog open and says why when a save is refused', async () => {
      const { user } = await openDetail(
        { '2026-10-21': null },
        {
          [`PUT /api/v1/habits/${run.id}/completions/:date`]: [
            400,
            { errors: [{ msg: 'Notes are too long' }] },
          ],
        }
      );

      await user.click(within(doneItem('2026-10-21')).getByRole('button', { name: /^Add note/ }));
      await user.type(within(screen.getByRole('dialog')).getByLabelText('Note'), 'Hills');
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }));

      expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent(
        'Some details are not valid: Notes are too long.'
      );
    });
  });

  it('says when the habit is not one of the user’s', async () => {
    fakeServer({
      'GET /api/v1/users/me': [200, alice],
      'GET /api/v1/habits': [200, []],
    });
    renderApp(`/habits/${run.id}`);

    expect(await screen.findByText(/could not be found/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to Dots' })).toHaveAttribute('href', '/dots');
  });

  it('says so when its days cannot be loaded', async () => {
    fakeServer({
      'GET /api/v1/users/me': [200, alice],
      'GET /api/v1/habits': [200, [{ ...run, completions: [] }]],
      [`GET /api/v1/habits/${run.id}/completions`]: [500, { error: 'boom' }],
      [`GET /api/v1/habits/${run.id}/stats`]: [500, { error: 'boom' }],
    });
    renderApp(`/habits/${run.id}`);

    expect(
      await within(await screen.findByRole('region', { name: 'Calendar' })).findByRole('alert')
    ).toHaveTextContent('could not be loaded');
  });

  it('leads back to the Dots view', async () => {
    await openDetail();

    expect(screen.getByRole('link', { name: 'Back to Dots' })).toHaveAttribute('href', '/dots');
    // The page is reached from Dots, so the Habits link is not the current page.
    expect(screen.getByRole('link', { name: 'Habits' })).not.toHaveAttribute('aria-current');
  });
});
