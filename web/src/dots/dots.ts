/**
 * Which days a habit's dot grid shows. Dates are YYYY-MM-DD on the user's own
 * calendar, as the API's dates and src/today/ name them.
 */
import { localDate } from '../today/today.ts';

/**
 * The most days one grid shows: a year, ending today. The view's own rule,
 * which happens to fit the range endpoint's 366-day cap.
 */
export const MOST_DAYS = 365;

/** The date `days` days after `date` (before it, when negative). */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return localDate(new Date(year!, month! - 1, day! + days));
}

/** The first day any grid can show, given today. */
export function firstDay(today: string): string {
  return addDays(today, 1 - MOST_DAYS);
}

/**
 * The days one habit's grid shows, oldest first, ending today. It starts on
 * the day the habit was created, or on its first checked-off day when that is
 * earlier, since a day before the habit existed can be checked off too. It
 * never starts before `firstDay(today)`.
 */
export function dotDays(today: string, createdAt: string, done: Iterable<string>): string[] {
  let start = localDate(new Date(createdAt));
  for (const date of done) if (date < start) start = date;
  if (start < firstDay(today)) start = firstDay(today);
  if (start > today) start = today;

  const days: string[] = [];
  for (let date = start; date <= today; date = addDays(date, 1)) days.push(date);
  return days;
}
