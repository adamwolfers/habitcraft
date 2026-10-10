import { habitViewModeKey, clearHabitViewModes } from './storageUtils';

describe('habitViewModeKey', () => {
  it('namespaces the key by habit id', () => {
    expect(habitViewModeKey('habit-123')).toBe('habitcraft-view-habit-123');
  });
});

describe('clearHabitViewModes', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('removes every stored habit view mode', () => {
    localStorage.setItem(habitViewModeKey('habit-1'), JSON.stringify('monthly'));
    localStorage.setItem(habitViewModeKey('habit-2'), JSON.stringify('weekly'));

    clearHabitViewModes();

    expect(localStorage.getItem(habitViewModeKey('habit-1'))).toBeNull();
    expect(localStorage.getItem(habitViewModeKey('habit-2'))).toBeNull();
    expect(localStorage).toHaveLength(0);
  });

  it('leaves unrelated keys alone', () => {
    localStorage.setItem(habitViewModeKey('habit-1'), JSON.stringify('monthly'));
    localStorage.setItem('some-other-app', 'keep');

    clearHabitViewModes();

    expect(localStorage.getItem('some-other-app')).toBe('keep');
    expect(localStorage).toHaveLength(1);
  });

  it('does not throw when localStorage is unavailable', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(Storage.prototype, 'key').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    localStorage.setItem(habitViewModeKey('habit-1'), JSON.stringify('monthly'));

    expect(() => clearHabitViewModes()).not.toThrow();
    expect(consoleErrorSpy).toHaveBeenCalled();

    jest.restoreAllMocks();
  });
});
