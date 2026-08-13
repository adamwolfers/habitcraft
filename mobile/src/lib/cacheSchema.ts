/**
 * Describes the shape of data stored in the React Query persistent cache.
 * Update this when any cached query's response shape changes — the hash
 * is used as the PersistQueryClientProvider buster, which discards stale
 * caches that don't match the current schema.
 */
export const CACHE_SCHEMA = {
  habits: {
    fields: [
      'id',
      'userId',
      'name',
      'description',
      'frequency',
      'color',
      'icon',
      'status',
      'createdAt',
      'updatedAt',
      'completions',
    ],
    completions: ['id', 'habit_id', 'completed_date', 'note', 'created_at'],
  },
} as const;

export function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

export const CACHE_BUSTER = hashString(JSON.stringify(CACHE_SCHEMA));
