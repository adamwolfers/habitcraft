/**
 * Today, on the user's own calendar. The API's dates carry no time zone, so
 * the app names the day the user is living in.
 */
import { useEffect, useState } from 'react';

/** The day a moment falls on in the browser's time zone, as YYYY-MM-DD. */
export function localDate(moment: Date): string {
  const month = String(moment.getMonth() + 1).padStart(2, '0');
  const day = String(moment.getDate()).padStart(2, '0');
  return `${moment.getFullYear()}-${month}-${day}`;
}

/** The time until the next local midnight, just past it. */
function untilMidnight(now: Date): number {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return midnight.getTime() - now.getTime() + 1000;
}

/**
 * Today's date, kept current: it turns over at midnight, and catches up when
 * the page comes back, since a sleeping machine runs no timers.
 */
export function useToday(): string {
  const [today, setToday] = useState(() => localDate(new Date()));

  useEffect(() => {
    const check = () => setToday(localDate(new Date()));
    const timer = setTimeout(check, untilMidnight(new Date()));
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
    // Re-armed each day, so the next midnight is timed from the new one.
  }, [today]);

  return today;
}
