import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { localDate, useToday } from './today.ts';

describe('localDate', () => {
  it("is the day on the user's own calendar, as YYYY-MM-DD", () => {
    expect(localDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(localDate(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31');
  });
});

describe('useToday', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date(2026, 9, 22, 23, 59, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is today', () => {
    const { result } = renderHook(() => useToday());

    expect(result.current).toBe('2026-10-22');
  });

  it('turns over at midnight', () => {
    const { result } = renderHook(() => useToday());

    act(() => vi.advanceTimersByTime(61_000));

    expect(result.current).toBe('2026-10-23');
  });

  it('catches up when the window regains focus', () => {
    const { result } = renderHook(() => useToday());

    // A sleeping laptop runs no timers.
    vi.setSystemTime(new Date(2026, 9, 24, 8, 0, 0));
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(result.current).toBe('2026-10-24');
  });

  it('catches up when the page becomes visible again', () => {
    const { result } = renderHook(() => useToday());

    vi.setSystemTime(new Date(2026, 9, 24, 8, 0, 0));
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(result.current).toBe('2026-10-24');
  });

  it('stops listening once unmounted', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useToday());

    unmount();

    expect(remove).toHaveBeenCalledWith('focus', expect.any(Function));
  });
});
