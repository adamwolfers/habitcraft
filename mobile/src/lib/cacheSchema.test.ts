import { CACHE_SCHEMA, CACHE_BUSTER } from './cacheSchema';

describe('CACHE_SCHEMA', () => {
  it('includes completions in habits fields', () => {
    expect(CACHE_SCHEMA.habits.fields).toContain('completions');
  });

  it('defines completions shape', () => {
    expect(CACHE_SCHEMA.habits.completions).toContain('completed_date');
    expect(CACHE_SCHEMA.habits.completions).toContain('habit_id');
  });
});

describe('CACHE_BUSTER', () => {
  it('is a non-empty hex string', () => {
    expect(CACHE_BUSTER).toMatch(/^[0-9a-f]+$/);
  });

  it('changes when schema changes', () => {
    const original = CACHE_BUSTER;
    // Simulate a schema change by hashing different content
    const { hashString } = require('./cacheSchema');
    const modified = hashString(
      JSON.stringify({
        ...CACHE_SCHEMA,
        habits: { ...CACHE_SCHEMA.habits, fields: [...CACHE_SCHEMA.habits.fields, 'newField'] },
      })
    );
    expect(modified).not.toBe(original);
  });

  it('is stable — same schema produces same hash', () => {
    const { hashString } = require('./cacheSchema');
    const a = hashString(JSON.stringify(CACHE_SCHEMA));
    const b = hashString(JSON.stringify(CACHE_SCHEMA));
    expect(a).toBe(b);
  });
});
