# Plan: SMS Reminders with Configurable Frequency

**Status:** Pending
**Branch:** `feature/sms-reminders`
**Created:** 2025-12-29

## Summary

Implement SMS reminder functionality allowing users to receive periodic reminders about their habits via text message. Users can configure reminder frequency at multiple levels:

1. **Global preferences** - Master enable/disable, phone number, timezone, default reminder time
2. **Per-habit settings** - Enable/disable, frequency, and **time of day** per individual habit

**Frequency options:**
- Daily
- Every X days (2-30)
- Weekly (specific day)
- Every X weeks (2-12)
- Monthly (specific day of month)
- Every X months (2-12)

---

## Architecture Overview

### Components

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Frontend UI    │────▶│   Backend API    │────▶│   PostgreSQL    │
│ (Preferences)   │     │   (REST)         │     │   (Preferences) │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │  Reminder Worker │
                        │  (Background)    │
                        └──────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │  SMS Service     │
                        │  (AWS SNS)       │
                        └──────────────────┘
```

### Technology Choices

| Component | Recommendation | Rationale |
|-----------|----------------|-----------|
| SMS Service | AWS SNS | Fits existing AWS infrastructure (Lightsail), cost-effective, reliable delivery |
| Job Scheduler | `node-cron` + custom queue | Lightweight, no Redis dependency needed for MVP |
| Phone Verification | Custom OTP via SNS | Simple 6-digit code sent via SMS, no additional service needed |

---

## Part 1: Database Schema

### Step 1: User SMS Preferences Table

```sql
CREATE TABLE user_sms_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    reminders_enabled BOOLEAN DEFAULT false,
    phone_number VARCHAR(20),  -- E.164 format (+1234567890)
    phone_verified BOOLEAN DEFAULT false,
    phone_verification_code VARCHAR(6),
    phone_verification_expires_at TIMESTAMP WITH TIME ZONE,
    default_reminder_time TIME DEFAULT '09:00:00',  -- Default for new habit reminders
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_sms_prefs_user_id ON user_sms_preferences(user_id);
CREATE INDEX idx_user_sms_prefs_enabled ON user_sms_preferences(reminders_enabled);
CREATE INDEX idx_user_sms_prefs_phone ON user_sms_preferences(phone_number);
```

### Step 2: Habit SMS Reminder Settings Table

```sql
CREATE TABLE habit_sms_reminder_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    habit_id UUID NOT NULL UNIQUE REFERENCES habits(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT false,
    frequency_type VARCHAR(20) NOT NULL CHECK (
        frequency_type IN ('daily', 'every_x_days', 'weekly', 'every_x_weeks', 'monthly', 'every_x_months')
    ),
    frequency_value INTEGER DEFAULT 1,  -- X in "every X days/weeks/months"
    day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),  -- 0=Sunday, for weekly
    day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 31),  -- for monthly
    reminder_time TIME NOT NULL DEFAULT '09:00:00',  -- Time of day for this habit's reminder
    last_sent_at TIMESTAMP WITH TIME ZONE,
    next_send_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_habit_sms_reminder_habit_id ON habit_sms_reminder_settings(habit_id);
CREATE INDEX idx_habit_sms_reminder_enabled ON habit_sms_reminder_settings(enabled);
CREATE INDEX idx_habit_sms_reminder_next_send ON habit_sms_reminder_settings(next_send_at);
```

### Step 3: SMS Send Log Table (Audit & Debugging)

```sql
CREATE TABLE sms_send_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    habit_id UUID REFERENCES habits(id) ON DELETE SET NULL,
    sms_type VARCHAR(50) NOT NULL,  -- 'habit_reminder', 'verification', etc.
    phone_number VARCHAR(20) NOT NULL,  -- Destination number
    status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'delivered', 'failed', 'undelivered')),
    provider_message_id VARCHAR(255),
    error_code VARCHAR(50),
    error_message TEXT,
    segments_count INTEGER DEFAULT 1,  -- SMS segments used
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sms_log_user_id ON sms_send_log(user_id);
CREATE INDEX idx_sms_log_sent_at ON sms_send_log(sent_at);
CREATE INDEX idx_sms_log_status ON sms_send_log(status);
```

### Step 4: Migration File

**File:** `shared/database/migrations/005_sms_reminders.sql`

- [ ] Create up migration with all three tables
- [ ] Create down migration to rollback
- [ ] Update `schema.sql` with new tables
- [ ] Add test fixtures for SMS preferences

---

## Part 2: Backend Implementation

### Step 1: Environment Configuration

**Add to `.env.example`:**
```bash
# AWS SNS Configuration
AWS_SNS_REGION=us-east-1
AWS_SNS_ACCESS_KEY_ID=
AWS_SNS_SECRET_ACCESS_KEY=
SMS_SENDER_ID=HabitCraft  # Alphanumeric sender ID (where supported) or origination number
```

### Step 2: Install Dependencies

```bash
cd backends/node
npm install @aws-sdk/client-sns
```

### Step 3: SMS Service (TDD)

**Files:**
- `backends/node/services/smsService.js`
- `backends/node/services/smsService.test.js`

#### 3a. Write tests first
- [ ] Test: `sendSms()` calls SNS PublishCommand with correct params
- [ ] Test: `sendSms()` handles SNS errors gracefully
- [ ] Test: `sendSms()` returns message ID on success
- [ ] Test: `sendSms()` sets SMS attributes (SMSType: Transactional)
- [ ] Test: `sendHabitReminder()` generates correct SMS content
- [ ] Test: `sendHabitReminder()` includes habit name and streak info
- [ ] Test: `sendVerificationCode()` generates and sends 6-digit code
- [ ] Test: `verifyCode()` validates code and expiration
- [ ] Test: SMS content stays within 160 characters when possible

#### 3b. Implement SMS service
- [ ] Create SNS client with credentials
- [ ] Implement `sendSms()` using SNS PublishCommand
- [ ] Configure SMS attributes (Transactional type for reliability)
- [ ] Add `sendHabitReminder()` method
- [ ] Add `sendVerificationCode()` method
- [ ] Add `verifyCode()` method

### Step 4: SMS Reminder Scheduling Service (TDD)

**Files:**
- `backends/node/services/smsReminderService.js`
- `backends/node/services/smsReminderService.test.js`

#### 4a. Write tests first
- [ ] Test: `calculateNextSendTime()` for daily frequency at specific time
- [ ] Test: `calculateNextSendTime()` for every X days at specific time
- [ ] Test: `calculateNextSendTime()` for weekly (specific day) at specific time
- [ ] Test: `calculateNextSendTime()` for every X weeks at specific time
- [ ] Test: `calculateNextSendTime()` for monthly (specific day) at specific time
- [ ] Test: `calculateNextSendTime()` for every X months at specific time
- [ ] Test: `calculateNextSendTime()` handles timezone correctly with reminder_time
- [ ] Test: `calculateNextSendTime()` sets correct hour/minute from reminder_time
- [ ] Test: `getDueReminders()` returns reminders where next_send_at <= now
- [ ] Test: `processReminder()` sends SMS and updates next_send_at
- [ ] Test: `processReminder()` logs to sms_send_log
- [ ] Test: `processReminder()` skips users with unverified phone numbers

#### 4b. Implement reminder service
- [ ] Implement `calculateNextSendTime()` for all frequency types
- [ ] Implement `getDueReminders()` database query
- [ ] Implement `processReminder()` orchestration
- [ ] Implement `updateNextSendTime()` after sending

### Step 5: User SMS Preferences API (TDD)

**Files:**
- `backends/node/routes/smsPreferences.js`
- `backends/node/routes/smsPreferences.test.js`

#### Endpoints:
- `GET /api/v1/users/me/sms-preferences` - Get user's SMS preferences
- `PUT /api/v1/users/me/sms-preferences` - Update user's SMS preferences
- `POST /api/v1/users/me/sms-preferences/verify` - Send verification code
- `POST /api/v1/users/me/sms-preferences/verify/confirm` - Confirm verification code

#### 5a. Write tests first
- [ ] Test: GET returns 401 without auth
- [ ] Test: GET returns defaults for new user (reminders_enabled=false)
- [ ] Test: GET returns saved preferences (phone masked except last 4 digits)
- [ ] Test: PUT validates phone number format (E.164)
- [ ] Test: PUT validates timezone (must be valid IANA timezone)
- [ ] Test: PUT validates preferred_time format (HH:MM)
- [ ] Test: PUT updates preferences successfully
- [ ] Test: PUT creates preferences if not exist (upsert)
- [ ] Test: PUT resets phone_verified to false when phone changes
- [ ] Test: POST verify sends verification code via SMS
- [ ] Test: POST verify rate limits to 3 attempts per hour
- [ ] Test: POST verify/confirm validates code correctly
- [ ] Test: POST verify/confirm rejects expired codes
- [ ] Test: POST verify/confirm sets phone_verified to true on success
- [ ] Test: Cannot enable reminders without verified phone

#### 5b. Implement endpoints
- [ ] Add validation middleware
- [ ] Implement GET handler (mask phone number)
- [ ] Implement PUT handler with upsert logic
- [ ] Implement POST verify handler
- [ ] Implement POST verify/confirm handler

### Step 6: Habit SMS Reminder Settings API (TDD)

**Files:**
- `backends/node/routes/habitSmsReminders.js`
- `backends/node/routes/habitSmsReminders.test.js`

#### Endpoints:
- `GET /api/v1/habits/:id/sms-reminder` - Get SMS reminder settings for a habit
- `PUT /api/v1/habits/:id/sms-reminder` - Update SMS reminder settings for a habit
- `DELETE /api/v1/habits/:id/sms-reminder` - Disable/remove SMS reminder for a habit

#### 6a. Write tests first
- [ ] Test: GET returns 401 without auth
- [ ] Test: GET returns 403 for habit not owned by user
- [ ] Test: GET returns 404 for non-existent habit
- [ ] Test: GET returns null/defaults for habit without reminder
- [ ] Test: GET returns saved reminder settings
- [ ] Test: PUT validates frequency_type enum
- [ ] Test: PUT validates frequency_value range (1-30 for days, 1-12 for weeks/months)
- [ ] Test: PUT validates day_of_week for weekly (0-6)
- [ ] Test: PUT validates day_of_month for monthly (1-31)
- [ ] Test: PUT validates reminder_time format (HH:MM, 00:00-23:59)
- [ ] Test: PUT calculates and sets next_send_at based on reminder_time
- [ ] Test: PUT requires user to have reminders_enabled globally
- [ ] Test: PUT requires verified phone number
- [ ] Test: PUT defaults reminder_time to user's default_reminder_time if not provided
- [ ] Test: DELETE removes reminder settings

#### 6b. Implement endpoints
- [ ] Add validation middleware
- [ ] Implement GET handler
- [ ] Implement PUT handler with next_send_at calculation
- [ ] Implement DELETE handler

### Step 7: Background Worker

**Files:**
- `backends/node/workers/smsReminderWorker.js`
- `backends/node/workers/smsReminderWorker.test.js`

#### 7a. Write tests first
- [ ] Test: worker runs on schedule (mock node-cron)
- [ ] Test: worker processes all due reminders
- [ ] Test: worker handles SMS send failures gracefully
- [ ] Test: worker logs all operations
- [ ] Test: worker respects quiet hours (optional feature)

#### 7b. Implement worker
- [ ] Set up node-cron schedule (every 5 minutes)
- [ ] Query due reminders
- [ ] Process each reminder (send SMS, update times)
- [ ] Log results to sms_send_log

### Step 8: Delivery Status Monitoring (CloudWatch)

SNS provides delivery status logging via CloudWatch Logs rather than webhooks.

#### 8a. Configure SNS Delivery Status Logging
- [ ] Create IAM role for SNS to write to CloudWatch Logs
- [ ] Enable SMS delivery status logging in SNS console
- [ ] Configure log group: `/aws/sns/sms-delivery-logs`

#### 8b. Implement Status Sync Service (Optional)

**Files:**
- `backends/node/services/smsDeliveryStatusService.js`
- `backends/node/services/smsDeliveryStatusService.test.js`

- [ ] Test: `syncDeliveryStatus()` queries CloudWatch Logs for recent deliveries
- [ ] Test: `syncDeliveryStatus()` updates sms_send_log status
- [ ] Test: handles missing/unknown message IDs gracefully
- [ ] Implement periodic sync (every 15 minutes) to update delivery statuses
- [ ] Parse CloudWatch log entries for delivery success/failure

### Step 9: Integration Tests

**File:** `backends/node/integration/smsReminders.test.js`

- [ ] Test: Full flow - verify phone, set preferences, set reminder, verify next_send_at calculated
- [ ] Test: Worker processes reminder and updates database
- [ ] Test: Disabled global preferences prevents sending
- [ ] Test: Unverified phone prevents sending
- [ ] Test: Archived habits don't receive reminders

### Step 10: Update OpenAPI Spec

**File:** `shared/api-spec/openapi.yaml`

- [ ] Add GET/PUT /users/me/sms-preferences
- [ ] Add POST /users/me/sms-preferences/verify
- [ ] Add POST /users/me/sms-preferences/verify/confirm
- [ ] Add GET/PUT/DELETE /habits/{id}/sms-reminder
- [ ] Add request/response schemas

---

## Part 3: Frontend Implementation

### Step 1: TypeScript Types

**File:** `frontends/nextjs/types/smsPreferences.ts`

```typescript
interface UserSmsPreferences {
  remindersEnabled: boolean;
  phoneNumber: string | null;      // Masked: ***-***-1234
  phoneVerified: boolean;
  defaultReminderTime: string;     // HH:MM format, default for new habits
  timezone: string;                // IANA timezone
}

type ReminderFrequencyType =
  | 'daily'
  | 'every_x_days'
  | 'weekly'
  | 'every_x_weeks'
  | 'monthly'
  | 'every_x_months';

interface HabitSmsReminderSettings {
  enabled: boolean;
  frequencyType: ReminderFrequencyType;
  frequencyValue: number;
  dayOfWeek?: number;    // 0-6 for weekly
  dayOfMonth?: number;   // 1-31 for monthly
  reminderTime: string;  // HH:MM format, time of day for this habit
  nextSendAt?: string;   // ISO timestamp
}
```

### Step 2: API Client Methods (TDD)

**Files:**
- `frontends/nextjs/lib/api.ts`
- `frontends/nextjs/lib/api.test.ts`

#### 2a. Write tests first
- [ ] Test: `getSmsPreferences()` fetches preferences
- [ ] Test: `updateSmsPreferences()` sends PUT with correct payload
- [ ] Test: `sendSmsVerification()` sends POST to verify endpoint
- [ ] Test: `confirmSmsVerification()` sends POST with code
- [ ] Test: `getHabitSmsReminder()` fetches reminder settings
- [ ] Test: `updateHabitSmsReminder()` sends PUT with correct payload
- [ ] Test: `deleteHabitSmsReminder()` sends DELETE

#### 2b. Implement API methods
- [ ] Add all SMS preference methods
- [ ] Add verification methods
- [ ] Add all habit SMS reminder methods

### Step 3: Phone Verification Component (TDD)

**Files:**
- `frontends/nextjs/components/PhoneVerification.tsx`
- `frontends/nextjs/components/PhoneVerification.test.tsx`

#### 3a. Write tests first
- [ ] Test: renders phone input field
- [ ] Test: validates phone number format
- [ ] Test: shows "Send Code" button
- [ ] Test: shows code input after sending
- [ ] Test: shows countdown timer for resend
- [ ] Test: shows success state after verification
- [ ] Test: shows error on invalid code
- [ ] Test: handles rate limit errors

#### 3b. Implement component
- [ ] Phone number input with formatting
- [ ] Send verification code button
- [ ] 6-digit code input
- [ ] Resend cooldown timer (60 seconds)
- [ ] Success/error states

### Step 4: SMS Preferences Component (TDD)

**Files:**
- `frontends/nextjs/components/SmsPreferencesSection.tsx`
- `frontends/nextjs/components/SmsPreferencesSection.test.tsx`

#### 4a. Write tests first
- [ ] Test: renders phone verification section
- [ ] Test: renders enable/disable toggle (disabled until phone verified)
- [ ] Test: renders default time picker (disabled when reminders off)
- [ ] Test: renders timezone selector (disabled when reminders off)
- [ ] Test: toggle calls API to update preferences
- [ ] Test: shows loading state while saving
- [ ] Test: shows error on API failure
- [ ] Test: shows verified badge when phone is verified

#### 4b. Implement component
- [ ] Include PhoneVerification component
- [ ] Create toggle for reminders_enabled (requires verified phone)
- [ ] Add time picker for default_reminder_time
- [ ] Add timezone dropdown
- [ ] Handle save state and errors

### Step 5: Add SMS Preferences to ProfileModal

**Files:**
- `frontends/nextjs/components/ProfileModal.tsx`
- `frontends/nextjs/components/ProfileModal.test.tsx`

- [ ] Add "SMS Notifications" section header
- [ ] Include SmsPreferencesSection component
- [ ] Add appropriate spacing and styling

### Step 6: Habit SMS Reminder Settings Component (TDD)

**Files:**
- `frontends/nextjs/components/HabitSmsReminderSettings.tsx`
- `frontends/nextjs/components/HabitSmsReminderSettings.test.tsx`

#### 6a. Write tests first
- [ ] Test: renders enable toggle
- [ ] Test: shows frequency options when enabled
- [ ] Test: shows time-of-day picker when enabled
- [ ] Test: shows "every X days" input when that option selected
- [ ] Test: shows day picker for weekly option
- [ ] Test: shows day-of-month picker for monthly option
- [ ] Test: validates frequency_value range
- [ ] Test: validates time format (HH:MM)
- [ ] Test: disables all options if global SMS reminders off
- [ ] Test: disables all options if phone not verified
- [ ] Test: shows next reminder time when configured
- [ ] Test: saves on change
- [ ] Test: defaults to user's default_reminder_time when creating new reminder

#### 6b. Implement component
- [ ] Enable/disable toggle
- [ ] Time-of-day picker (per habit)
- [ ] Frequency type dropdown
- [ ] Conditional inputs based on frequency type
- [ ] Display next_send_at in user's timezone

### Step 7: Add SMS Reminder Settings to EditHabitModal

**Files:**
- `frontends/nextjs/components/EditHabitModal.tsx`
- `frontends/nextjs/components/EditHabitModal.test.tsx`

- [ ] Add "SMS Reminders" section/tab
- [ ] Include HabitSmsReminderSettings component
- [ ] Show message if phone not verified with link to settings
- [ ] Show message if global SMS reminders disabled with link to settings

### Step 8: E2E Tests

**File:** `frontends/nextjs/e2e/smsReminders.spec.ts`

- [ ] Test: user can add and verify phone number
- [ ] Test: user can enable SMS reminders globally
- [ ] Test: user can set default reminder time
- [ ] Test: user can set timezone
- [ ] Test: user can enable SMS reminder for a habit
- [ ] Test: user can set custom time for habit reminder
- [ ] Test: user can configure daily reminder
- [ ] Test: user can configure every X days reminder
- [ ] Test: user can configure weekly reminder
- [ ] Test: user can configure monthly reminder
- [ ] Test: user can disable reminder for a habit
- [ ] Test: new habit reminder defaults to user's default time
- [ ] Test: unverified phone disables SMS reminder controls
- [ ] Test: disabled global reminders disables habit reminder controls

---

## Part 4: SMS Message Templates

### Message Templates

**Directory:** `backends/node/templates/sms/`

#### `habitReminder.js`
```javascript
/**
 * Generate habit reminder SMS message
 * Keep under 160 characters when possible to avoid multi-segment charges
 */
function generateHabitReminderSms({ habitName, currentStreak, dashboardUrl }) {
  let message = `HabitCraft: Time for "${habitName}"!`;

  if (currentStreak > 0) {
    message += ` ${currentStreak}-day streak!`;
  }

  // Short URL for SMS
  message += ` ${dashboardUrl}`;

  return message;
}

// Example output: "HabitCraft: Time for "Morning Run"! 5-day streak! https://hc.app/d"
```

#### `verification.js`
```javascript
function generateVerificationSms({ code }) {
  return `Your HabitCraft verification code is: ${code}. Valid for 10 minutes.`;
}
```

---

## Files to Modify/Create

### Database
| File | Changes |
|------|---------|
| `shared/database/migrations/005_sms_reminders.sql` | New migration file |
| `shared/database/schema.sql` | Add new tables |
| `shared/database/test-fixtures.sql` | Add test data |

### Backend
| File | Changes |
|------|---------|
| `.env.example` | Add AWS SNS configuration |
| `backends/node/package.json` | Add @aws-sdk/client-sns |
| `backends/node/services/smsService.js` | New - SNS SMS sending service |
| `backends/node/services/smsService.test.js` | New - SMS service tests |
| `backends/node/services/smsReminderService.js` | New - reminder calculation logic |
| `backends/node/services/smsReminderService.test.js` | New - reminder service tests |
| `backends/node/services/smsDeliveryStatusService.js` | New - CloudWatch delivery status sync (optional) |
| `backends/node/services/smsDeliveryStatusService.test.js` | New - delivery status tests |
| `backends/node/routes/smsPreferences.js` | New - user preferences API |
| `backends/node/routes/smsPreferences.test.js` | New - preferences API tests |
| `backends/node/routes/habitSmsReminders.js` | New - habit reminder API |
| `backends/node/routes/habitSmsReminders.test.js` | New - habit reminder API tests |
| `backends/node/workers/smsReminderWorker.js` | New - background job processor |
| `backends/node/workers/smsReminderWorker.test.js` | New - worker tests |
| `backends/node/templates/sms/habitReminder.js` | New - SMS template |
| `backends/node/templates/sms/verification.js` | New - verification template |
| `backends/node/integration/smsReminders.test.js` | New - integration tests |
| `backends/node/app.js` | Register new routes |
| `shared/api-spec/openapi.yaml` | Add new endpoints |

### Frontend
| File | Changes |
|------|---------|
| `frontends/nextjs/types/smsPreferences.ts` | New - TypeScript types |
| `frontends/nextjs/lib/api.ts` | Add SMS/reminder API methods |
| `frontends/nextjs/lib/api.test.ts` | Add API method tests |
| `frontends/nextjs/components/PhoneVerification.tsx` | New - phone verification UI |
| `frontends/nextjs/components/PhoneVerification.test.tsx` | New - component tests |
| `frontends/nextjs/components/SmsPreferencesSection.tsx` | New - preferences UI |
| `frontends/nextjs/components/SmsPreferencesSection.test.tsx` | New - component tests |
| `frontends/nextjs/components/HabitSmsReminderSettings.tsx` | New - reminder config UI |
| `frontends/nextjs/components/HabitSmsReminderSettings.test.tsx` | New - component tests |
| `frontends/nextjs/components/ProfileModal.tsx` | Add SMS preferences section |
| `frontends/nextjs/components/ProfileModal.test.tsx` | Add new tests |
| `frontends/nextjs/components/EditHabitModal.tsx` | Add SMS reminder settings |
| `frontends/nextjs/components/EditHabitModal.test.tsx` | Add new tests |
| `frontends/nextjs/e2e/smsReminders.spec.ts` | New - E2E tests |

### Documentation
| File | Changes |
|------|---------|
| `PROJECT_PLAN.md` | Update feature checkboxes |
| `docs/plans/up-next/sms-reminders.md` | This plan file |

---

## Security Considerations

1. **Phone Number Verification (REQUIRED)**
   - Must verify phone ownership before enabling SMS reminders
   - 6-digit OTP with 10-minute expiration
   - Rate limit verification attempts (3 per hour)
   - Re-verify if phone number changes

2. **Rate Limiting**
   - Limit reminder sends per user (max 10/day)
   - Rate limit preference update endpoints
   - Rate limit verification code sends
   - Prevent SMS pumping attacks

3. **Phone Number Storage**
   - Store in E.164 format (+1234567890)
   - Mask in API responses (show last 4 digits only)
   - Never log full phone numbers

4. **Cost Control**
   - Monitor SMS costs per user
   - Set monthly SMS budget alerts
   - Consider digest mode for users with many habits

5. **Carrier Compliance**
   - Include opt-out instructions in messages
   - Maintain opt-out list in database
   - Follow TCPA/carrier guidelines
   - Note: SNS handles carrier-level opt-outs automatically

6. **AWS Security**
   - Use IAM roles with least-privilege access
   - Store credentials securely (environment variables, not code)
   - Enable CloudWatch logging for audit trail
   - Use VPC endpoints for SNS if in private subnet

7. **Data Privacy**
   - Don't log SMS content, only metadata
   - Allow users to delete all SMS preferences
   - GDPR-compliant data handling

8. **Input Validation**
   - Validate phone number format (E.164)
   - Validate timezone against IANA database
   - Validate time format strictly
   - Sanitize all user inputs

---

## Testing Strategy

### Unit Tests
- Pure functions: `calculateNextSendTime()`, message generation
- Service methods with mocked dependencies
- API route handlers with mocked database
- Phone number validation and formatting

### Integration Tests
- Full API flows with test database
- Worker processing with real database operations
- Phone verification flow

### E2E Tests
- Phone verification flows
- User preference configuration flows
- Habit reminder setup flows
- Mock SMS sending (don't send real SMS in tests)

### Manual Testing Checklist
- [ ] Add phone number, receive verification code
- [ ] Verify phone with correct code
- [ ] Reject verification with wrong code
- [ ] Enable reminders globally, set default time
- [ ] Create habit reminder using default time, verify it's applied
- [ ] Create habit reminder with custom time, verify it overrides default
- [ ] Test each frequency type with different times
- [ ] Test timezone handling (set timezone different from server)
- [ ] Test reminder for habit with streak info
- [ ] Verify SMS length stays under 160 chars when possible
- [ ] Verify CloudWatch logs show delivery status

---

## Deployment Considerations

1. **Environment Variables**
   - Add AWS SNS credentials to AWS Lightsail environment
   - Configure different AWS accounts/regions for staging vs production
   - Use SNS sandbox mode for development (requires verified numbers)

2. **AWS SNS Setup**
   - Request production access (move out of SMS sandbox)
   - Configure SMS preferences in SNS console (default sender ID, message type)
   - Set up IAM user/role with `sns:Publish` permission
   - Enable delivery status logging to CloudWatch
   - Configure spend limit to prevent runaway costs

3. **Worker Process**
   - Run SMS reminder worker alongside email worker
   - Consider AWS Lambda for scheduled SMS jobs (alternative)

4. **Monitoring**
   - Add SMS send success/failure metrics via CloudWatch
   - Set up CloudWatch alarms for delivery failures
   - Monitor `NumberOfMessagesPublished` and `NumberOfNotificationsFailed` metrics
   - Track SMS spend via AWS Cost Explorer

5. **Cost Management**
   - SMS pricing: ~$0.00645/message (US), varies by country
   - Set monthly spend limit in SNS console
   - Set up AWS Budget alerts for SMS costs
   - Consider using SNS topics for bulk sends (if needed)

---

## Future Enhancements

1. **International Numbers** - Support for non-US phone numbers with country code selection
2. **Quiet Hours** - Don't send SMS during user-defined quiet hours
3. **Two-Way SMS** - Use Amazon Pinpoint for two-way messaging (reply to mark habit complete)
4. **Carrier Lookup** - Use SNS phone number validation to detect landlines
5. **Dedicated Origination Numbers** - Purchase dedicated long codes or short codes via AWS
6. **WhatsApp Integration** - Alternative to SMS for international users (via Amazon Pinpoint)
7. **Push Notifications** - Use SNS mobile push as alternative to SMS

---

## Relationship to Email Reminders

This feature shares significant code with email reminders:

### Shared Code (Potential Refactoring)
- Frequency calculation logic (`calculateNextSendTime()`)
- Reminder scheduling database queries
- Worker scheduling infrastructure
- Timezone handling utilities

### Recommendation
After implementing both features, consider refactoring shared logic into:
- `services/reminderSchedulingService.js` - Shared scheduling logic
- `services/notificationService.js` - Abstract notification interface

This will simplify adding future notification channels (push notifications, etc.).
