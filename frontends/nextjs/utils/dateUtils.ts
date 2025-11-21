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
