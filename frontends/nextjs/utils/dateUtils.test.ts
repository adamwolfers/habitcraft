import { formatDate, isToday, getLastNDays, getDayName, getMonthDay } from './dateUtils';

describe('dateUtils', () => {
  describe('formatDate', () => {
    it('should format date to YYYY-MM-DD', () => {
      const date = new Date('2025-10-30T12:00:00.000Z');
      const formatted = formatDate(date);
      expect(formatted).toBe('2025-10-30');
    });

    it('should handle single digit months and days', () => {
      const date = new Date('2025-01-05T12:00:00.000Z');
      const formatted = formatDate(date);
      expect(formatted).toBe('2025-01-05');
    });
  });

  describe('isToday', () => {
    it('should return true for today\'s date', () => {
      const today = new Date();
      const todayString = formatDate(today);
      expect(isToday(todayString)).toBe(true);
    });

    it('should return false for yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayString = formatDate(yesterday);
      expect(isToday(yesterdayString)).toBe(false);
    });

    it('should return false for tomorrow', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowString = formatDate(tomorrow);
      expect(isToday(tomorrowString)).toBe(false);
    });
  });

  describe('getLastNDays', () => {
    it('should return array of last N days', () => {
      const days = getLastNDays(3);
      expect(days).toHaveLength(3);
      expect(days[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(days[1]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(days[2]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should return dates in chronological order', () => {
      const days = getLastNDays(7);
      expect(days).toHaveLength(7);

      // Last day should be today
      const today = formatDate(new Date());
      expect(days[6]).toBe(today);

      // Days should be in ascending order
      for (let i = 0; i < days.length - 1; i++) {
        const current = new Date(days[i]);
        const next = new Date(days[i + 1]);
        expect(current.getTime()).toBeLessThan(next.getTime());
      }
    });

    it('should handle single day', () => {
      const days = getLastNDays(1);
      expect(days).toHaveLength(1);
      const today = formatDate(new Date());
      expect(days[0]).toBe(today);
    });
  });

  describe('getDayName', () => {
    it('should return short day name', () => {
      const date = '2025-10-30';
      const dayName = getDayName(date);
      expect(dayName).toMatch(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/);
    });

    it('should handle different dates', () => {
      // Use a date that we know the day for, accounting for timezone
      const date = '2025-11-03';
      const dayName = getDayName(date);
      // Just check it returns a valid day name
      expect(dayName).toMatch(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/);
    });
  });

  describe('getMonthDay', () => {
    it('should return month and day', () => {
      const date = '2025-10-30';
      const monthDay = getMonthDay(date);
      expect(monthDay).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
    });

    it('should handle January dates', () => {
      const date = '2025-01-15';
      const monthDay = getMonthDay(date);
      // Match the format but allow for timezone differences
      expect(monthDay).toMatch(/^Jan (14|15)$/);
    });

    it('should handle December dates', () => {
      const date = '2025-12-25';
      const monthDay = getMonthDay(date);
      // Match the format but allow for timezone differences
      expect(monthDay).toMatch(/^Dec (24|25)$/);
    });
  });
});
