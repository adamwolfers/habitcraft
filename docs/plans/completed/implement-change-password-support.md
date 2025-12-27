# Plan: Implement Change Password Support

**Status:** Complete
**Branch:** `master`
**Created:** 2025-12-26
**Completed:** 2025-12-26

## Summary

Implement full change password functionality:
1. Backend: `PUT /api/v1/users/me/password` endpoint (COMPLETE)
2. Frontend: Password change UI in profile modal (COMPLETE)

**Final test results:** 788 tests pass (243 backend + 410 frontend + 61 integration + 74 E2E)

---

## Part 1: Backend Implementation (COMPLETE)

### Backend Summary

**All backend steps completed:**
- OpenAPI spec updated: `shared/api-spec/openapi.yaml:355-462`
- Security events added: `backends/node/utils/securityLogger.js:9-10`
- Rate limiter added: `backends/node/middleware/rateLimiter.js:49-61`
- Unit tests written: 10 tests in `backends/node/routes/users.test.js:383-587`
- Endpoint implemented: `backends/node/routes/users.js:125-179`
- Integration tests written: 3 tests in `backends/node/integration/auth.test.js:657-791`
- All tests pass: 243 unit + 381 frontend + 61 integration + 70 E2E = 755 total

### Backend Steps (TDD) ✅

#### Step 1: Update OpenAPI Specification ✅
- [x] Add PUT /users/me/password endpoint to `shared/api-spec/openapi.yaml`
- [x] Define request body schema (currentPassword, newPassword, confirmPassword)
- [x] Define response schemas (200, 400, 401, 404, 429)

#### Step 2: Add Security Events ✅
- [x] Write test verifying PASSWORD_CHANGE events exist
- [x] Add `PASSWORD_CHANGE_SUCCESS` event to `securityLogger.js`
- [x] Add `PASSWORD_CHANGE_FAILURE` event to `securityLogger.js`

#### Step 3: Add Rate Limiter ✅
- [x] Write test for `passwordChangeLimiter` configuration
- [x] Add `passwordChangeLimiter` to `rateLimiter.js` (5 attempts per 15 min)
- [x] Export the new limiter

#### Step 4: Write Unit Tests ✅
- [x] Test: 401 without authentication token
- [x] Test: 400 for missing `currentPassword`
- [x] Test: 400 for missing `newPassword`
- [x] Test: 400 for `newPassword` too short (< 8 chars)
- [x] Test: 400 for `newPassword` and `confirmPassword` mismatch
- [x] Test: 401 for wrong current password
- [x] Test: 404 for user not found (edge case)
- [x] Test: 200 success with bcrypt hash verification
- [x] Test: Security event logging (success/failure)
- [x] Test: Revoke all refresh tokens after password change

#### Step 5: Implement Endpoint ✅
- [x] Add validation middleware (`changePasswordValidation`)
- [x] Add PUT /me/password route with middleware chain
- [x] Implement handler logic

#### Step 6: Run Unit Tests ✅
- [x] Run `npm test -- users.test.js` in backends/node (31 tests pass)
- [x] Run full test suite (243 tests pass)

#### Step 7: Write Integration Tests ✅
- [x] Test: Change password and login with new password
- [x] Test: Reject login with old password after change
- [x] Test: Verify refresh tokens are revoked after change

#### Step 8: Backend Verification ✅
- [x] Run all tests (`scripts/test-all.sh`)
- [x] Update PROJECT_PLAN.md backend checkboxes

---

## Part 2: Frontend Implementation (IN PROGRESS)

### Frontend Steps (TDD)

#### Step 1: Password Validation Utility ✅
**Files:** `frontends/nextjs/utils/authUtils.ts`, `frontends/nextjs/utils/authUtils.test.ts`

##### 1a. Write tests first
- [x] Test: returns null for valid password change data
- [x] Test: returns error when current password is empty
- [x] Test: returns error when new password is less than 8 characters
- [x] Test: returns error when passwords don't match

##### 1b. Implement `validatePasswordChange()`
- [x] Add function to `authUtils.ts` to make tests pass

---

#### Step 2: API Client Method ✅
**Files:** `frontends/nextjs/lib/api.ts`, `frontends/nextjs/lib/api.test.ts`

##### 2a. Write tests first
- [x] Test: calls PUT /users/me/password with correct payload
- [x] Test: handles successful response
- [x] Test: handles 401 error (wrong current password)
- [x] Test: handles other errors

##### 2b. Implement `changePassword()`
- [x] Add function to `api.ts` to make tests pass

---

#### Step 3: ProfileModal Password Fields Rendering ✅
**Files:** `frontends/nextjs/components/ProfileModal.tsx`, `frontends/nextjs/components/ProfileModal.test.tsx`

##### 3a. Write tests first
- [x] Test: renders "Change Password" section heading
- [x] Test: renders current password field
- [x] Test: renders new password field
- [x] Test: renders confirm password field
- [x] Test: renders "Change Password" button

##### 3b. Implement password fields UI
- [x] Add password section to `ProfileModal.tsx` to make tests pass

---

#### Step 4: ProfileModal Password Validation ✅
**Files:** Same as Step 3

##### 4a. Write tests first
- [x] Test: shows error for empty current password
- [x] Test: shows error for new password less than 8 chars
- [x] Test: shows error for password mismatch
- [x] Test: clears error when user types in any password field

##### 4b. Implement validation logic
- [x] Add validation handling to make tests pass

---

#### Step 5: ProfileModal Password Submission ✅
**Files:** Same as Step 3

##### 5a. Write tests first
- [x] Test: calls changePassword API on valid submission
- [x] Test: shows loading state ("Changing...") while submitting
- [x] Test: disables button while submitting
- [x] Test: clears password fields on success
- [x] Test: shows error for wrong current password (401)
- [x] Test: shows generic error for API failures

##### 5b. Implement submission logic
- [x] Add API call and state handling to make tests pass

---

#### Step 6: E2E Tests ✅
**File:** `frontends/nextjs/e2e/auth.spec.ts`

##### 6a. Write E2E tests
- [x] Test: user can change password successfully
- [x] Test: user cannot change password with wrong current password
- [x] Test: user can login with new password after change
- [x] Test: old password is rejected after change

##### 6b. Run E2E tests
- [x] Verify E2E tests pass (74 E2E tests pass)

---

#### Step 7: Update Project Documentation ✅
- [x] Update `PROJECT_PLAN.md` checkboxes (lines 143-146, 166-173)
- [x] Update this plan file status to complete
- [x] Review other docs for needed updates (none needed)

---

#### Step 8: Final Verification ✅
- [x] Run `scripts/test-all.sh` to verify all tests pass (788 tests)
- [x] Verify all PROJECT_PLAN.md checkboxes are updated

---

## Files to Modify

### Backend (Complete)
| File | Changes |
|------|---------|
| `shared/api-spec/openapi.yaml` | Add PUT /users/me/password endpoint spec |
| `backends/node/utils/securityLogger.js` | Add PASSWORD_CHANGE events |
| `backends/node/middleware/rateLimiter.js` | Add passwordChangeLimiter |
| `backends/node/routes/users.test.js` | Add unit tests |
| `backends/node/routes/users.js` | Add PUT /me/password endpoint |
| `backends/node/integration/auth.test.js` | Add integration tests |

### Frontend (In Progress)
| File | Changes |
|------|---------|
| `frontends/nextjs/utils/authUtils.ts` | Add `validatePasswordChange()` |
| `frontends/nextjs/utils/authUtils.test.ts` | Add validation tests |
| `frontends/nextjs/lib/api.ts` | Add `changePassword()` |
| `frontends/nextjs/lib/api.test.ts` | Add API tests |
| `frontends/nextjs/components/ProfileModal.tsx` | Add password change section |
| `frontends/nextjs/components/ProfileModal.test.tsx` | Add component tests |
| `frontends/nextjs/e2e/auth.spec.ts` | Add E2E tests for password change |
| `PROJECT_PLAN.md` | Check off completed items |

---

## API Specification

**Endpoint:** `PUT /api/v1/users/me/password`

**Headers:**
- `Authorization: Bearer <access_token>` or HttpOnly cookie

**Request Body:**
```json
{
  "currentPassword": "string",
  "newPassword": "string (min 8 chars)",
  "confirmPassword": "string (must match newPassword)"
}
```

**Responses:**
| Status | Description |
|--------|-------------|
| 200 | Password changed successfully |
| 400 | Validation error (missing fields, weak password, mismatch) |
| 401 | Invalid current password or missing auth |
| 404 | User not found |
| 429 | Too many requests (rate limited) |

---

## Security Considerations

- **Rate limiting:** 5 attempts per 15 minutes to prevent brute force
- **Generic errors:** "Invalid current password" to prevent timing attacks
- **Session invalidation:** All refresh tokens revoked on password change
- **Password hashing:** bcrypt with 10 salt rounds (consistent with registration)
- **Security logging:** All attempts logged for audit trail

---

## UI Design

Password change section will appear below the email field in ProfileModal:
- Separator/heading: "Change Password"
- Current Password field (type="password")
- New Password field (type="password")
- Confirm Password field (type="password")
- "Change Password" button (separate from profile save)
- Error display area for password-specific errors
- Success message on completion
