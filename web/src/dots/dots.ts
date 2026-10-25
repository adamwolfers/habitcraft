/**
 * Which days a habit's dot grid shows. Dates are YYYY-MM-DD on the user's own
 * calendar, as the API's dates and src/today/ name them.
 */
import { localDate } from '../today/today.ts';

/** The grid's shape: rows of consecutive days, the last one ending today. */
export const ROWS = 7;
export const DAYS_PER_ROW = 28;

/** The days every grid shows, whenever its habit was created. */
export const GRID_DAYS = ROWS * DAYS_PER_ROW;

/** The date `days` days after `date` (before it, when negative). */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return localDate(new Date(year!, month! - 1, day! + days));
}

/** The first day a grid shows, given today. */
export function firstDay(today: string): string {
  return addDays(today, 1 - GRID_DAYS);
}

/** The days a grid shows, oldest first, ending today. */
export function gridDays(today: string): string[] {
  return Array.from({ length: GRID_DAYS }, (_, index) => addDays(firstDay(today), index));
}
