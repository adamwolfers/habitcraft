# Plan: Weekly/Monthly View Toggle for HabitCard

**Status:** Complete
**Branch:** `feature/habit-view-toggle`
**Created:** 2025-12-25

## Summary

Add a per-habit toggle to switch between weekly view (current 7-day row) and monthly view (traditional 7x5 calendar grid).

## Implementation Steps (TDD)

### Step 1: Add `getCalendarMonth` utility ✅
- [x] Write tests in `frontends/nextjs/utils/dateUtils.test.ts`
- [x] Implement `getCalendarMonth()` in `frontends/nextjs/utils/dateUtils.ts`
- [x] Commit: "Add getCalendarMonth utility function with tests"

### Step 2: Add view toggle UI to HabitCard ✅
- [x] Write tests in `frontends/nextjs/components/HabitCard.test.tsx`
- [x] Add `viewMode` state and toggle UI in `HabitCard.tsx`
- [x] Commit: "Add weekly/monthly view toggle to HabitCard"

### Step 3: Implement monthly calendar grid ✅
- [x] Write tests for monthly grid layout
- [x] Add `monthOffset` state and 7-column calendar grid
- [x] Commit: (combined with step 2)

### Step 4: Add month navigation ✅
- [x] Write tests for month navigation
- [x] Add previous/next/current month buttons
- [x] Commit: (combined with step 2)

### Step 5: Wire up completion toggling ✅
- [x] Write tests for completion toggling in monthly view
- [x] Wire onClick handlers for day cells
- [x] Commit: (combined with step 2)

### Step 6: Final polish ✅
- [x] Run all tests - 361 tests passing
- [x] Commit: "Add weekly/monthly view toggle to HabitCard"

## Files to Modify

| File | Changes |
|------|---------|
| `frontends/nextjs/utils/dateUtils.ts` | Add `CalendarMonth` type and `getCalendarMonth()` |
| `frontends/nextjs/utils/dateUtils.test.ts` | Add tests for `getCalendarMonth()` |
| `frontends/nextjs/components/HabitCard.tsx` | Add toggle, monthly view, month navigation |
| `frontends/nextjs/components/HabitCard.test.tsx` | Add tests for toggle and monthly view |

## Technical Details

### CalendarMonth Type
```typescript
export interface CalendarMonth {
  year: number;
  month: number;
  monthName: string;
  weeks: string[][]; // 5-6 rows of 7 date strings (empty string for padding)
}
```

### Visual Design

**Toggle UI (placed below habit header):**
```
[ Week | Month ]  <- segmented control, active has dark bg
```

**Monthly Grid:**
```
  Sun  Mon  Tue  Wed  Thu  Fri  Sat
  ---  ---  ---  ---   1    2    3
   4    5    6    7    8    9   10
  ...
```
- Completed days: colored circle with checkmark
- Incomplete days: gray outline with day number
- Future days: dimmed, disabled
