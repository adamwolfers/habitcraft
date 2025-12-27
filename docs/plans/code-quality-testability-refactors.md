# Code Quality & Testability Refactors

Extract closure-captured logic from React event handlers into pure utility functions for better testability. See `CLAUDE.md` for the pattern documentation.

## Completed

### Registration Form Validation ✓
- [x] Extracted `validateRegistrationForm()` to `utils/authUtils.ts`
- [x] Unit tests for password length and match validation

### Edit Modal Change Detection ✓
- [x] Extracted `detectHabitChanges()` to `utils/habitUtils.ts`
- [x] Extracted `buildHabitUpdatePayload()` for update payload construction
- [x] Unit tests for change detection edge cases (8 tests)

### Completion Filtering ✓
- [x] Extracted `filterCompletionsByDate()` to `utils/completionUtils.ts`
- [x] Unit tests for date filtering logic (10 tests)

### Form Reset Defaults ✓
- [x] Extracted `getDefaultHabitFormValues()` to `utils/formUtils.ts`
- [x] Used in AddHabitForm for initialization and reset

---

## Planned

### High Priority

#### HabitCard.tsx - Date Handling (lines 128-169, 223-266)
Duplicated logic in weekly and monthly calendar views.

- [ ] Extract `parseLocalDateFromString(dateString)` to `utils/dateUtils.ts`
  - Repeated date string parsing: `dateString.split('-').map(Number)`
  - Local date creation with timezone handling
- [ ] Extract `isFutureDate(date)` to `utils/dateUtils.ts`
  - Duplicated future date checking logic
  - `today.setHours(0,0,0,0)` pattern repeated twice
- [ ] Unit tests for date parsing and future date detection

#### ProfileModal.tsx - Validation (lines 23-25, 53-55, 91-95)
Email validation and form state checking inline.

- [ ] Extract `validateEmail(email)` to `utils/validationUtils.ts`
  - Email validation regex currently inline
- [ ] Extract `isValidProfileForm(name, email)` to `utils/validationUtils.ts`
  - Multi-condition form validity check
- [ ] Unit tests for email validation edge cases

#### HabitCard.tsx - Date Button Styling (lines 144-160, 241-265)
Complex className conditionals duplicated in both calendar views.

- [ ] Extract `getDateButtonClasses(isFuture, isCompleted)` to `utils/habitUtils.ts`
- [ ] Extract `getDateCircleStyle(isCompleted, color)` to `utils/habitUtils.ts`
- [ ] Unit tests for styling logic

### Medium Priority

#### Header.tsx - Click Outside Handler (lines 20-34)
Common pattern that could become a reusable hook.

- [ ] Extract `useClickOutside(ref, callback)` to `hooks/useClickOutside.ts`
- [ ] Unit tests for click detection logic

#### ProfileModal.tsx - Password Reset State (lines 78-88)
Field clearing pattern after successful password change.

- [ ] Extract `getEmptyPasswordState()` to `utils/formUtils.ts`
- [ ] Consistent pattern for form field resets

### Lower Priority

#### Header.tsx - Conditional Navigation Rendering (lines 60-89, 103-142)
Deeply nested conditionals for landing vs app navigation.

- [ ] Consider extracting `getNavigationContent(variant, isAuth)`
- [ ] May not add significant testability (JSX-heavy)
