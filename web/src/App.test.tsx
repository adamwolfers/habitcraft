import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { alice, fakeServer } from './test/fakeServer.ts';
import { renderApp } from './test/renderApp.tsx';

afterEach(() => {
  vi.unstubAllGlobals();
});

const signedOut = {
  'GET /api/v1/users/me': [401, { error: 'No token provided' }],
  'POST /api/v1/auth/refresh': [401, { error: 'Refresh token required' }],
} as const;

describe('App', () => {
  it('sends a signed-out visitor to sign in', async () => {
    fakeServer({ ...signedOut });

    renderApp('/habits');

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('takes a signed-in user from sign-in to their habits', async () => {
    fakeServer({ 'GET /api/v1/users/me': [200, alice], 'GET /api/v1/habits': [200, []] });

    renderApp('/login');

    expect(await screen.findByRole('heading', { name: 'Habits' })).toBeInTheDocument();
  });

  it('opens on the habits for any path it does not know', async () => {
    fakeServer({ 'GET /api/v1/users/me': [200, alice], 'GET /api/v1/habits': [200, []] });

    renderApp('/no-such-page');

    expect(await screen.findByRole('heading', { name: 'Habits' })).toBeInTheDocument();
  });

  it('says so when the server cannot be reached', async () => {
    fakeServer({ 'GET /api/v1/users/me': [500, { error: 'Internal server error' }] });

    renderApp('/habits');

    expect(await screen.findByRole('alert')).toHaveTextContent('could not reach its server');
  });

  it('signs out and returns to sign in', async () => {
    const server = fakeServer({
      'GET /api/v1/users/me': [200, alice],
      'GET /api/v1/habits': [200, []],
      'POST /api/v1/auth/logout': [200, { message: 'Logged out successfully' }],
    });
    const { user } = renderApp('/habits');

    await user.click(await screen.findByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(
      server.requests.map((request) => request.method + ' ' + new URL(request.url).pathname)
    ).toContain('POST /api/v1/auth/logout');
  });

  it('ends the session wherever the user is when it cannot be renewed', async () => {
    let expired = false;
    fakeServer({
      'GET /api/v1/users/me': [200, alice],
      'GET /api/v1/habits': () => (expired ? [401, { error: 'Token expired' }] : [200, []]),
      'POST /api/v1/auth/refresh': [401, { error: 'Invalid refresh token' }],
    });
    const { queryClient } = renderApp('/habits');
    await screen.findByRole('heading', { name: 'Habits' });

    expired = true;
    await queryClient.refetchQueries({ queryKey: ['habits'] });

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });
});
