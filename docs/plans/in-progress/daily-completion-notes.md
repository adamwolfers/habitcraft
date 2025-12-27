# Plan: Daily Completion Notes

**Status:** Planned
**Branch:** TBD
**Created:** 2025-12-26

## Summary

Add support for users to capture daily completion notes for each habit. This allows users to record context, reflections, or details about their habit completion each day (e.g., "Ran 3 miles in the park" or "Meditated for 15 minutes, felt calmer").

## Current State Analysis

The backend infrastructure already exists:

1. **Database schema** (`shared/database/schema.sql:40-48`): The `completions` table has a `notes` column (TEXT, nullable)
2. **TypeScript types** (`frontends/nextjs/types/habit.ts:15-20`): `Completion` interface includes `notes: string | null`
3. **API endpoint** (`backends/node/routes/completions.js:41-99`): POST accepts optional `notes` in request body
4. **API client** (`frontends/nextjs/lib/api.ts:205-231`): `createCompletion()` accepts optional `notes` parameter

**What's missing:** Frontend UI to capture, display, and edit notes.

---

## Implementation Approach

Two UX options for capturing notes:

### Option A: Inline Note Icon (Recommended)
- Add a small note icon next to each completion button
- Clicking the icon opens a modal/popover to add/edit notes
- Completed days with notes show a visual indicator

### Option B: Long-Press/Right-Click
- Long-press or right-click on a day opens a notes modal
- Less discoverable but cleaner UI

**Recommendation:** Option A for better discoverability. Users can see at a glance which days have notes.

---

## Implementation Steps (TDD)

### Part 1: Note Modal Component

#### Step 1: Create CompletionNoteModal Component Tests
**Files:** `frontends/nextjs/components/CompletionNoteModal.test.tsx`

- [ ] Test: renders modal with habit name and date in header
- [ ] Test: renders textarea for note input
- [ ] Test: renders Save and Cancel buttons
- [ ] Test: populates textarea with existing note when provided
- [ ] Test: calls onSave with note text when Save clicked
- [ ] Test: calls onClose when Cancel clicked
- [ ] Test: calls onClose when clicking outside modal
- [ ] Test: clears note when Delete Note button clicked (for existing notes)
- [ ] Test: disables Save button when note is empty (for new notes)
- [ ] Test: limits note to 500 characters

#### Step 2: Implement CompletionNoteModal Component
**Files:** `frontends/nextjs/components/CompletionNoteModal.tsx`

- [ ] Create modal component with props: `habitName`, `date`, `existingNote`, `onSave`, `onClose`
- [ ] Add textarea with character count
- [ ] Add Save, Cancel, and Delete (if existing note) buttons
- [ ] Style consistent with existing modals (see `HabitModal.tsx`)

---

### Part 2: Update Completion API to Support Note Updates

#### Step 3: Add PUT Endpoint for Updating Notes (Backend)
**Files:** `backends/node/routes/completions.js`, `backends/node/routes/completions.test.js`

##### 3a. Write backend unit tests
- [ ] Test: 401 without authentication
- [ ] Test: 400 for invalid date format
- [ ] Test: 404 when completion doesn't exist
- [ ] Test: 403 when habit doesn't belong to user
- [ ] Test: 200 successfully updates note
- [ ] Test: 200 clears note when null passed

##### 3b. Implement PUT /habits/:habitId/completions/:date endpoint
- [ ] Add PUT route handler
- [ ] Validate ownership and date
- [ ] Update notes column in database

##### 3c. Update OpenAPI spec
**Files:** `shared/api-spec/openapi.yaml`
- [ ] Add PUT /habits/{habitId}/completions/{date} endpoint spec

#### Step 4: Add API Client Method for Updating Notes
**Files:** `frontends/nextjs/lib/api.ts`, `frontends/nextjs/lib/api.test.ts`

##### 4a. Write API client tests
- [ ] Test: calls PUT with correct payload
- [ ] Test: handles success response
- [ ] Test: handles error responses

##### 4b. Implement `updateCompletionNote()` function
- [ ] Add function to `api.ts`

---

### Part 3: Integrate Notes into HabitCard

#### Step 5: Add Note Indicator to HabitCard
**Files:** `frontends/nextjs/components/HabitCard.tsx`, `frontends/nextjs/components/HabitCard.test.tsx`

##### 5a. Write tests
- [ ] Test: renders note icon for completed days
- [ ] Test: note icon shows filled state when note exists
- [ ] Test: note icon shows empty state when no note
- [ ] Test: clicking note icon calls onOpenNoteModal with habitId and date

##### 5b. Update HabitCard component
- [ ] Add note icon next to each completed day button
- [ ] Pass `completions` array as prop (currently only passes check function)
- [ ] Show visual indicator when note exists (e.g., filled vs outline icon)
- [ ] Add `onOpenNoteModal` callback prop

---

### Part 4: Update useHabits Hook

#### Step 6: Add Note Management to useHabits
**Files:** `frontends/nextjs/hooks/useHabits.ts`, `frontends/nextjs/hooks/useHabits.test.ts`

##### 6a. Write tests
- [ ] Test: `saveNote` creates completion with note when not already complete
- [ ] Test: `saveNote` updates existing completion note
- [ ] Test: `deleteNote` removes note from completion
- [ ] Test: `getCompletionNote` returns note for habit/date
- [ ] Test: local state updates after save/delete

##### 6b. Implement hook methods
- [ ] Add `saveNote(habitId, date, note)` method
- [ ] Add `deleteNote(habitId, date)` method
- [ ] Add `getCompletionNote(habitId, date)` method
- [ ] Handle case where completion doesn't exist yet (create with note)

---

### Part 5: Wire Up Dashboard

#### Step 7: Integrate Modal into Dashboard
**Files:** `frontends/nextjs/app/dashboard/page.tsx`, `frontends/nextjs/app/dashboard/page.test.tsx`

##### 7a. Write tests
- [ ] Test: opens note modal when onOpenNoteModal called
- [ ] Test: modal shows correct habit name and date
- [ ] Test: modal shows existing note when present
- [ ] Test: saving note updates completion
- [ ] Test: closing modal clears modal state

##### 7b. Update dashboard page
- [ ] Add modal state: `noteModalData: { habitId, date } | null`
- [ ] Add `handleOpenNoteModal` callback
- [ ] Add `handleSaveNote` callback
- [ ] Render `CompletionNoteModal` when modal state is set

---

### Part 6: E2E Tests

#### Step 8: Add E2E Tests for Notes
**Files:** `frontends/nextjs/e2e/completion-notes.spec.ts`

- [ ] Test: user can add a note to a completed habit
- [ ] Test: user can edit an existing note
- [ ] Test: user can delete a note
- [ ] Test: note indicator shows for days with notes
- [ ] Test: adding note to incomplete day also marks it complete
- [ ] Test: note persists after page refresh

---

### Part 7: Documentation and Cleanup

#### Step 9: Update Documentation
- [ ] Update `GETTING_STARTED.md` if user-facing docs needed
- [ ] Update this plan file status to Complete
- [ ] Check `PROJECT_PLAN.md` for relevant checkboxes

#### Step 10: Final Verification
- [ ] Run `scripts/test-all.sh` to verify all tests pass
- [ ] Manual testing of note workflow

---

## Files to Modify/Create

### New Files
| File | Purpose |
|------|---------|
| `frontends/nextjs/components/CompletionNoteModal.tsx` | Modal component for adding/editing notes |
| `frontends/nextjs/components/CompletionNoteModal.test.tsx` | Unit tests for modal |
| `frontends/nextjs/e2e/completion-notes.spec.ts` | E2E tests for notes feature |

### Modified Files
| File | Changes |
|------|---------|
| `backends/node/routes/completions.js` | Add PUT endpoint for updating notes |
| `backends/node/routes/completions.test.js` | Add tests for PUT endpoint |
| `shared/api-spec/openapi.yaml` | Add PUT endpoint spec |
| `frontends/nextjs/lib/api.ts` | Add `updateCompletionNote()` function |
| `frontends/nextjs/lib/api.test.ts` | Add tests for new API function |
| `frontends/nextjs/components/HabitCard.tsx` | Add note icon indicator |
| `frontends/nextjs/components/HabitCard.test.tsx` | Add tests for note icon |
| `frontends/nextjs/hooks/useHabits.ts` | Add note management methods |
| `frontends/nextjs/hooks/useHabits.test.ts` | Add tests for note methods |
| `frontends/nextjs/app/dashboard/page.tsx` | Wire up note modal |
| `frontends/nextjs/app/dashboard/page.test.tsx` | Add tests for modal integration |

---

## API Specification

### Existing Endpoint (No Changes)
**POST /api/v1/habits/:habitId/completions**
- Already accepts optional `notes` field in body

### New Endpoint
**PUT /api/v1/habits/:habitId/completions/:date**

**Headers:**
- `Authorization: Bearer <access_token>` or HttpOnly cookie

**Request Body:**
```json
{
  "notes": "string | null"
}
```

**Responses:**
| Status | Description |
|--------|-------------|
| 200 | Note updated successfully |
| 400 | Invalid date format |
| 401 | Not authenticated |
| 403 | Habit doesn't belong to user |
| 404 | Completion not found |

**Response Body (200):**
```json
{
  "id": "uuid",
  "habitId": "uuid",
  "date": "YYYY-MM-DD",
  "notes": "string | null",
  "createdAt": "ISO timestamp"
}
```

---

## UI Design

### Note Icon on HabitCard
- Small icon (16x16px) positioned near each day button
- Two states:
  - **Empty:** Outline icon, lower opacity (no note)
  - **Filled:** Solid icon, full opacity (has note)
- Tooltip: "Add note" or "View note"

### CompletionNoteModal
```
┌─────────────────────────────────────┐
│  ✕  Add Note                        │
│      Exercise • Dec 25, 2025        │
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐  │
│  │                               │  │
│  │  [Textarea for note]          │  │
│  │                               │  │
│  │                               │  │
│  └───────────────────────────────┘  │
│                          0/500      │
├─────────────────────────────────────┤
│  [Delete]           [Cancel] [Save] │
└─────────────────────────────────────┘
```

---

## Considerations

### Edge Cases
1. **Adding note to incomplete day:** Should also mark the habit complete
2. **Deleting note vs. deleting completion:** Deleting note keeps the completion
3. **Uncompleting a day with a note:** Should warn user that note will be lost

### Future Enhancements (Out of Scope)
- Search/filter completions by note content
- Export notes as journal/log
- Markdown support in notes
- Photo attachments

---

## Testing Strategy

Following project conventions from `CLAUDE.md`:
1. Write unit tests before implementation (TDD)
2. Extract testable utility functions where needed
3. Target >90% coverage
4. Run `scripts/test-all.sh` before committing
