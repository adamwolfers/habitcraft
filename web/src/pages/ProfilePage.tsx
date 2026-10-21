import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactNode } from 'react';
import { api } from '../api/client.ts';
import { messageFor } from '../api/messages.ts';
import { Button, ErrorMessage, Field, SuccessMessage } from '../components/forms.tsx';
import { CURRENT_USER, useSession } from '../session/session.ts';
import { requestLimits, type User } from '../types/api.ts';

const PROFILE = requestLimits.updateCurrentUser;
const NEW_PASSWORD = requestLimits.changePassword.newPassword;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-4 rounded-lg bg-gray-800/60 p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** What the form attempt came to: nothing yet, a success, or why it failed. */
type Result = { ok: true } | { ok: false; message: string } | undefined;

function ResultMessage({ result, success }: { result: Result; success: string }) {
  if (!result) return null;
  return result.ok ? (
    <SuccessMessage>{success}</SuccessMessage>
  ) : (
    <ErrorMessage>{result.message}</ErrorMessage>
  );
}

/** Run a form's request, and turn whatever happens into a Result. */
async function attempt(request: () => Promise<Result>): Promise<Result> {
  try {
    return await request();
  } catch {
    return { ok: false, message: messageFor(undefined, undefined) };
  }
}

export function ProfilePage({ user }: { user: User }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Profile</h1>
      <DetailsForm user={user} />
      <PasswordForm />
      <DeleteAccount />
    </div>
  );
}

function DetailsForm({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [result, setResult] = useState<Result>();
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setResult(undefined);
    setResult(
      await attempt(async () => {
        const { data, error, response } = await api.PUT('/api/v1/users/me', {
          body: { name, email },
        });
        if (data) {
          queryClient.setQueryData(CURRENT_USER, data);
          // The server keeps an email in lower case; show what it kept.
          setName(data.name);
          setEmail(data.email);
          return { ok: true };
        }
        return {
          ok: false,
          message:
            response.status === 409
              ? 'That email is already in use by another account.'
              : messageFor(response.status, error),
        };
      })
    );
    setBusy(false);
  }

  return (
    <Section title="Your details">
      <form onSubmit={submit} className="space-y-4">
        <ResultMessage result={result} success="Profile saved." />
        <Field
          label="Name"
          name="name"
          autoComplete="name"
          required
          minLength={PROFILE.name.minLength}
          maxLength={PROFILE.name.maxLength}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={PROFILE.email.maxLength}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Button type="submit" disabled={busy}>
          Save profile
        </Button>
      </form>
    </Section>
  );
}

function PasswordForm() {
  const [result, setResult] = useState<Result>();
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const field = (name: string) => String(new FormData(form).get(name));
    const [currentPassword, newPassword, confirmPassword] = [
      field('currentPassword'),
      field('newPassword'),
      field('confirmPassword'),
    ];
    if (newPassword !== confirmPassword) {
      setResult({ ok: false, message: 'The new passwords do not match.' });
      return;
    }

    setBusy(true);
    setResult(undefined);
    const outcome = await attempt(async () => {
      // The server sets the new session's cookies itself.
      const { data, error, response } = await api.PUT('/api/v1/users/me/password', {
        body: { currentPassword, newPassword, confirmPassword },
      });
      if (data) return { ok: true };
      return {
        ok: false,
        message:
          response.status === 401
            ? 'Your current password is wrong.'
            : messageFor(response.status, error),
      };
    });
    if (outcome?.ok) form.reset();
    setResult(outcome);
    setBusy(false);
  }

  return (
    <Section title="Change password">
      <form onSubmit={submit} className="space-y-4">
        <ResultMessage result={result} success="Password changed." />
        <Field
          label="Current password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
        <Field
          label="New password"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={NEW_PASSWORD.minLength}
          maxLength={NEW_PASSWORD.maxLength}
        />
        <Field
          label="Confirm new password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={NEW_PASSWORD.minLength}
          maxLength={NEW_PASSWORD.maxLength}
        />
        <Button type="submit" disabled={busy}>
          Change password
        </Button>
      </form>
    </Section>
  );
}

function DeleteAccount() {
  const { signedOut } = useSession();
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<Result>();
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get('password'));
    setBusy(true);
    setResult(undefined);
    const outcome = await attempt(async () => {
      const { error, response } = await api.DELETE('/api/v1/users/me', { body: { password } });
      if (response.status === 204) return { ok: true };
      return {
        ok: false,
        message:
          response.status === 401 ? 'That password is wrong.' : messageFor(response.status, error),
      };
    });
    setBusy(false);
    if (outcome?.ok) return signedOut();
    setResult(outcome);
  }

  return (
    <Section title="Delete account">
      <p className="text-sm text-gray-400">
        This deletes your account and every habit in it. It cannot be undone.
      </p>
      {confirming ? (
        <form onSubmit={submit} className="space-y-4">
          <ResultMessage result={result} success="" />
          <Field
            label="Your password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          <div className="flex gap-2">
            <Button type="submit" variant="danger" disabled={busy}>
              Delete my account
            </Button>
            <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
              Keep my account
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="danger" onClick={() => setConfirming(true)}>
          Delete account…
        </Button>
      )}
    </Section>
  );
}
