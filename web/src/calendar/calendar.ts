/**
 * The month calendar on the habit detail page, and the date words every page
 * shows. Dates are YYYY-MM-DD and months YYYY-MM, on the user's own calendar,
 * as the API's dates and src/today/ name them.
 */
import { localDate } from '../today/today.ts';

/** The month a date falls in, as YYYY-MM. */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** Whether `month` is a real YYYY-MM month, as a URL may carry anything. */
export function isMonth(month: string | null): month is string {
  return month !== null && /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

/** The month `months` months after `month` (before it, when negative). */
export function addMonths(month: string, months: number): string {
  const [year, index] = month.split('-').map(Number);
  return localDate(new Date(year!, index! - 1 + months, 1)).slice(0, 7);
}

/** Every day of the month, first to last. */
export function monthDays(month: string): string[] {
  const [year, index] = month.split('-').map(Number);
  const length = new Date(year!, index!, 0).getDate();
  return Array.from({ length }, (_, day) => localDate(new Date(year!, index! - 1, day + 1)));
}

/** The empty cells before the 1st, in a week that starts on Sunday. */
export function leadingBlanks(month: string): number {
  const [year, index] = month.split('-').map(Number);
  return new Date(year!, index! - 1, 1).getDay();
}

function dateOf(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year!, month! - 1, day);
}

/** "Thu, Oct 22, 2026", in the user's language. */
export function formatDate(date: string): string {
  return dateOf(date).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** "October 2026", from a YYYY-MM month, in the user's language. */
export function formatMonth(month: string): string {
  return dateOf(`${month}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
