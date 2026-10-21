import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { api } from '../api/client.ts';
import { messageFor } from '../api/messages.ts';
import { Button, ErrorMessage, Field } from '../components/forms.tsx';
import { schemaLimits, type Habit } from '../types/api.ts';

const NAME = schemaLimits.HabitInput.name;

const HABITS = ['habits'] as const;

async function fetchHabits(): Promise<Habit[]> {
  const { data, response } = await api.GET('/api/v1/habits');
  if (!data) throw new Error(`Loading habits failed with ${response.status}`);
  return data;
}

/** Replace a habit in the cached list with the server's copy, or drop it. */
function useHabitsCache() {
  const queryClient = useQueryClient();
  return {
    put: (habit: Habit) =>
      queryClient.setQueryData<Habit[]>(HABITS, (habits = []) =>
        habits.some((h) => h.id === habit.id)
          ? habits.map((h) => (h.id === habit.id ? habit : h))
          : [...habits, habit]
      ),
    drop: (id: string) =>
      queryClient.setQueryData<Habit[]>(HABITS, (habits = []) => habits.filter((h) => h.id !== id)),
  };
}

export function HabitsPage() {
  const habits = useQuery({ queryKey: HABITS, queryFn: fetchHabits });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Habits</h1>
      <AddHabit />
      {habits.isPending ? (
        <p role="status" className="text-gray-400">
          Loading habits…
        </p>
      ) : habits.isError ? (
        <ErrorMessage>Your habits could not be loaded. Reload the page to try again.</ErrorMessage>
      ) : (
        <HabitLists habits={habits.data} />
      )}
    </div>
  );
}

function HabitLists({ habits }: { habits: Habit[] }) {
  const active = habits.filter((habit) => habit.status === 'active');
  const archived = habits.filter((habit) => habit.status === 'archived');

  return (
    <>
      <section aria-label="Active habits" className="space-y-2">
        {active.length === 0 ? (
          <p className="text-gray-400">No habits yet. Add one above to get started.</p>
        ) : (
          <ul className="space-y-2">
            {active.map((habit) => (
              <HabitRow key={habit.id} habit={habit} />
            ))}
          </ul>
        )}
      </section>
      {archived.length > 0 && (
        <section aria-label="Archived habits" className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-300">Archived</h2>
          <ul className="space-y-2">
            {archived.map((habit) => (
              <HabitRow key={habit.id} habit={habit} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function AddHabit() {
  const cache = useHabitsCache();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data, error, response } = await api.POST('/api/v1/habits', { body: { name } });
      if (data) {
        cache.put(data);
        setName('');
      } else {
        setError(messageFor(response.status, error));
      }
    } catch {
      setError(messageFor(undefined, undefined));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} aria-label="Add a habit" className="space-y-2">
      <ErrorMessage>{error}</ErrorMessage>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Field
            label="New habit"
            name="name"
            required
            minLength={NAME.minLength}
            maxLength={NAME.maxLength}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <Button type="submit" disabled={busy}>
          Add habit
        </Button>
      </div>
    </form>
  );
}

type Mode = 'view' | 'renaming' | 'deleting';

function HabitRow({ habit }: { habit: Habit }) {
  const cache = useHabitsCache();
  const [mode, setMode] = useState<Mode>('view');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  /** Send one change; on success show the server's copy and go back to viewing. */
  async function change(send: () => Promise<{ ok: boolean; message?: string }>) {
    setBusy(true);
    setError('');
    try {
      const result = await send();
      if (result.ok) setMode('view');
      else setError(result.message ?? '');
    } catch {
      setError(messageFor(undefined, undefined));
    } finally {
      setBusy(false);
    }
  }

  const update = (body: { name: string; status?: Habit['status'] }) =>
    change(async () => {
      const { data, error, response } = await api.PUT('/api/v1/habits/{habitId}', {
        params: { path: { habitId: habit.id } },
        body,
      });
      if (!data) return { ok: false, message: messageFor(response.status, error) };
      cache.put(data);
      return { ok: true };
    });

  const remove = () =>
    change(async () => {
      const { error, response } = await api.DELETE('/api/v1/habits/{habitId}', {
        params: { path: { habitId: habit.id } },
      });
      if (response.status !== 204)
        return { ok: false, message: messageFor(response.status, error) };
      cache.drop(habit.id);
      return { ok: true };
    });

  return (
    <li className="space-y-2 rounded-lg bg-gray-800/60 p-4">
      <ErrorMessage>{error}</ErrorMessage>
      {mode === 'renaming' ? (
        <RenameForm
          habit={habit}
          busy={busy}
          onSave={(name) => update({ name })}
          onCancel={() => {
            setError('');
            setMode('view');
          }}
        />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-medium break-all">{habit.name}</h3>
          {mode === 'deleting' ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-300">Delete it and all its days?</span>
              <Button variant="danger" disabled={busy} onClick={remove}>
                Delete
              </Button>
              <Button variant="secondary" onClick={() => setMode('view')}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              {habit.status === 'active' ? (
                <>
                  <Button
                    variant="secondary"
                    aria-label={`Rename ${habit.name}`}
                    onClick={() => setMode('renaming')}
                  >
                    Rename
                  </Button>
                  <Button
                    variant="secondary"
                    aria-label={`Archive ${habit.name}`}
                    disabled={busy}
                    onClick={() => update({ name: habit.name, status: 'archived' })}
                  >
                    Archive
                  </Button>
                </>
              ) : (
                <Button
                  variant="secondary"
                  aria-label={`Restore ${habit.name}`}
                  disabled={busy}
                  onClick={() => update({ name: habit.name, status: 'active' })}
                >
                  Restore
                </Button>
              )}
              <Button
                variant="secondary"
                aria-label={`Delete ${habit.name}`}
                onClick={() => setMode('deleting')}
              >
                Delete
              </Button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function RenameForm({
  habit,
  busy,
  onSave,
  onCancel,
}: {
  habit: Habit;
  busy: boolean;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(habit.name);

  return (
    <form
      aria-label={`Rename ${habit.name}`}
      onSubmit={(event) => {
        event.preventDefault();
        onSave(name);
      }}
      className="flex items-end gap-2"
    >
      <div className="flex-1">
        <Field
          label="Name"
          name="name"
          required
          minLength={NAME.minLength}
          maxLength={NAME.maxLength}
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
        />
      </div>
      <Button type="submit" disabled={busy}>
        Save
      </Button>
      <Button type="button" variant="secondary" onClick={onCancel}>
        Cancel
      </Button>
    </form>
  );
}
