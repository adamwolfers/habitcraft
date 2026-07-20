import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from './useLocalStorage';

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('returns initial value when localStorage is empty', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'default'));

    expect(result.current[0]).toBe('default');
  });

  it('returns stored value when localStorage has data', () => {
    localStorage.setItem('test-key', JSON.stringify('stored-value'));

    const { result } = renderHook(() => useLocalStorage('test-key', 'default'));

    expect(result.current[0]).toBe('stored-value');
  });

  it('updates state and localStorage when setValue is called', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'default'));

    act(() => {
      result.current[1]('new-value');
    });

    expect(result.current[0]).toBe('new-value');
    expect(localStorage.getItem('test-key')).toBe(JSON.stringify('new-value'));
  });

  it('works with object values', () => {
    const initialValue = { name: 'test', count: 0 };
    const { result } = renderHook(() => useLocalStorage('test-key', initialValue));

    expect(result.current[0]).toEqual(initialValue);

    const newValue = { name: 'updated', count: 5 };
    act(() => {
      result.current[1](newValue);
    });

    expect(result.current[0]).toEqual(newValue);
    expect(JSON.parse(localStorage.getItem('test-key')!)).toEqual(newValue);
  });

  it('returns initial value when localStorage contains invalid JSON', () => {
    localStorage.setItem('test-key', 'not-valid-json');

    const { result } = renderHook(() => useLocalStorage('test-key', 'default'));

    expect(result.current[0]).toBe('default');
  });

  it('handles localStorage errors gracefully when reading', () => {
    const getItemSpy = jest.spyOn(Storage.prototype, 'getItem');
    getItemSpy.mockImplementation(() => {
      throw new Error('localStorage error');
    });

    const { result } = renderHook(() => useLocalStorage('test-key', 'default'));

    expect(result.current[0]).toBe('default');

    getItemSpy.mockRestore();
  });

  it('handles localStorage errors gracefully when writing', () => {
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');
    setItemSpy.mockImplementation(() => {
      throw new Error('localStorage error');
    });
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const { result } = renderHook(() => useLocalStorage('test-key', 'default'));

    act(() => {
      result.current[1]('new-value');
    });

    // State should still update even if localStorage fails
    expect(result.current[0]).toBe('new-value');
    expect(consoleSpy).toHaveBeenCalled();

    setItemSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it('uses different storage for different keys', () => {
    const { result: result1 } = renderHook(() => useLocalStorage('key-1', 'default-1'));
    const { result: result2 } = renderHook(() => useLocalStorage('key-2', 'default-2'));

    act(() => {
      result1.current[1]('value-1');
    });

    expect(result1.current[0]).toBe('value-1');
    expect(result2.current[0]).toBe('default-2');
  });
});
