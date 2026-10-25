import { describe, expect, it } from 'vitest';
import { addDays, DAYS_PER_ROW, firstDay, GRID_DAYS, gridDays, ROWS } from './dots.ts';

describe('addDays', () => {
  it('counts across a month and a year', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('counts a leap day', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });
});

describe('gridDays', () => {
  it('fills every row of the grid', () => {
    expect(GRID_DAYS).toBe(ROWS * DAYS_PER_ROW);
    expect(gridDays('2026-10-22')).toHaveLength(GRID_DAYS);
  });

  it('runs day by day from the first day to today', () => {
    const days = gridDays('2026-10-22');
    expect(days[0]).toBe(firstDay('2026-10-22'));
    expect(days.at(-1)).toBe('2026-10-22');
    expect(days.slice(-3)).toEqual(['2026-10-20', '2026-10-21', '2026-10-22']);
    expect(new Set(days).size).toBe(GRID_DAYS);
  });

  it('starts the days before today that fill the grid', () => {
    expect(firstDay('2026-10-22')).toBe(addDays('2026-10-22', 1 - GRID_DAYS));
  });
});
