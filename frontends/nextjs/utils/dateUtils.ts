export interface CalendarMonth {
  year: number;
  month: number; // 0-11
  monthName: string;
  weeks: string[][]; // 4-6 rows of 7 date strings (empty string for padding)
}

export const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const isToday = (dateString: string): boolean => {
  const today = formatDate(new Date());
  return dateString === today;
};

export const getLastNDays = (n: number): string[] => {
  const dates: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    dates.push(formatDate(date));
  }
  return dates;
};

export const getDayName = (dateString: string): string => {
  // Parse as local date to avoid timezone shifts
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { weekday: 'short' });
};

export const getMonthDay = (dateString: string): string => {
  // Parse as local date to avoid timezone shifts
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const getCalendarWeek = (weekOffset: number = 0): string[] => {
  const today = new Date();
  const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.

  // Calculate the most recent Sunday
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - currentDay);

  // Apply week offset
  sunday.setDate(sunday.getDate() + (weekOffset * 7));

  // Generate all 7 days of the week (Sunday through Saturday)
  const week: string[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(sunday);
    day.setDate(sunday.getDate() + i);
    week.push(formatDate(day));
  }

  return week;
};

export const getCalendarMonth = (monthOffset: number = 0): CalendarMonth => {
  const today = new Date();
  const targetDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);

  const year = targetDate.getFullYear();
  const month = targetDate.getMonth();

  // Get month name
  const monthName = targetDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Get first day of month (0 = Sunday, 6 = Saturday)
  const firstDayOfWeek = targetDate.getDay();

  // Get number of days in month
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Build calendar grid
  const weeks: string[][] = [];
  let currentDay = 1;

  // Calculate how many weeks we need (4-6 rows)
  const totalCells = firstDayOfWeek + daysInMonth;
  const numWeeks = Math.ceil(totalCells / 7);

  for (let week = 0; week < numWeeks; week++) {
    const weekDays: string[] = [];

    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      const cellIndex = week * 7 + dayOfWeek;

      if (cellIndex < firstDayOfWeek || currentDay > daysInMonth) {
        // Padding for days before month starts or after month ends
        weekDays.push('');
      } else {
        // Actual day of the month
        const date = new Date(year, month, currentDay);
        weekDays.push(formatDate(date));
        currentDay++;
      }
    }

    weeks.push(weekDays);
  }

  return {
    year,
    month,
    monthName,
    weeks,
  };
};
