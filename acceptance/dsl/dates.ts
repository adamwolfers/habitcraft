import type { IsoDate } from '../drivers/driver.ts';

/** How a test case names a day: relative words, or an explicit YYYY-MM-DD. */
export type Day = 'today' | 'yesterday' | 'tomorrow' | `${number} days ago` | IsoDate;

const DAYS_AGO = /^(\d+) days ago$/;

/**
 * Resolve a day to a calendar date. Dates are UTC, matching the database and
 * the web driver's browser time zone, so "today" means the same day to the
 * test and to the system under test.
 */
export function resolveDay(day: Day, now: Date = new Date()): IsoDate {
  const offset = offsetOf(day);
  if (offset !== undefined) {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`Not a day: "${day}"`);
  return day;
}

/** Days from today for a relative day; undefined for an explicit date. */
function offsetOf(day: Day): number | undefined {
  if (day === 'today') return 0;
  if (day === 'yesterday') return -1;
  if (day === 'tomorrow') return 1;
  const ago = DAYS_AGO.exec(day);
  return ago ? -Number(ago[1]) : undefined;
}
