# Plan: Weekly/Monthly View Toggle for HabitCard

**Status:** In Progress
**Branch:** `feature/habit-view-toggle`
**Created:** 2025-12-25

## Summary

Add a per-habit toggle to switch between weekly view (current 7-day row) and monthly view (traditional 7x5 calendar grid).

## Implementation Steps (TDD)

### Step 1: Add `getCalendarMonth` utility
- [ ] Write tests in `frontends/nextjs/utils/dateUtils.test.ts`
- [ ] Implement `getCalendarMonth()` in `frontends/nextjs/utils/dateUtils.ts`
- [ ] Commit: "Add getCalendarMonth utility function with tests"

### Step 2: Add view toggle UI to HabitCard
- [ ] Write tests in `frontends/nextjs/components/HabitCard.test.tsx`
- [ ] Add `viewMode` state and toggle UI in `HabitCard.tsx`
- [ ] Commit: "Add weekly/monthly view toggle to HabitCard"

### Step 3: Implement monthly calendar grid
- [ ] Write tests for monthly grid layout
- [ ] Add `monthOffset` state and 7-column calendar grid
- [ ] Commit: "Add monthly calendar grid view"

### Step 4: Add month navigation
- [ ] Write tests for month navigation
- [ ] Add previous/next/current month buttons
- [ ] Commit: "Add month navigation for monthly view"

### Step 5: Wire up completion toggling
- [ ] Write tests for completion toggling in monthly view
- [ ] Wire onClick handlers for day cells
- [ ] Commit: "Wire up completion toggling in monthly view"

### Step 6: Final polish
- [ ] Run `scripts/test-all.sh` and fix any issues
- [ ] Commit: "Complete weekly/monthly view toggle feature"

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
