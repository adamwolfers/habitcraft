import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { alice, fakeServer, habit, type Answer } from '../test/fakeServer.ts';
import { renderApp } from '../test/renderApp.tsx';

afterEach(() => {
  vi.unstubAllGlobals();
});

type Route = Answer | ((request: Request) => Answer | Promise<Answer>);

const run = habit('Morning run');
const read = habit('Read', { status: 'archived' });

/** The habits list as GET /api/v1/habits sends it, with days embedded. */
const listed = (...habits: ReturnType<typeof habit>[]) =>
  habits.map((h) => ({ ...h, completions: [] }));

async function openHabits(habits: ReturnType<typeof habit>[], routes: Record<string, Route> = {}) {
  const server = fakeServer({
    'GET /api/v1/users/me': [200, alice],
    'GET /api/v1/habits': [200, listed(...habits)],
    ...routes,
  });
  const view = renderApp('/habits');
  await screen.findByRole('region', { name: 'Active habits' });
  return { server, ...view };
}

const names = (list: string) =>
  within(screen.queryByRole('region', { name: list }) ?? document.createElement('div'))
    .queryAllByRole('heading', { level: 3 })
    .map((heading) => heading.textContent);

const row = (name: string) =>
  screen.getByRole('heading', { level: 3, name }).closest('li') as HTMLElement;

describe('HabitsPage', () => {
  it('lists active habits, and archived ones apart', async () => {
    await openHabits([run, read]);

    expect(names('Active habits')).toEqual(['Morning run']);
    expect(names('Archived habits')).toEqual(['Read']);
  });

  it('invites the user to add a first habit', async () => {
    await openHabits([]);

    expect(screen.getByText(/No habits yet/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Archived habits' })).not.toBeInTheDocument();
  });

  it('says so when the habits cannot be loaded', async () => {
    fakeServer({
      'GET /api/v1/users/me': [200, alice],
      'GET /api/v1/habits': [
        500,
        { error: 'Internal server error', message: 'x', statusCode: 500 },
      ],
    });
    renderApp('/habits');

    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded');
  });

  describe('adding', () => {
    it('adds a habit and clears the field', async () => {
      const { server, user } = await openHabits([], {
        'POST /api/v1/habits': [201, run],
      });

      await user.type(screen.getByLabelText('New habit'), 'Morning run');
      await user.click(screen.getByRole('button', { name: 'Add habit' }));

      expect(await screen.findByRole('heading', { level: 3, name: 'Morning run' })).toBeVisible();
      expect(screen.getByLabelText('New habit')).toHaveValue('');
      expect(await server.bodiesSentTo('POST /api/v1/habits')).toEqual([{ name: 'Morning run' }]);
    });

    it("shows the server's reason for refusing one", async () => {
      const { user } = await openHabits([], {
        'POST /api/v1/habits': [
          403,
          { error: 'Habit limit reached', message: 'You have reached the maximum of 50 habits.' },
        ],
      });

      await user.type(screen.getByLabelText('New habit'), 'One too many');
      await user.click(screen.getByRole('button', { name: 'Add habit' }));

      const form = screen.getByRole('form', { name: 'Add a habit' });
      expect(await within(form).findByRole('alert')).toHaveTextContent('maximum of 50 habits');
    });

    it('says something went wrong when the server cannot be reached', async () => {
      const { user } = await openHabits([], {
        'POST /api/v1/habits': () => {
          throw new TypeError('Failed to fetch');
        },
      });

      await user.type(screen.getByLabelText('New habit'), 'Read');
      await user.click(screen.getByRole('button', { name: 'Add habit' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
    });
  });

  describe('renaming', () => {
    it('renames a habit', async () => {
      const { server, user } = await openHabits([run], {
        [`PUT /api/v1/habits/${run.id}`]: [200, { ...run, name: 'Evening run' }],
      });

      await user.click(screen.getByRole('button', { name: 'Rename Morning run' }));
      const form = screen.getByRole('form', { name: 'Rename Morning run' });
      await user.clear(within(form).getByLabelText('Name'));
      await user.type(within(form).getByLabelText('Name'), 'Evening run');
      await user.click(within(form).getByRole('button', { name: 'Save' }));

      expect(await screen.findByRole('heading', { level: 3, name: 'Evening run' })).toBeVisible();
      expect(await server.bodiesSentTo(`PUT /api/v1/habits/${run.id}`)).toEqual([
        { name: 'Evening run' },
      ]);
    });

    it('keeps the form open with the reason when the server refuses', async () => {
      const { user } = await openHabits([run], {
        [`PUT /api/v1/habits/${run.id}`]: [
          400,
          { error: 'Validation error', message: 'name must not be blank', statusCode: 400 },
        ],
      });

      await user.click(screen.getByRole('button', { name: 'Rename Morning run' }));
      const form = screen.getByRole('form', { name: 'Rename Morning run' });
      await user.click(within(form).getByRole('button', { name: 'Save' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('name must not be blank');
      expect(screen.getByRole('form', { name: 'Rename Morning run' })).toBeInTheDocument();
    });

    it('can be called off', async () => {
      const { user } = await openHabits([run]);

      await user.click(screen.getByRole('button', { name: 'Rename Morning run' }));
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.getByRole('heading', { level: 3, name: 'Morning run' })).toBeVisible();
    });
  });

  describe('archiving', () => {
    it('archives an active habit and restores it', async () => {
      const { server, user } = await openHabits([run], {
        [`PUT /api/v1/habits/${run.id}`]: async (request) => {
          const { status } = (await request.json()) as { status: string };
          return [200, { ...run, status }];
        },
      });

      await user.click(screen.getByRole('button', { name: 'Archive Morning run' }));
      expect(await screen.findByRole('region', { name: 'Archived habits' })).toBeVisible();
      expect(names('Active habits')).toEqual([]);

      await user.click(screen.getByRole('button', { name: 'Restore Morning run' }));
      await vi.waitFor(() => expect(names('Active habits')).toEqual(['Morning run']));

      expect(await server.bodiesSentTo(`PUT /api/v1/habits/${run.id}`)).toEqual([
        { name: 'Morning run', status: 'archived' },
        { name: 'Morning run', status: 'active' },
      ]);
    });
  });

  describe('deleting', () => {
    it('asks first, then deletes', async () => {
      const { user } = await openHabits([run], {
        [`DELETE /api/v1/habits/${run.id}`]: [204],
      });

      await user.click(screen.getByRole('button', { name: 'Delete Morning run' }));
      expect(within(row('Morning run')).getByText('Delete it and all its days?')).toBeVisible();
      await user.click(within(row('Morning run')).getByRole('button', { name: 'Delete' }));

      await vi.waitFor(() => expect(names('Active habits')).toEqual([]));
    });

    it('can be called off', async () => {
      const { user } = await openHabits([run]);

      await user.click(screen.getByRole('button', { name: 'Delete Morning run' }));
      await user.click(within(row('Morning run')).getByRole('button', { name: 'Cancel' }));

      expect(within(row('Morning run')).queryByText('Delete it and all its days?')).toBeNull();
    });

    it('keeps the habit when the server refuses', async () => {
      const { user } = await openHabits([run], {
        [`DELETE /api/v1/habits/${run.id}`]: [
          404,
          {
            error: 'Habit not found',
            message: 'Habit not found or access denied',
            statusCode: 404,
          },
        ],
      });

      await user.click(screen.getByRole('button', { name: 'Delete Morning run' }));
      await user.click(within(row('Morning run')).getByRole('button', { name: 'Delete' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Habit not found or access denied'
      );
      expect(names('Active habits')).toEqual(['Morning run']);
    });

    it('says something went wrong when the server cannot be reached', async () => {
      const { user } = await openHabits([run], {
        [`DELETE /api/v1/habits/${run.id}`]: () => {
          throw new TypeError('Failed to fetch');
        },
      });

      await user.click(screen.getByRole('button', { name: 'Delete Morning run' }));
      await user.click(within(row('Morning run')).getByRole('button', { name: 'Delete' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
    });
  });
});
