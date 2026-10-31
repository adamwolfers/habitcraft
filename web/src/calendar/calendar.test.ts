import { describe, expect, it } from 'vitest';
import { addMonths, isMonth, leadingBlanks, monthDays, monthOf } from './calendar.ts';

describe('monthOf', () => {
  it('names the month a date falls in', () => {
    expect(monthOf('2026-10-22')).toBe('2026-10');
  });
});

describe('isMonth', () => {
  it.each(['2026-10', '2026-01', '1999-12'])('takes %s', (month) => {
    expect(isMonth(month)).toBe(true);
  });

  it.each([null, '', '2026-13', '2026-00', '2026-1', '2026-10-22', 'october'])(
    'refuses %s',
    (month) => {
      expect(isMonth(month)).toBe(false);
    }
  );
});

describe('addMonths', () => {
  it('steps forward and back across a year', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-10', -13)).toBe('2025-09');
  });
});

describe('monthDays', () => {
  it('lists every day of the month, first to last', () => {
    const days = monthDays('2026-10');
    expect(days).toHaveLength(31);
    expect(days[0]).toBe('2026-10-01');
    expect(days.at(-1)).toBe('2026-10-31');
  });

  it('knows a leap February', () => {
    expect(monthDays('2028-02')).toHaveLength(29);
    expect(monthDays('2026-02')).toHaveLength(28);
  });
});

describe('leadingBlanks', () => {
  it('pads the first week up to the 1st, from Sunday', () => {
    // 1 October 2026 is a Thursday; 1 November 2026 a Sunday.
    expect(leadingBlanks('2026-10')).toBe(4);
    expect(leadingBlanks('2026-11')).toBe(0);
  });
});
