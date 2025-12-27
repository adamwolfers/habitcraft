# Plan: Email Reminders with Configurable Frequency

**Status:** Pending
**Branch:** `feature/email-reminders`
**Created:** 2025-12-26

## Summary

Implement email reminder functionality allowing users to receive periodic reminders about their habits. Users can configure reminder frequency at multiple levels:

1. **Global preferences** - Master enable/disable, timezone, default reminder time
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
                        │  Email Service   │
                        │  (SendGrid/SES)  │
                        └──────────────────┘
```

### Technology Choices

| Component | Recommendation | Rationale |
|-----------|----------------|-----------|
| Email Service | SendGrid or AWS SES | Both work well; SES fits AWS infrastructure, SendGrid has better dev experience |
| Job Scheduler | `node-cron` + custom queue | Lightweight, no Redis dependency needed for MVP |
| Email Templates | Handlebars or inline HTML | Simple, maintainable email templates |

---

## Part 1: Database Schema

### Step 1: User Email Preferences Table

```sql
CREATE TABLE user_email_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    reminders_enabled BOOLEAN DEFAULT false,
    default_reminder_time TIME DEFAULT '09:00:00',  -- Default for new habit reminders
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_email_prefs_user_id ON user_email_preferences(user_id);
CREATE INDEX idx_user_email_prefs_enabled ON user_email_preferences(reminders_enabled);
```

### Step 2: Habit Reminder Settings Table

```sql
CREATE TABLE habit_reminder_settings (
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

CREATE INDEX idx_habit_reminder_habit_id ON habit_reminder_settings(habit_id);
CREATE INDEX idx_habit_reminder_enabled ON habit_reminder_settings(enabled);
CREATE INDEX idx_habit_reminder_next_send ON habit_reminder_settings(next_send_at);
```

### Step 3: Email Send Log Table (Audit & Debugging)

```sql
CREATE TABLE email_send_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    habit_id UUID REFERENCES habits(id) ON DELETE SET NULL,
    email_type VARCHAR(50) NOT NULL,  -- 'habit_reminder', 'weekly_summary', etc.
    status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'failed', 'bounced')),
    provider_message_id VARCHAR(255),
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_email_log_user_id ON email_send_log(user_id);
CREATE INDEX idx_email_log_sent_at ON email_send_log(sent_at);
```

### Step 4: Migration File

**File:** `shared/database/migrations/004_email_reminders.sql`

- [ ] Create up migration with all three tables
- [ ] Create down migration to rollback
- [ ] Update `schema.sql` with new tables
- [ ] Add test fixtures for email preferences

---

## Part 2: Backend Implementation

### Step 1: Environment Configuration

**Add to `.env.example`:**
```bash
# Email Service (choose one provider)
EMAIL_PROVIDER=sendgrid  # or 'ses' or 'smtp'
EMAIL_FROM=reminders@habitcraft.org
EMAIL_FROM_NAME=HabitCraft

# SendGrid
SENDGRID_API_KEY=

# AWS SES (if using SES)
AWS_SES_REGION=us-east-1
AWS_SES_ACCESS_KEY_ID=
AWS_SES_SECRET_ACCESS_KEY=

# SMTP (fallback/dev)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
```

### Step 2: Install Dependencies

```bash
cd backends/node
npm install @sendgrid/mail node-cron handlebars
npm install --save-dev @types/node-cron
```

### Step 3: Email Service (TDD)

**Files:**
- `backends/node/services/emailService.js`
- `backends/node/services/emailService.test.js`

#### 3a. Write tests first
- [ ] Test: `sendEmail()` calls SendGrid API with correct params
- [ ] Test: `sendEmail()` handles SendGrid errors gracefully
- [ ] Test: `sendEmail()` returns message ID on success
- [ ] Test: `sendHabitReminder()` generates correct email content
- [ ] Test: `sendHabitReminder()` includes habit name and streak info
- [ ] Test: email templates render correctly with Handlebars

#### 3b. Implement email service
- [ ] Create abstract email interface
- [ ] Implement SendGrid provider
- [ ] Implement email template system
- [ ] Add `sendHabitReminder()` method

### Step 4: Reminder Scheduling Service (TDD)

**Files:**
- `backends/node/services/reminderService.js`
- `backends/node/services/reminderService.test.js`

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
- [ ] Test: `processReminder()` sends email and updates next_send_at
- [ ] Test: `processReminder()` logs to email_send_log

#### 4b. Implement reminder service
- [ ] Implement `calculateNextSendTime()` for all frequency types
- [ ] Implement `getDueReminders()` database query
- [ ] Implement `processReminder()` orchestration
- [ ] Implement `updateNextSendTime()` after sending

### Step 5: User Email Preferences API (TDD)

**Files:**
- `backends/node/routes/emailPreferences.js`
- `backends/node/routes/emailPreferences.test.js`

#### Endpoints:
- `GET /api/v1/users/me/email-preferences` - Get user's email preferences
- `PUT /api/v1/users/me/email-preferences` - Update user's email preferences

#### 5a. Write tests first
- [ ] Test: GET returns 401 without auth
- [ ] Test: GET returns defaults for new user (reminders_enabled=false)
- [ ] Test: GET returns saved preferences
- [ ] Test: PUT validates timezone (must be valid IANA timezone)
- [ ] Test: PUT validates preferred_time format (HH:MM)
- [ ] Test: PUT updates preferences successfully
- [ ] Test: PUT creates preferences if not exist (upsert)

#### 5b. Implement endpoints
- [ ] Add validation middleware
- [ ] Implement GET handler
- [ ] Implement PUT handler with upsert logic

### Step 6: Habit Reminder Settings API (TDD)

**Files:**
- `backends/node/routes/habitReminders.js`
- `backends/node/routes/habitReminders.test.js`

#### Endpoints:
- `GET /api/v1/habits/:id/reminder` - Get reminder settings for a habit
- `PUT /api/v1/habits/:id/reminder` - Update reminder settings for a habit
- `DELETE /api/v1/habits/:id/reminder` - Disable/remove reminder for a habit

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
- [ ] Test: PUT defaults reminder_time to user's default_reminder_time if not provided
- [ ] Test: DELETE removes reminder settings

#### 6b. Implement endpoints
- [ ] Add validation middleware
- [ ] Implement GET handler
- [ ] Implement PUT handler with next_send_at calculation
- [ ] Implement DELETE handler

### Step 7: Background Worker

**Files:**
- `backends/node/workers/reminderWorker.js`
- `backends/node/workers/reminderWorker.test.js`

#### 7a. Write tests first
- [ ] Test: worker runs on schedule (mock node-cron)
- [ ] Test: worker processes all due reminders
- [ ] Test: worker handles email send failures gracefully
- [ ] Test: worker logs all operations

#### 7b. Implement worker
- [ ] Set up node-cron schedule (every 5 minutes)
- [ ] Query due reminders
- [ ] Process each reminder (send email, update times)
- [ ] Log results to email_send_log

### Step 8: Integration Tests

**File:** `backends/node/integration/emailReminders.test.js`

- [ ] Test: Full flow - set preferences, set reminder, verify next_send_at calculated
- [ ] Test: Worker processes reminder and updates database
- [ ] Test: Disabled global preferences prevents sending
- [ ] Test: Archived habits don't receive reminders

### Step 9: Update OpenAPI Spec

**File:** `shared/api-spec/openapi.yaml`

- [ ] Add GET/PUT /users/me/email-preferences
- [ ] Add GET/PUT/DELETE /habits/{id}/reminder
- [ ] Add request/response schemas

---

## Part 3: Frontend Implementation

### Step 1: TypeScript Types

**File:** `frontends/nextjs/types/emailPreferences.ts`

```typescript
interface UserEmailPreferences {
  remindersEnabled: boolean;
  defaultReminderTime: string;  // HH:MM format, default for new habits
  timezone: string;             // IANA timezone
}

type ReminderFrequencyType =
  | 'daily'
  | 'every_x_days'
  | 'weekly'
  | 'every_x_weeks'
  | 'monthly'
  | 'every_x_months';

interface HabitReminderSettings {
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
- [ ] Test: `getEmailPreferences()` fetches preferences
- [ ] Test: `updateEmailPreferences()` sends PUT with correct payload
- [ ] Test: `getHabitReminder()` fetches reminder settings
- [ ] Test: `updateHabitReminder()` sends PUT with correct payload
- [ ] Test: `deleteHabitReminder()` sends DELETE

#### 2b. Implement API methods
- [ ] Add all email preference methods
- [ ] Add all habit reminder methods

### Step 3: Email Preferences Component (TDD)

**Files:**
- `frontends/nextjs/components/EmailPreferencesSection.tsx`
- `frontends/nextjs/components/EmailPreferencesSection.test.tsx`

#### 3a. Write tests first
- [ ] Test: renders enable/disable toggle
- [ ] Test: renders default time picker (disabled when reminders off)
- [ ] Test: renders timezone selector (disabled when reminders off)
- [ ] Test: toggle calls API to update preferences
- [ ] Test: shows loading state while saving
- [ ] Test: shows error on API failure

#### 3b. Implement component
- [ ] Create toggle for reminders_enabled
- [ ] Add time picker for default_reminder_time (used for new habit reminders)
- [ ] Add timezone dropdown (common timezones)
- [ ] Handle save state and errors

### Step 4: Add Email Preferences to ProfileModal

**Files:**
- `frontends/nextjs/components/ProfileModal.tsx`
- `frontends/nextjs/components/ProfileModal.test.tsx`

- [ ] Add "Email Notifications" section header
- [ ] Include EmailPreferencesSection component
- [ ] Add appropriate spacing and styling

### Step 5: Habit Reminder Settings Component (TDD)

**Files:**
- `frontends/nextjs/components/HabitReminderSettings.tsx`
- `frontends/nextjs/components/HabitReminderSettings.test.tsx`

#### 5a. Write tests first
- [ ] Test: renders enable toggle
- [ ] Test: shows frequency options when enabled
- [ ] Test: shows time-of-day picker when enabled
- [ ] Test: shows "every X days" input when that option selected
- [ ] Test: shows day picker for weekly option
- [ ] Test: shows day-of-month picker for monthly option
- [ ] Test: validates frequency_value range
- [ ] Test: validates time format (HH:MM)
- [ ] Test: disables all options if global reminders off
- [ ] Test: shows next reminder time when configured
- [ ] Test: saves on change
- [ ] Test: defaults to user's default_reminder_time when creating new reminder

#### 5b. Implement component
- [ ] Enable/disable toggle
- [ ] Time-of-day picker (per habit)
- [ ] Frequency type dropdown
- [ ] Conditional inputs based on frequency type
- [ ] Display next_send_at in user's timezone

### Step 6: Add Reminder Settings to EditHabitModal

**Files:**
- `frontends/nextjs/components/EditHabitModal.tsx`
- `frontends/nextjs/components/EditHabitModal.test.tsx`

- [ ] Add "Reminders" section/tab
- [ ] Include HabitReminderSettings component
- [ ] Show message if global reminders disabled with link to settings

### Step 7: E2E Tests

**File:** `frontends/nextjs/e2e/emailReminders.spec.ts`

- [ ] Test: user can enable email reminders globally
- [ ] Test: user can set default reminder time
- [ ] Test: user can set timezone
- [ ] Test: user can enable reminder for a habit
- [ ] Test: user can set custom time for habit reminder
- [ ] Test: user can configure daily reminder
- [ ] Test: user can configure every X days reminder
- [ ] Test: user can configure weekly reminder
- [ ] Test: user can configure monthly reminder
- [ ] Test: user can disable reminder for a habit
- [ ] Test: new habit reminder defaults to user's default time
- [ ] Test: disabled global reminders disables habit reminder controls

---

## Part 4: Email Templates

### Template Files

**Directory:** `backends/node/templates/emails/`

#### `habitReminder.hbs`
```handlebars
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Habit Reminder</title>
</head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #3B82F6;">{{icon}} {{habitName}}</h1>

  <p>Hi {{userName}},</p>

  <p>This is your reminder to work on <strong>{{habitName}}</strong>.</p>

  {{#if currentStreak}}
  <p>You're on a <strong>{{currentStreak}} day streak</strong>! Keep it going!</p>
  {{/if}}

  <p>
    <a href="{{dashboardUrl}}" style="background: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
      Mark as Complete
    </a>
  </p>

  <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">

  <p style="color: #6b7280; font-size: 14px;">
    <a href="{{preferencesUrl}}">Manage notification preferences</a>
  </p>
</body>
</html>
```

---

## Files to Modify/Create

### Database
| File | Changes |
|------|---------|
| `shared/database/migrations/004_email_reminders.sql` | New migration file |
| `shared/database/schema.sql` | Add new tables |
| `shared/database/test-fixtures.sql` | Add test data |

### Backend
| File | Changes |
|------|---------|
| `.env.example` | Add email service configuration |
| `backends/node/package.json` | Add @sendgrid/mail, node-cron, handlebars |
| `backends/node/services/emailService.js` | New - email sending abstraction |
| `backends/node/services/emailService.test.js` | New - email service tests |
| `backends/node/services/reminderService.js` | New - reminder calculation logic |
| `backends/node/services/reminderService.test.js` | New - reminder service tests |
| `backends/node/routes/emailPreferences.js` | New - user preferences API |
| `backends/node/routes/emailPreferences.test.js` | New - preferences API tests |
| `backends/node/routes/habitReminders.js` | New - habit reminder API |
| `backends/node/routes/habitReminders.test.js` | New - habit reminder API tests |
| `backends/node/workers/reminderWorker.js` | New - background job processor |
| `backends/node/workers/reminderWorker.test.js` | New - worker tests |
| `backends/node/templates/emails/habitReminder.hbs` | New - email template |
| `backends/node/integration/emailReminders.test.js` | New - integration tests |
| `backends/node/app.js` | Register new routes |
| `shared/api-spec/openapi.yaml` | Add new endpoints |

### Frontend
| File | Changes |
|------|---------|
| `frontends/nextjs/types/emailPreferences.ts` | New - TypeScript types |
| `frontends/nextjs/lib/api.ts` | Add email/reminder API methods |
| `frontends/nextjs/lib/api.test.ts` | Add API method tests |
| `frontends/nextjs/components/EmailPreferencesSection.tsx` | New - preferences UI |
| `frontends/nextjs/components/EmailPreferencesSection.test.tsx` | New - component tests |
| `frontends/nextjs/components/HabitReminderSettings.tsx` | New - reminder config UI |
| `frontends/nextjs/components/HabitReminderSettings.test.tsx` | New - component tests |
| `frontends/nextjs/components/ProfileModal.tsx` | Add email preferences section |
| `frontends/nextjs/components/ProfileModal.test.tsx` | Add new tests |
| `frontends/nextjs/components/EditHabitModal.tsx` | Add reminder settings |
| `frontends/nextjs/components/EditHabitModal.test.tsx` | Add new tests |
| `frontends/nextjs/e2e/emailReminders.spec.ts` | New - E2E tests |

### Documentation
| File | Changes |
|------|---------|
| `PROJECT_PLAN.md` | Update feature checkboxes |
| `docs/plans/email-reminders.md` | This plan file |

---

## Security Considerations

1. **Rate Limiting**
   - Limit reminder sends per user (max 10/day)
   - Rate limit preference update endpoints
   - Prevent abuse of email system

2. **Email Verification** (Future Enhancement)
   - Before enabling reminders, verify email ownership
   - Add email verification flow as prerequisite

3. **Unsubscribe Mechanism**
   - Include one-click unsubscribe link in all emails
   - Handle unsubscribe webhook from email provider

4. **Data Privacy**
   - Don't log email content, only metadata
   - Allow users to delete all email preferences
   - GDPR-compliant data handling

5. **Error Handling**
   - Generic errors to users ("Unable to send reminder")
   - Detailed logging for debugging (without PII)
   - Exponential backoff for failed sends

6. **Input Validation**
   - Validate timezone against IANA database
   - Validate time format strictly
   - Sanitize all user inputs (existing XSS protection applies)

---

## Testing Strategy

### Unit Tests
- Pure functions: `calculateNextSendTime()`, template rendering
- Service methods with mocked dependencies
- API route handlers with mocked database

### Integration Tests
- Full API flows with test database
- Worker processing with real database operations

### E2E Tests
- User preference configuration flows
- Habit reminder setup flows
- Mock email sending (don't send real emails in tests)

### Manual Testing Checklist
- [ ] Enable reminders globally, set default time
- [ ] Create habit reminder using default time, verify it's applied
- [ ] Create habit reminder with custom time, verify it overrides default
- [ ] Test each frequency type with different times
- [ ] Test timezone handling (set timezone different from server, verify correct local time)
- [ ] Test reminder for habit with streak info
- [ ] Test unsubscribe link works
- [ ] Test email renders correctly in major email clients (Gmail, Outlook, Apple Mail)

---

## Deployment Considerations

1. **Environment Variables**
   - Add email service credentials to AWS Lightsail environment
   - Configure different email settings for staging vs production

2. **Worker Process**
   - Run reminder worker as separate process or within main app
   - Consider AWS Lambda for scheduled email jobs (alternative)

3. **Email Service Setup**
   - Verify domain for sending (SPF, DKIM, DMARC)
   - Set up bounce/complaint handling
   - Configure email templates in provider dashboard (optional)

4. **Monitoring**
   - Add email send success/failure metrics
   - Alert on high bounce/complaint rates
   - Monitor worker job queue depth

---

## Future Enhancements

1. **Weekly/Monthly Summary Emails** - Aggregate progress reports
2. **Email Verification** - Verify email before enabling reminders
3. **SMS Reminders** - Alternative notification channel
4. **Push Notifications** - Browser/mobile push support
5. **Smart Scheduling** - ML-based optimal reminder timing
6. **Digest Mode** - Single email for multiple habits
