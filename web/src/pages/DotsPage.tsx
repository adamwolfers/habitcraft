import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { completionsKey, fetchCompletions } from '../api/completions.ts';
import { useHabits } from '../api/habits.ts';
import { formatDate } from '../calendar/calendar.ts';
import { ErrorMessage } from '../components/forms.tsx';
import { DAYS_PER_ROW, firstDay, gridDays } from '../dots/dots.ts';
import { useToday } from '../today/today.ts';
import type { Habit } from '../types/api.ts';

/** Each habit's checked-off days in the range, keyed by habit id. */
type Done = Record<string, Set<string>>;

async function fetchDone(startDate: string, endDate: string): Promise<Done> {
  const done: Done = {};
  for (const { habitId, completions } of await fetchCompletions(startDate, endDate)) {
    done[habitId] = new Set(completions.map((completion) => completion.date));
  }
  return done;
}

export function DotsPage() {
  const today = useToday();
  const start = firstDay(today);
  const habits = useHabits();
  const done = useQuery({
    queryKey: completionsKey(start, today),
    queryFn: () => fetchDone(start, today),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dots</h1>
      {habits.isPending || done.isPending ? (
        <p role="status" className="text-gray-400">
          Loading your days…
        </p>
      ) : habits.isError || done.isError ? (
        <ErrorMessage>Your days could not be loaded. Reload the page to try again.</ErrorMessage>
      ) : (
        <Cards
          today={today}
          habits={habits.data.filter((habit) => habit.status === 'active')}
          done={done.data}
        />
      )}
    </div>
  );
}

function Cards({ today, habits, done }: { today: string; habits: Habit[]; done: Done }) {
  if (habits.length === 0) {
    return (
      <p className="text-gray-400">
        No habits yet.{' '}
        <Link to="/habits" className="text-blue-400 underline hover:text-blue-300">
          Create a habit
        </Link>{' '}
        to see its days fill in here.
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {habits.map((habit) => (
        <Card key={habit.id} habit={habit} today={today} done={done[habit.id] ?? new Set()} />
      ))}
    </ul>
  );
}

function Card({ habit, today, done }: { habit: Habit; today: string; done: Set<string> }) {
  const days = gridDays(today);
  const completed = days.filter((date) => done.has(date)).length;

  return (
    // The whole card opens the habit's page: its name's link covers the card.
    <li className="relative space-y-3 rounded-lg bg-gray-800/60 p-4 hover:bg-gray-800">
      <h3 className="font-medium break-all">
        <Link
          to={`/habits/${habit.id}`}
          className="after:absolute after:inset-0 after:rounded-lg focus:outline-none focus-visible:after:ring-2 focus-visible:after:ring-blue-400"
        >
          {habit.name}
        </Link>
      </h3>
      {/* One summary for a screen reader, rather than a dot at a time. */}
      <div
        role="img"
        aria-label={`Completed ${completed} of ${days.length} days`}
        className="grid max-w-md gap-0.5 sm:gap-1"
        style={{ gridTemplateColumns: `repeat(${DAYS_PER_ROW}, minmax(0, 1fr))` }}
      >
        {days.map((date) => (
          <time
            key={date}
            dateTime={date}
            title={`${formatDate(date)}: ${done.has(date) ? 'done' : 'not done'}`}
            className="aspect-square rounded-full border"
            style={{
              borderColor: habit.color,
              backgroundColor: done.has(date) ? habit.color : undefined,
            }}
          />
        ))}
      </div>
    </li>
  );
}
