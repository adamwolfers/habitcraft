import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { api } from '../api/client.ts';
import { COMPLETIONS } from '../api/completions.ts';
import { useHabits } from '../api/habits.ts';
import { messageFor } from '../api/messages.ts';
import {
  addMonths,
  formatDate,
  formatMonth,
  isMonth,
  leadingBlanks,
  monthDays,
  monthOf,
} from '../calendar/calendar.ts';
import { Button, ErrorMessage } from '../components/forms.tsx';
import { useToday } from '../today/today.ts';
import { requestLimits, type Habit } from '../types/api.ts';

// From the spec, not a literal: the dialog sets notes through this operation.
const NOTE_LENGTH = requestLimits.updateCompletionNote.notes.maxLength;

/** One month's checked-off days, each with its note, keyed by date. */
type Month = Record<string, string | null>;

/** Under COMPLETIONS, so a change on Today or here marks every view stale. */
const monthKey = (habitId: string, month: string) => [COMPLETIONS, habitId, month] as const;

const statsKey = (habitId: string) => ['stats', habitId] as const;

async function fetchMonth(habitId: string, month: string): Promise<Month> {
  const days = monthDays(month);
  const { data, response } = await api.GET('/api/v1/habits/{habitId}/completions', {
    params: { path: { habitId }, query: { startDate: days[0], endDate: days.at(-1) } },
  });
  if (!data) throw new Error(`Loading completions failed with ${response.status}`);
  return Object.fromEntries(data.map((completion) => [completion.date, completion.notes]));
}

async function fetchStats(habitId: string) {
  const { data, response } = await api.GET('/api/v1/habits/{habitId}/stats', {
    params: { path: { habitId } },
  });
  if (!data) throw new Error(`Loading stats failed with ${response.status}`);
  return data;
}

export function HabitDetailPage() {
  const { habitId = '' } = useParams();
  const habits = useHabits();
  const habit = habits.data?.find((candidate) => candidate.id === habitId);

  if (habits.isPending) {
    return (
      <p role="status" className="text-gray-400">
        Loading your habit…
      </p>
    );
  }
  if (habits.isError) {
    return (
      <ErrorMessage>Your habit could not be loaded. Reload the page to try again.</ErrorMessage>
    );
  }
  if (!habit) {
    return (
      <div className="space-y-4">
        <ErrorMessage>This habit could not be found. It may have been deleted.</ErrorMessage>
        <BackToDots />
      </div>
    );
  }
  return <Detail habit={habit} />;
}

function BackToDots() {
  return (
    <Link to="/dots" className="text-sm text-blue-400 underline hover:text-blue-300">
      Back to Dots
    </Link>
  );
}

function Detail({ habit }: { habit: Habit }) {
  const today = useToday();
  const [search, setSearch] = useSearchParams();
  const asked = search.get('month');
  const thisMonth = monthOf(today);
  // A month after this one would be all disabled days, so it is never shown.
  const month = isMonth(asked) && asked <= thisMonth ? asked : thisMonth;
  const showMonth = (next: string) =>
    setSearch(next === thisMonth ? {} : { month: next }, { replace: true });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <BackToDots />
        <h1 className="text-2xl font-bold break-all">{habit.name}</h1>
      </div>
      <Rates habit={habit} />
      <MonthView
        key={month}
        habit={habit}
        month={month}
        today={today}
        onPrevious={() => showMonth(addMonths(month, -1))}
        onNext={month < thisMonth ? () => showMonth(addMonths(month, 1)) : undefined}
      />
    </div>
  );
}

function Rates({ habit }: { habit: Habit }) {
  const stats = useQuery({ queryKey: statsKey(habit.id), queryFn: () => fetchStats(habit.id) });

  return (
    <section aria-label="Completion rate" className="space-y-2">
      <h2 className="text-sm font-medium text-gray-300">Completion rate</h2>
      {stats.isError ? (
        <ErrorMessage>The completion rates could not be loaded.</ErrorMessage>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          <Rate window="Last 30 days" rate={stats.data?.last30Days} />
          <Rate window="Last 365 days" rate={stats.data?.last365Days} />
        </ul>
      )}
    </section>
  );
}

interface CompletionRate {
  completedDays: number;
  totalDays: number;
  rate: number;
}

function Rate({ window, rate }: { window: string; rate: CompletionRate | undefined }) {
  return (
    <li className="rounded-lg bg-gray-800/60 p-3">
      <span className="block text-xs text-gray-400">{window}</span>
      {rate ? (
        <>
          <span className="block text-sm">
            {rate.completedDays} of {rate.totalDays} days
          </span>
          <span className="block text-xl font-semibold">{Math.round(rate.rate * 100)}%</span>
        </>
      ) : (
        <span className="block text-sm text-gray-500">…</span>
      )}
    </li>
  );
}

interface MonthProps {
  habit: Habit;
  month: string;
  today: string;
  onPrevious: () => void;
  /** Absent in this month, as no later one is shown. */
  onNext: (() => void) | undefined;
}

/**
 * The month's calendar and its days done. A change updates this month at
 * once, and marks the rates and every other view of completions stale.
 */
function MonthView({ habit, month, today, onPrevious, onNext }: MonthProps) {
  const queryClient = useQueryClient();
  const key = monthKey(habit.id, month);
  const done = useQuery({ queryKey: key, queryFn: () => fetchMonth(habit.id, month) });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | undefined>();
  const [confirming, setConfirming] = useState<string | undefined>();
  const [noting, setNoting] = useState<string | undefined>();

  const set = (date: string, note: string | null | undefined) => {
    queryClient.setQueryData<Month>(key, (current = {}) => {
      const next = { ...current };
      if (note === undefined) delete next[date];
      else next[date] = note;
      return next;
    });
    void queryClient.invalidateQueries({ queryKey: [COMPLETIONS], refetchType: 'none' });
    void queryClient.invalidateQueries({ queryKey: statsKey(habit.id) });
  };

  async function change(date: string, send: () => Promise<string | undefined>) {
    setBusy(date);
    setError('');
    setConfirming(undefined);
    try {
      setError((await send()) ?? '');
    } catch {
      setError(messageFor(undefined, undefined));
    } finally {
      setBusy(undefined);
    }
  }

  const checkOff = (date: string) =>
    change(date, async () => {
      const { data, error, response } = await api.POST('/api/v1/habits/{habitId}/completions', {
        params: { path: { habitId: habit.id } },
        body: { date },
      });
      if (data) set(date, data.notes);
      // Checked off elsewhere, in another tab or on another device.
      else if (response.status === 409) await queryClient.invalidateQueries({ queryKey: key });
      else return messageFor(response.status, error);
    });

  const undo = (date: string) =>
    change(date, async () => {
      const { error, response } = await api.DELETE('/api/v1/habits/{habitId}/completions/{date}', {
        params: { path: { habitId: habit.id, date } },
      });
      // A 404 means the day is already undone, which is what was asked.
      if (response.ok || response.status === 404) set(date, undefined);
      else return messageFor(response.status, error);
    });

  const toggle = (date: string) => {
    if (!done.data) return;
    if (!(date in done.data)) return void checkOff(date);
    // The note lives on the day, so undoing the day deletes it: ask first.
    if (done.data[date]) setConfirming(date);
    else void undo(date);
  };

  return (
    <>
      <section aria-label="Calendar" className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Button variant="secondary" aria-label="Previous month" onClick={onPrevious}>
            ‹
          </Button>
          <h2 className="text-lg font-semibold">
            <time dateTime={month}>{formatMonth(month)}</time>
          </h2>
          <Button variant="secondary" aria-label="Next month" disabled={!onNext} onClick={onNext}>
            ›
          </Button>
        </div>
        <ErrorMessage>{error}</ErrorMessage>
        {confirming && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-gray-700 p-3">
            <span className="text-sm text-gray-300">
              Undo {formatDate(confirming)} and delete its note?
            </span>
            <Button variant="danger" onClick={() => void undo(confirming)}>
              Undo and delete note
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(undefined)}>
              Keep it
            </Button>
          </div>
        )}
        {done.isPending ? (
          <p role="status" className="text-gray-400">
            Loading the month…
          </p>
        ) : done.isError ? (
          <ErrorMessage>
            This month's days could not be loaded. Reload the page to try again.
          </ErrorMessage>
        ) : (
          <Calendar
            habit={habit}
            month={month}
            today={today}
            done={done.data}
            busy={busy}
            onToggle={toggle}
          />
        )}
      </section>
      {done.data && <DaysDone month={month} done={done.data} onNote={(date) => setNoting(date)} />}
      {noting && done.data && (
        <NoteDialog
          habitId={habit.id}
          date={noting}
          note={done.data[noting] ?? null}
          onSaved={(note) => {
            set(noting, note);
            setNoting(undefined);
          }}
          onClose={() => setNoting(undefined)}
        />
      )}
    </>
  );
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface CalendarProps {
  habit: Habit;
  month: string;
  today: string;
  done: Month;
  busy: string | undefined;
  onToggle: (date: string) => void;
}

function Calendar({ habit, month, today, done, busy, onToggle }: CalendarProps) {
  const cells: (string | null)[] = [
    ...Array<null>(leadingBlanks(month)).fill(null),
    ...monthDays(month),
  ];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, week) =>
    cells.slice(week * 7, week * 7 + 7)
  );

  return (
    <table className="w-full max-w-md table-fixed border-separate border-spacing-1">
      <thead>
        <tr>
          {WEEKDAYS.map((weekday) => (
            <th key={weekday} scope="col" className="text-xs font-normal text-gray-400">
              {weekday}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {weeks.map((week) => (
          <tr key={week.find(Boolean)}>
            {week.map((date, index) => (
              <td key={date ?? `blank-${index}`} className="p-0">
                {date && (
                  <Day
                    habit={habit}
                    date={date}
                    today={today}
                    done={date in done}
                    noted={Boolean(done[date])}
                    busy={busy === date}
                    onToggle={onToggle}
                  />
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface DayProps {
  habit: Habit;
  date: string;
  today: string;
  done: boolean;
  noted: boolean;
  busy: boolean;
  onToggle: (date: string) => void;
}

function Day({ habit, date, today, done, noted, busy, onToggle }: DayProps) {
  return (
    <button
      aria-pressed={done}
      aria-label={`${formatDate(date)}${noted ? ', with a note' : ''}`}
      disabled={date > today || busy}
      onClick={() => onToggle(date)}
      className={`relative aspect-square w-full rounded-full border text-sm disabled:opacity-40 ${
        date === today ? 'ring-2 ring-white/60' : ''
      }`}
      style={{
        borderColor: habit.color,
        backgroundColor: done ? habit.color : undefined,
        color: done ? '#111827' : undefined,
      }}
    >
      <time dateTime={date}>{Number(date.slice(8))}</time>
      {noted && (
        <span
          aria-hidden="true"
          className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-gray-100"
        />
      )}
    </button>
  );
}

interface DaysDoneProps {
  month: string;
  done: Month;
  onNote: (date: string) => void;
}

function DaysDone({ month, done, onNote }: DaysDoneProps) {
  const dates = Object.keys(done).sort().reverse();

  return (
    <section aria-label="Days done" className="space-y-2">
      <h2 className="text-sm font-medium text-gray-300">Days done in {formatMonth(month)}</h2>
      {dates.length === 0 ? (
        <p className="text-sm text-gray-400">
          No days done this month yet. Tap a day to check it off.
        </p>
      ) : (
        <ul className="space-y-2">
          {dates.map((date) => (
            <li
              key={date}
              className="flex items-start justify-between gap-3 rounded-lg bg-gray-800/60 p-3"
            >
              <div className="min-w-0 space-y-1">
                <h3 className="text-sm font-medium">
                  <time dateTime={date}>{formatDate(date)}</time>
                </h3>
                {done[date] && (
                  <p className="text-sm break-words whitespace-pre-wrap text-gray-300">
                    {done[date]}
                  </p>
                )}
              </div>
              <Button
                variant="secondary"
                aria-label={`${done[date] ? 'Edit' : 'Add'} note for ${formatDate(date)}`}
                onClick={() => onNote(date)}
              >
                {done[date] ? 'Edit note' : 'Add note'}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface NoteDialogProps {
  habitId: string;
  date: string;
  note: string | null;
  onSaved: (note: string | null) => void;
  onClose: () => void;
}

/** Write, change or delete a done day's note. */
function NoteDialog({ habitId, date, note, onSaved, onClose }: NoteDialogProps) {
  const titleId = useId();
  const fieldId = useId();
  const [text, setText] = useState(note ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function save(notes: string | null) {
    setBusy(true);
    setError('');
    try {
      const { data, error, response } = await api.PUT(
        '/api/v1/habits/{habitId}/completions/{date}',
        { params: { path: { habitId, date } }, body: { notes } }
      );
      if (data) onSaved(data.notes);
      else setError(messageFor(response.status, error));
    } catch {
      setError(messageFor(undefined, undefined));
    } finally {
      setBusy(false);
    }
  }

  const trimmed = text.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md space-y-4 rounded-lg bg-gray-800 p-6"
      >
        <h2 id={titleId} className="text-lg font-semibold">
          Note for {formatDate(date)}
        </h2>
        <ErrorMessage>{error}</ErrorMessage>
        <div className="space-y-1">
          <label htmlFor={fieldId} className="text-sm font-medium text-gray-300">
            Note
          </label>
          <textarea
            id={fieldId}
            autoFocus
            value={text}
            maxLength={NOTE_LENGTH}
            rows={4}
            onChange={(event) => setText(event.target.value)}
            className="w-full resize-none rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-gray-100 focus:border-blue-400 focus:outline-none"
          />
          <p aria-hidden="true" className="text-right text-xs text-gray-400">
            {text.length}/{NOTE_LENGTH}
          </p>
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          {note ? (
            <Button variant="danger" disabled={busy} onClick={() => void save(null)}>
              Delete note
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={busy || (!note && !trimmed)}
              onClick={() => void save(trimmed || null)}
            >
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
