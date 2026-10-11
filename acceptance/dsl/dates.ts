import type { IsoDate } from '../drivers/driver.ts';

/** How a test case names a day: relative words, or an explicit YYYY-MM-DD. */
export type Day = 'today' | 'yesterday' | IsoDate;

/**
 * Resolve a day to a calendar date. Dates are UTC, matching the database and
 * the web driver's browser time zone, so "today" means the same day to the
 * test and to the system under test.
 */
export function resolveDay(day: Day, now: Date = new Date()): IsoDate {
  if (day === 'today' || day === 'yesterday') {
    const date = new Date(now);
    if (day === 'yesterday') date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`Not a day: "${day}"`);
  return day;
}
