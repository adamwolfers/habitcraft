import { renderHook, act } from '@testing-library/react';
import { useHabitViewMode } from './useHabitViewMode';

describe('useHabitViewMode', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns weekly as the default view mode', () => {
    const { result } = renderHook(() => useHabitViewMode('habit-123'));

    expect(result.current[0]).toBe('weekly');
  });

  it('returns stored view mode from localStorage', () => {
    localStorage.setItem('habitcraft-view-habit-123', JSON.stringify('monthly'));

    const { result } = renderHook(() => useHabitViewMode('habit-123'));

    expect(result.current[0]).toBe('monthly');
  });

  it('persists view mode changes to localStorage', () => {
    const { result } = renderHook(() => useHabitViewMode('habit-123'));

    act(() => {
      result.current[1]('monthly');
    });

    expect(result.current[0]).toBe('monthly');
    expect(localStorage.getItem('habitcraft-view-habit-123')).toBe(JSON.stringify('monthly'));
  });

  it('uses unique storage key per habit', () => {
    const { result: result1 } = renderHook(() => useHabitViewMode('habit-1'));
    const { result: result2 } = renderHook(() => useHabitViewMode('habit-2'));

    act(() => {
      result1.current[1]('monthly');
    });

    expect(result1.current[0]).toBe('monthly');
    expect(result2.current[0]).toBe('weekly');
    expect(localStorage.getItem('habitcraft-view-habit-1')).toBe(JSON.stringify('monthly'));
    expect(localStorage.getItem('habitcraft-view-habit-2')).toBeNull();
  });

  it('can toggle between weekly and monthly', () => {
    const { result } = renderHook(() => useHabitViewMode('habit-123'));

    expect(result.current[0]).toBe('weekly');

    act(() => {
      result.current[1]('monthly');
    });
    expect(result.current[0]).toBe('monthly');

    act(() => {
      result.current[1]('weekly');
    });
    expect(result.current[0]).toBe('weekly');
  });
});
