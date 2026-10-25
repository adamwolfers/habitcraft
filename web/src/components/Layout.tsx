import { useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { api } from '../api/client.ts';
import { useSession } from '../session/session.ts';

const link = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-gray-800 text-white' : 'text-gray-300 hover:text-white'
  }`;

/** The signed-in app: navigation above, the current page below. */
export function Layout() {
  const { signedOut } = useSession();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    // Always 200; the session ends here whatever the network did.
    await api.POST('/api/v1/auth/logout').catch(() => undefined);
    signedOut();
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <header className="border-b border-gray-800">
        <nav aria-label="Main" className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          <span className="mr-auto text-lg font-bold text-blue-400">HabitCraft</span>
          <NavLink to="/" end className={link}>
            Today
          </NavLink>
          <NavLink to="/dots" className={link}>
            Dots
          </NavLink>
          <NavLink to="/habits" className={link}>
            Habits
          </NavLink>
          <NavLink to="/profile" className={link}>
            Profile
          </NavLink>
          <button
            onClick={signOut}
            disabled={busy}
            className="rounded-md px-3 py-2 text-sm font-medium text-gray-300 hover:text-white"
          >
            Sign out
          </button>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
