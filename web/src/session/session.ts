/**
 * Who is signed in. The access token is an httpOnly cookie the app cannot
 * read, so it asks the server: the current user, or null when signed out.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { api } from '../api/client.ts';
import type { User } from '../types/api.ts';

export const CURRENT_USER = ['current-user'] as const;

export async function fetchCurrentUser(): Promise<User | null> {
  const { data, response } = await api.GET('/api/v1/users/me');
  if (data) return data;
  // 404: the account was deleted while its token was still good.
  if (response.status === 401 || response.status === 404) return null;
  throw new Error(`Loading the current user failed with ${response.status}`);
}

export function useCurrentUser() {
  return useQuery({
    queryKey: CURRENT_USER,
    queryFn: fetchCurrentUser,
    staleTime: Infinity,
    retry: false,
  });
}

/**
 * Start or end a session in the app. Either way the previous user's data is
 * dropped first, so nothing of theirs shows to the next.
 *
 * The current user is set rather than dropped: a session can end while that
 * very query is in flight, and dropping it would only send it again.
 */
export function useSession() {
  const queryClient = useQueryClient();

  const becomes = useCallback(
    (user: User | null) => {
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== CURRENT_USER[0] });
      queryClient.setQueryData(CURRENT_USER, user);
    },
    [queryClient]
  );

  const signedIn = useCallback((user: User) => becomes(user), [becomes]);
  const signedOut = useCallback(() => becomes(null), [becomes]);

  return { signedIn, signedOut };
}
