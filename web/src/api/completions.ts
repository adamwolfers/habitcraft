/**
 * Every habit's completions over a range of days, from one
 * GET /api/v1/completions, as the Today and Dots views read them.
 */
import { api } from './client.ts';

/** Every completions query starts with this, so a change can mark them all stale. */
export const COMPLETIONS = 'completions';

export const completionsKey = (startDate: string, endDate: string) =>
  [COMPLETIONS, startDate, endDate] as const;

export async function fetchCompletions(startDate: string, endDate: string) {
  const { data, response } = await api.GET('/api/v1/completions', {
    params: { query: { startDate, endDate } },
  });
  if (!data) throw new Error(`Loading completions failed with ${response.status}`);
  return data;
}
