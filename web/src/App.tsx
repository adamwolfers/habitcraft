import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router';
import { onSignedOut } from './api/client.ts';
import { Layout } from './components/Layout.tsx';
import { RegisterPage, SignInPage } from './pages/AuthPages.tsx';
import { HabitsPage } from './pages/HabitsPage.tsx';
import { ProfilePage } from './pages/ProfilePage.tsx';
import { TodayPage } from './pages/TodayPage.tsx';
import { useCurrentUser, useSession } from './session/session.ts';
import type { User } from './types/api.ts';

/** Where a signed-in user lands: the Today view. */
const HOME = '/';

export function App() {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

/** The routes alone, so a test can render them inside a MemoryRouter. */
export function AppRoutes() {
  const { signedOut } = useSession();
  // A session that could not be renewed ends here, wherever the user was.
  useEffect(() => onSignedOut(signedOut), [signedOut]);

  return (
    <Routes>
      <Route element={<SignedOutOnly />}>
        <Route path="/login" element={<SignInPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>
      <Route element={<SignedInOnly>{(user) => <Layout key={user.id} />}</SignedInOnly>}>
        <Route path="/" element={<TodayPage />} />
        <Route path="/habits" element={<HabitsPage />} />
        <Route
          path="/profile"
          element={<CurrentUser>{(user) => <ProfilePage user={user} />}</CurrentUser>}
        />
      </Route>
      <Route path="*" element={<Navigate to={HOME} replace />} />
    </Routes>
  );
}

function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-900 text-gray-400">
      <p role="status">Loading…</p>
    </main>
  );
}

function SignedOutOnly() {
  const user = useCurrentUser();
  if (user.isPending) return <Loading />;
  return user.data ? <Navigate to={HOME} replace /> : <Outlet />;
}

function SignedInOnly({ children }: { children: (user: User) => ReactNode }) {
  const user = useCurrentUser();
  if (user.isPending) return <Loading />;
  if (user.isError) {
    return (
      <main className="p-8 text-gray-100">
        <p role="alert">HabitCraft could not reach its server. Reload the page to try again.</p>
      </main>
    );
  }
  return user.data ? children(user.data) : <Navigate to="/login" replace />;
}

/** The signed-in user, for a page inside SignedInOnly. */
function CurrentUser({ children }: { children: (user: User) => ReactNode }) {
  const user = useCurrentUser();
  return user.data ? children(user.data) : null;
}
