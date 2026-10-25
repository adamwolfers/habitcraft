import { describe, expect, it } from 'vitest';
import { addDays, dotDays, firstDay, MOST_DAYS } from './dots.ts';

/** A creation time at a local hour, as the API would send it. */
const at = (year: number, month: number, day: number, hour = 12) =>
  new Date(year, month - 1, day, hour).toISOString();

describe('addDays', () => {
  it('counts across a month and a year', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('counts a leap day', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });
});

describe('firstDay', () => {
  it('is the first of the most days a grid shows, ending today', () => {
    expect(firstDay('2026-10-22')).toBe(addDays('2026-10-22', 1 - MOST_DAYS));
    expect(dotDays('2026-10-22', at(2020, 1, 1), [])).toHaveLength(MOST_DAYS);
  });
});

describe('dotDays', () => {
  it('runs from the day the habit was created to today', () => {
    expect(dotDays('2026-10-22', at(2026, 10, 20), [])).toEqual([
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
    ]);
  });

  it('is only today for a habit created today', () => {
    expect(dotDays('2026-10-22', at(2026, 10, 22, 8), [])).toEqual(['2026-10-22']);
  });

  it('starts on a checked-off day before the habit was created', () => {
    expect(dotDays('2026-10-22', at(2026, 10, 22, 8), ['2026-10-22', '2026-10-19'])).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
    ]);
  });

  it('starts no earlier than the first day a grid can show', () => {
    const days = dotDays('2026-10-22', at(2026, 10, 22, 8), ['2024-01-01']);
    expect(days[0]).toBe(firstDay('2026-10-22'));
    expect(days.at(-1)).toBe('2026-10-22');
  });

  it('is today alone when the habit was created after it, by a clock ahead of this one', () => {
    expect(dotDays('2026-10-22', at(2026, 10, 24), [])).toEqual(['2026-10-22']);
  });
});
