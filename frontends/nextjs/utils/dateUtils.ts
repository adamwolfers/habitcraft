export const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
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
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { weekday: 'short' });
};

export const getMonthDay = (dateString: string): string => {
  const date = new Date(dateString);
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
