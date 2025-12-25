## Development Principles

1. **Security First** - Never compromise on authentication and authorization
2. **Test-Driven Development** - Write unit tests before implementation.  Target >90% coverage.
3. **Small, Focused Commits** - Commit after each passing test or feature
4. **Documentation** - Update docs alongside features
5. **User Experience** - Smooth, responsive UI with proper error handling
6. **Code Quality** - Clean, readable, modular, maintainable code

## General Notes

- All tests can be run sequentially using scripts/test-all.sh
- After each round of updates, and before committing those changes, check all project docs to see if they need updating
- Verify that you're in the expected branch and directory before running terminal commands

## Running tests with npm test

Use `npm test -- <pattern>` to run specific tests. Do NOT use `--testPathPattern` flag - it's deprecated:

```bash
# Correct
npm test -- Header.test.tsx

# Wrong - deprecated flag
npm test -- --testPathPattern="Header.test.tsx"
```

## Testing Patterns

### Extract Logic to Utility Functions

**Problem:** React component logic using closures (e.g., `habits.find()` inside an event handler) captures state at render time. This makes branches hard to test because:
- Mocking the hook doesn't update the closure
- The UI only passes valid IDs from the same data
- Edge cases (like "item not found") can't occur through normal interaction

**Solution:** Extract the logic to a pure utility function that can be tested in isolation.

**Before (hard to test):**
```tsx
// page.tsx
const handleEditHabit = (habitId: string) => {
  const habit = habits.find((h) => h.id === habitId);  // Closure captures habits
  if (!habit) {
    console.error(`Habit not found: ${habitId}`);
    return;
  }
  setEditingHabit(habit);
};
```

**After (testable):**
```tsx
// utils/habitUtils.ts
export function findHabitById(habits: Habit[], habitId: string): Habit | undefined {
  return habits.find((h) => h.id === habitId);
}

// page.tsx
import { findHabitById } from "@/utils/habitUtils";

const handleEditHabit = (habitId: string) => {
  const habit = findHabitById(habits, habitId);  // Now mockable
  if (!habit) {
    console.error(`Habit not found: ${habitId}`);
    return;
  }
  setEditingHabit(habit);
};
```

**Testing the utility (trivial):**
```tsx
// utils/habitUtils.test.ts
describe("findHabitById", () => {
  it("returns undefined when habit is not found", () => {
    expect(findHabitById([mockHabit], "bad-id")).toBeUndefined();
  });
});
```

**Testing the component branch (now possible):**
```tsx
// page.test.tsx
jest.mock("@/utils/habitUtils", () => ({
  findHabitById: jest.fn(),
}));

it("logs error when habit not found", async () => {
  mockFindHabitById.mockReturnValue(undefined);  // Force the edge case
  // ... click edit button
  expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("not found"));
});
```

**When to apply this pattern:**
- Defensive code branches that can't be triggered through UI
- Logic that depends on component state captured in closures
- Any pure logic that would benefit from isolated unit tests
