import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { api } from '../api/client.ts';
import { messageFor } from '../api/messages.ts';
import { Button, ErrorMessage, Field } from '../components/forms.tsx';
import { useSession } from '../session/session.ts';
import { requestLimits } from '../types/api.ts';

const REGISTER = requestLimits.register;

function AuthPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-900 p-4 text-gray-100">
      <div className="w-full max-w-sm space-y-6 rounded-lg bg-gray-800/60 p-8">
        <div className="space-y-1 text-center">
          <p className="text-sm font-semibold tracking-wide text-blue-400">HabitCraft</p>
          <h1 className="text-2xl font-bold">{title}</h1>
        </div>
        {children}
      </div>
    </main>
  );
}

/** Values of a submitted form's named fields. */
function valuesOf(event: FormEvent<HTMLFormElement>): Record<string, string> {
  event.preventDefault();
  return Object.fromEntries(
    [...new FormData(event.currentTarget)].map(([key, value]) => [key, String(value)])
  );
}

export function SignInPage() {
  const { signedIn } = useSession();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    const { email, password } = valuesOf(event);
    setBusy(true);
    setError('');
    try {
      const { data, error, response } = await api.POST('/api/v1/auth/login', {
        body: { email, password },
      });
      if (data) return signedIn(data.user);
      setError(
        response.status === 401 ? 'Wrong email or password.' : messageFor(response.status, error)
      );
    } catch {
      setError(messageFor(undefined, undefined));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthPage title="Sign in">
      <form onSubmit={submit} className="space-y-4">
        <ErrorMessage>{error}</ErrorMessage>
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <Button type="submit" disabled={busy} className="w-full">
          Sign in
        </Button>
      </form>
      <p className="text-center text-sm text-gray-400">
        New here?{' '}
        <Link to="/register" className="text-blue-400 hover:underline">
          Create an account
        </Link>
      </p>
    </AuthPage>
  );
}

export function RegisterPage() {
  const { signedIn } = useSession();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    const { name, email, password } = valuesOf(event);
    setBusy(true);
    setError('');
    try {
      const { data, error, response } = await api.POST('/api/v1/auth/register', {
        body: { name, email, password },
      });
      if (data) return signedIn(data.user);
      setError(
        response.status === 409
          ? 'An account with this email already exists.'
          : messageFor(response.status, error)
      );
    } catch {
      setError(messageFor(undefined, undefined));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthPage title="Create your account">
      <form onSubmit={submit} className="space-y-4">
        <ErrorMessage>{error}</ErrorMessage>
        <Field
          label="Name"
          name="name"
          autoComplete="name"
          required
          minLength={REGISTER.name.minLength}
          maxLength={REGISTER.name.maxLength}
        />
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={REGISTER.email.maxLength}
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={REGISTER.password.minLength}
          maxLength={REGISTER.password.maxLength}
        />
        <Button type="submit" disabled={busy} className="w-full">
          Create account
        </Button>
      </form>
      <p className="text-center text-sm text-gray-400">
        Already have an account?{' '}
        <Link to="/login" className="text-blue-400 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthPage>
  );
}
