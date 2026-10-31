import { useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { api } from '../api/client.ts';
import { useSession } from '../session/session.ts';

const link = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-2 py-2 text-sm font-medium sm:px-3 ${
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
        <nav
          aria-label="Main"
          className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-1 gap-y-2 px-4 py-3 sm:gap-x-2"
        >
          {/* On a phone the name takes its own line, so the links fit beneath it. */}
          <span className="w-full text-lg font-bold text-blue-400 sm:mr-auto sm:w-auto">
            HabitCraft
          </span>
          <NavLink to="/" end className={link}>
            Today
          </NavLink>
          <NavLink to="/dots" className={link}>
            Dots
          </NavLink>
          {/* end: a habit's own page is reached from Dots, not this list. */}
          <NavLink to="/habits" end className={link}>
            Habits
          </NavLink>
          <NavLink to="/profile" className={link}>
            Profile
          </NavLink>
          <button
            onClick={signOut}
            disabled={busy}
            className="rounded-md px-2 py-2 text-sm font-medium text-gray-300 hover:text-white sm:px-3"
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
