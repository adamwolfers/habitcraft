import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { alice, fakeServer, type Answer } from '../test/fakeServer.ts';
import { renderApp } from '../test/renderApp.tsx';

afterEach(() => {
  vi.unstubAllGlobals();
});

const tokens = { accessToken: 'a', refreshToken: 'r' };

type Route = Answer | ((request: Request) => Answer);

async function openProfile(routes: Record<string, Route> = {}) {
  const server = fakeServer({
    'GET /api/v1/users/me': [200, alice],
    'POST /api/v1/auth/refresh': [200, tokens],
    ...routes,
  });
  const view = renderApp('/profile');
  await screen.findByRole('heading', { name: 'Profile' });
  return { server, ...view };
}

const section = (name: string) => screen.getByRole('region', { name });

describe('ProfilePage: your details', () => {
  it("shows the user's name and email", async () => {
    await openProfile();

    const details = section('Your details');
    expect(within(details).getByLabelText('Name')).toHaveValue('Alice');
    expect(within(details).getByLabelText('Email')).toHaveValue('alice@example.com');
  });

  it('saves them, and shows what the server kept', async () => {
    const { server, user } = await openProfile({
      'PUT /api/v1/users/me': [200, { ...alice, name: 'Alice Jones', email: 'new@example.com' }],
    });
    const details = section('Your details');

    await user.clear(within(details).getByLabelText('Name'));
    await user.type(within(details).getByLabelText('Name'), 'Alice Jones');
    await user.clear(within(details).getByLabelText('Email'));
    await user.type(within(details).getByLabelText('Email'), 'NEW@example.com');
    await user.click(within(details).getByRole('button', { name: 'Save profile' }));

    expect(await within(details).findByRole('status')).toHaveTextContent('Profile saved.');
    expect(within(details).getByLabelText('Email')).toHaveValue('new@example.com');
    expect(await server.bodiesSentTo('PUT /api/v1/users/me')).toEqual([
      { name: 'Alice Jones', email: 'NEW@example.com' },
    ]);
  });

  it("says when the email is another account's", async () => {
    const { user } = await openProfile({
      'PUT /api/v1/users/me': [409, { error: 'Email already in use' }],
    });
    const details = section('Your details');

    await user.click(within(details).getByRole('button', { name: 'Save profile' }));

    expect(await within(details).findByRole('alert')).toHaveTextContent(
      'That email is already in use by another account.'
    );
  });

  it("shows the server's reasons for refusing them", async () => {
    const { user } = await openProfile({
      'PUT /api/v1/users/me': [400, { errors: [{ msg: 'Name cannot be empty' }] }],
    });
    const details = section('Your details');

    await user.click(within(details).getByRole('button', { name: 'Save profile' }));

    expect(await within(details).findByRole('alert')).toHaveTextContent('Name cannot be empty');
  });

  it('says something went wrong when the server cannot be reached', async () => {
    const { user } = await openProfile({
      'PUT /api/v1/users/me': () => {
        throw new TypeError('Failed to fetch');
      },
    });
    const details = section('Your details');

    await user.click(within(details).getByRole('button', { name: 'Save profile' }));

    expect(await within(details).findByRole('alert')).toHaveTextContent('Something went wrong');
  });
});

describe('ProfilePage: change password', () => {
  async function change(
    routes: Record<string, Route>,
    {
      current = 'Old-pass-1',
      next = 'New-pass-1',
      confirm = next,
    }: { current?: string; next?: string; confirm?: string } = {}
  ) {
    const view = await openProfile(routes);
    const form = section('Change password');
    await view.user.type(within(form).getByLabelText('Current password'), current);
    await view.user.type(within(form).getByLabelText('New password'), next);
    await view.user.type(within(form).getByLabelText('Confirm new password'), confirm);
    await view.user.click(within(form).getByRole('button', { name: 'Change password' }));
    return { form, ...view };
  }

  it('changes it, and clears the form', async () => {
    const { form, server } = await change({
      'PUT /api/v1/users/me/password': [
        200,
        { message: 'Password changed successfully', ...tokens },
      ],
    });

    expect(await within(form).findByRole('status')).toHaveTextContent('Password changed.');
    expect(within(form).getByLabelText('Current password')).toHaveValue('');
    expect(await server.bodiesSentTo('PUT /api/v1/users/me/password')).toEqual([
      { currentPassword: 'Old-pass-1', newPassword: 'New-pass-1', confirmPassword: 'New-pass-1' },
    ]);
  });

  it('refuses new passwords that differ, without asking the server', async () => {
    const { form, server } = await change({}, { confirm: 'Other-pass-1' });

    expect(await within(form).findByRole('alert')).toHaveTextContent(
      'The new passwords do not match.'
    );
    expect(await server.bodiesSentTo('PUT /api/v1/users/me/password')).toEqual([]);
  });

  it('says the current password is wrong', async () => {
    // The 401 comes twice: once before the session is renewed, once after.
    const { form } = await change({
      'PUT /api/v1/users/me/password': [401, { error: 'Invalid current password' }],
    });

    expect(await within(form).findByRole('alert')).toHaveTextContent(
      'Your current password is wrong.'
    );
  });

  it("shows the server's reasons for refusing the new one", async () => {
    const { form } = await change({
      'PUT /api/v1/users/me/password': [400, { errors: [{ msg: 'Password is too common' }] }],
    });

    expect(await within(form).findByRole('alert')).toHaveTextContent('Password is too common');
  });
});

describe('ProfilePage: delete account', () => {
  it('asks for the password before deleting, and can be called off', async () => {
    const { user } = await openProfile();
    const danger = section('Delete account');

    await user.click(within(danger).getByRole('button', { name: 'Delete account…' }));
    expect(within(danger).getByLabelText('Your password')).toBeInTheDocument();

    await user.click(within(danger).getByRole('button', { name: 'Keep my account' }));
    expect(within(danger).queryByLabelText('Your password')).not.toBeInTheDocument();
  });

  async function confirmDelete(answer: Route) {
    const view = await openProfile({ 'DELETE /api/v1/users/me': answer });
    const danger = section('Delete account');
    await view.user.click(within(danger).getByRole('button', { name: 'Delete account…' }));
    await view.user.type(within(danger).getByLabelText('Your password'), 'Pass-1234');
    await view.user.click(within(danger).getByRole('button', { name: 'Delete my account' }));
    return { danger, ...view };
  }

  it('deletes the account and signs out', async () => {
    const { server } = await confirmDelete([204]);

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(await server.bodiesSentTo('DELETE /api/v1/users/me')).toEqual([
      { password: 'Pass-1234' },
    ]);
  });

  it('says the password is wrong', async () => {
    const { danger } = await confirmDelete([401, { error: 'Invalid password' }]);

    expect(await within(danger).findByRole('alert')).toHaveTextContent('That password is wrong.');
  });

  it('says something went wrong when the server cannot be reached', async () => {
    const { danger } = await confirmDelete(() => {
      throw new TypeError('Failed to fetch');
    });

    expect(await within(danger).findByRole('alert')).toHaveTextContent('Something went wrong');
  });
});
