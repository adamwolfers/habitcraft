import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { alice, fakeServer } from '../test/fakeServer.ts';
import { renderApp } from '../test/renderApp.tsx';

afterEach(() => {
  vi.unstubAllGlobals();
});

const signedOut = {
  'GET /api/v1/users/me': [401, { error: 'No token provided' }],
  'POST /api/v1/auth/refresh': [401, { error: 'Refresh token required' }],
} as const;

const tokens = { accessToken: 'a', refreshToken: 'r' };

describe('SignInPage', () => {
  async function signIn(answer: Parameters<typeof fakeServer>[0][string]) {
    const server = fakeServer({
      ...signedOut,
      'POST /api/v1/auth/login': answer,
      'GET /api/v1/habits': [200, []],
      'GET /api/v1/completions': [200, []],
    });
    const { user } = renderApp('/login');
    await user.type(await screen.findByLabelText('Email'), 'alice@example.com');
    await user.type(screen.getByLabelText('Password'), 'Pass-1234');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    return server;
  }

  it('signs in and opens Today', async () => {
    const server = await signIn([200, { user: alice, ...tokens }]);

    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(await server.bodiesSentTo('POST /api/v1/auth/login')).toEqual([
      { email: 'alice@example.com', password: 'Pass-1234' },
    ]);
  });

  it('says the email or password is wrong', async () => {
    await signIn([401, { error: 'Invalid credentials' }]);

    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong email or password.');
  });

  it('asks the user to wait after too many attempts', async () => {
    await signIn([429, { error: 'Too many', message: 'Too many', statusCode: 429 }]);

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts');
  });

  it('says something went wrong when the server cannot be reached', async () => {
    await signIn(() => {
      throw new TypeError('Failed to fetch');
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
  });

  it('links to registration', async () => {
    fakeServer({ ...signedOut });
    const { user } = renderApp('/login');

    await user.click(await screen.findByRole('link', { name: 'Create an account' }));

    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument();
  });
});

describe('RegisterPage', () => {
  async function register(answer: Parameters<typeof fakeServer>[0][string]) {
    const server = fakeServer({
      ...signedOut,
      'POST /api/v1/auth/register': answer,
      'GET /api/v1/habits': [200, []],
      'GET /api/v1/completions': [200, []],
    });
    const { user } = renderApp('/register');
    await user.type(await screen.findByLabelText('Name'), 'Alice');
    await user.type(screen.getByLabelText('Email'), 'alice@example.com');
    await user.type(screen.getByLabelText('Password'), 'Pass-1234');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    return server;
  }

  it('creates the account and opens Today', async () => {
    const server = await register([201, { user: alice, ...tokens }]);

    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(await server.bodiesSentTo('POST /api/v1/auth/register')).toEqual([
      { name: 'Alice', email: 'alice@example.com', password: 'Pass-1234' },
    ]);
  });

  it('says when the email already has an account', async () => {
    await register([409, { error: 'User with this email already exists' }]);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'An account with this email already exists.'
    );
  });

  it("shows the server's reasons for refusing the details", async () => {
    await register([400, { errors: [{ msg: 'Invalid email format' }] }]);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Some details are not valid: Invalid email format.'
    );
  });

  it('says something went wrong when the server cannot be reached', async () => {
    await register(() => {
      throw new TypeError('Failed to fetch');
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
  });

  it('takes its limits from the spec', async () => {
    fakeServer({ ...signedOut });
    renderApp('/register');

    // The numbers come from apiLimits.generated.ts; these only check they arrive.
    expect(await screen.findByLabelText('Password')).toHaveAttribute('minLength');
    expect(screen.getByLabelText('Email')).toHaveAttribute('maxLength');
    expect(screen.getByLabelText('Name')).toHaveAttribute('maxLength');
  });

  it('links back to sign in', async () => {
    fakeServer({ ...signedOut });
    const { user } = renderApp('/register');

    await user.click(await screen.findByRole('link', { name: 'Sign in' }));

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });
});
