import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../api/client.ts';
import { COMPLETIONS, completionsKey, fetchCompletions } from '../api/completions.ts';
import { useHabits } from '../api/habits.ts';
import { messageFor } from '../api/messages.ts';
import { Button, ErrorMessage } from '../components/forms.tsx';
import { useToday } from '../today/today.ts';
import type { Habit } from '../types/api.ts';

/** Today's completion for each habit that has one, keyed by habit id. */
type Done = Record<string, { notes: string | null }>;

async function fetchDone(date: string): Promise<Done> {
  const done: Done = {};
  for (const { habitId, completions } of await fetchCompletions(date, date)) {
    if (completions[0]) done[habitId] = { notes: completions[0].notes };
  }
  return done;
}

/**
 * Today's completions, and the changes to them. A change updates this day at
 * once and marks every other range stale, so a view of more days reloads.
 */
function useDone(date: string) {
  const queryClient = useQueryClient();
  const key = completionsKey(date, date);
  const done = useQuery({ queryKey: key, queryFn: () => fetchDone(date) });

  const set = (habitId: string, completion: Done[string] | undefined) => {
    queryClient.setQueryData<Done>(key, (current = {}) => {
      const next = { ...current };
      if (completion) next[habitId] = completion;
      else delete next[habitId];
      return next;
    });
    void queryClient.invalidateQueries({ queryKey: [COMPLETIONS], refetchType: 'none' });
  };

  return { done, set, reload: () => queryClient.invalidateQueries({ queryKey: key }) };
}

export function TodayPage() {
  const today = useToday();
  const habits = useHabits();
  const { done, set, reload } = useDone(today);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Today</h1>
        <p className="text-sm text-gray-400">{formatDay(today)}</p>
      </div>
      {habits.isPending || done.isPending ? (
        <p role="status" className="text-gray-400">
          Loading today…
        </p>
      ) : habits.isError || done.isError ? (
        <ErrorMessage>
          Today's habits could not be loaded. Reload the page to try again.
        </ErrorMessage>
      ) : (
        <TodayLists
          date={today}
          habits={habits.data.filter((habit) => habit.status === 'active')}
          done={done.data}
          set={set}
          reload={reload}
        />
      )}
    </div>
  );
}

interface Changes {
  date: string;
  set: (habitId: string, completion: Done[string] | undefined) => void;
  reload: () => Promise<void>;
}

function TodayLists({ habits, done, ...changes }: Changes & { habits: Habit[]; done: Done }) {
  const [open, setOpen] = useState(false);

  if (habits.length === 0) {
    return (
      <p className="text-gray-400">
        No habits yet.{' '}
        <Link to="/habits" className="text-blue-400 underline hover:text-blue-300">
          Create a habit
        </Link>{' '}
        to start checking it off each day.
      </p>
    );
  }

  const toDo = habits.filter((habit) => !done[habit.id]);
  const completed = habits.filter((habit) => done[habit.id]);

  return (
    <>
      <section aria-label="To do" className="space-y-2">
        {toDo.length === 0 ? (
          <p className="text-lg text-green-300">All done for today</p>
        ) : (
          <ul className="space-y-2">
            {toDo.map((habit) => (
              <ToDoRow key={habit.id} habit={habit} {...changes} />
            ))}
          </ul>
        )}
      </section>
      {completed.length > 0 && (
        <section aria-label="Completed today" className="space-y-2">
          <button
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="flex w-full items-center gap-2 text-left text-sm font-medium text-gray-300 hover:text-white"
          >
            <span aria-hidden="true">{open ? '▾' : '▸'}</span>
            Completed today ({completed.length})
          </button>
          {open && (
            <ul className="space-y-2">
              {completed.map((habit) => (
                <DoneRow
                  key={habit.id}
                  habit={habit}
                  noted={Boolean(done[habit.id]?.notes)}
                  {...changes}
                />
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}

/** Run one change for a row, holding its button and keeping its error. */
function useRowChange() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function change(send: () => Promise<string | undefined>) {
    setBusy(true);
    setError('');
    try {
      setError((await send()) ?? '');
    } catch {
      setError(messageFor(undefined, undefined));
    } finally {
      setBusy(false);
    }
  }

  return { error, busy, change };
}

function ToDoRow({ habit, date, set, reload }: Changes & { habit: Habit }) {
  const { error, busy, change } = useRowChange();

  const checkOff = () =>
    change(async () => {
      const { data, error, response } = await api.POST('/api/v1/habits/{habitId}/completions', {
        params: { path: { habitId: habit.id } },
        body: { date },
      });
      if (data) set(habit.id, { notes: data.notes });
      // Checked off elsewhere, in another tab or on another device.
      else if (response.status === 409) await reload();
      else return messageFor(response.status, error);
    });

  return (
    <li className="space-y-2 rounded-lg bg-gray-800/60 p-4">
      <ErrorMessage>{error}</ErrorMessage>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium break-all">{habit.name}</h3>
        <Button aria-label={`Check off ${habit.name}`} disabled={busy} onClick={checkOff}>
          Done
        </Button>
      </div>
    </li>
  );
}

function DoneRow({ habit, noted, date, set }: Changes & { habit: Habit; noted: boolean }) {
  const { error, busy, change } = useRowChange();
  const [confirming, setConfirming] = useState(false);

  const undo = () =>
    change(async () => {
      const { error, response } = await api.DELETE('/api/v1/habits/{habitId}/completions/{date}', {
        params: { path: { habitId: habit.id, date } },
      });
      // A 404 means the day is already undone, which is what was asked.
      if (response.ok || response.status === 404) set(habit.id, undefined);
      else return messageFor(response.status, error);
    });

  return (
    <li className="space-y-2 rounded-lg bg-gray-800/30 p-4">
      <ErrorMessage>{error}</ErrorMessage>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium break-all text-gray-400">{habit.name}</h3>
        {confirming ? (
          <div className="flex items-center gap-2">
            {/* The note lives on the day, so undoing the day deletes it. */}
            <span className="text-sm text-gray-300">Undo and delete its note?</span>
            <Button variant="danger" disabled={busy} onClick={undo}>
              Undo and delete note
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
          </div>
        ) : (
          <Button
            variant="secondary"
            aria-label={`Undo ${habit.name}`}
            disabled={busy}
            onClick={noted ? () => setConfirming(true) : undo}
          >
            Undo
          </Button>
        )}
      </div>
    </li>
  );
}

/** "Thursday, 22 October", from a YYYY-MM-DD date, in the user's language. */
function formatDay(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year!, month! - 1, day).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}
