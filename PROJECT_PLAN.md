# HabitCraft - Project Plan

## Project Vision

HabitCraft is a full-stack habit tracking application demonstrating modern web development practices with Test-Driven Development (TDD) and comprehensive testing.

## Technology Stack

- **Frontend:** Next.js with React, TypeScript, Tailwind CSS
- **Backend:** Node.js with Express, JavaScript
- **Database:** PostgreSQL 14+
- **Testing:** Jest + Supertest (Backend), Jest + React Testing Library (Frontend), Playwright (E2E)
- **Deployment:** Docker Compose (dev), Lightsail Containers + RDS on AWS (prod)

## Version 1.0 Goals

**Core Features:**

1. User registration and JWT authentication
2. Full habit CRUD operations with UI support
3. Completion tracking with calendar view
4. Comprehensive automated test coverage

---

## Work Stream for v1.0

### Infrastructure & Setup

- [x] Project scaffolding with Docker Compose orchestration
- [x] PostgreSQL database (schema for users, habits, completions)
- [x] Seed data with demo users and Adminer for database administration

### Backend - Node.js + Express

#### Foundation

- [x] Express app with Jest + Supertest testing
- [x] Database connection pool, CORS support, environment variable configuration

#### Authentication & Authorization

- [x] **Registration/Login** - Bcrypt password hashing (10 rounds), JWT access tokens (15 min) and refresh tokens (7 days), generic error messages to prevent user enumeration
- [x] **JWT Middleware** - Token validation, request user attachment, protected route enforcement
- [x] **Token Refresh** - Secure refresh token rotation with database-backed revocation
- [x] **HttpOnly Cookies** - Secure token storage (no localStorage), CORS credentials support, logout endpoint

#### Habit Management

- [x] Full CRUD API (`/api/v1/habits`) with validation, status filtering, ownership enforcement, and user isolation

#### Completion Tracking

- [x] Completion API (`/api/v1/habits/:habitId/completions`) with date validation, future date prevention, duplicate prevention (409), and date range filtering

#### User Management

- [x] RESTful user endpoints (`/api/v1/users/me`) for profile updates (name, email) and password change
- [x] Frontend Profile Modal with edit capabilities, loading states, and error handling

### Frontend - Next.js + React

#### Foundation

- [x] Next.js 14 with TypeScript, Tailwind CSS, Jest + React Testing Library

#### Authentication & Authorization

- [x] **AuthContext** - User state management, cookie-based auth, isLoading/isAuthenticated flags
- [x] **Custom Hooks** - `useAuth()` for context access, `useRequireAuth()` for protected route redirects
- [x] **API Client** - 401 interception, automatic token refresh, request retry
- [x] **Login/Registration Pages** - Form validation, error handling, auto-redirect for authenticated users
- [x] **Protected Routes** - ProtectedRoute wrapper with loading states and redirect logic
- [x] **Logout** - Header component with logout button, cookie clearing, redirect to login

#### API Integration

- [x] Typed API client (`lib/api.ts`) with full CRUD operations for habits and completions

#### State Management

- [x] `useHabits` hook managing habit fetching, CRUD operations, completion toggling, and optimistic UI updates

#### UI Components

- [x] **Dashboard** - Habit list display, create form, loading/empty states
- [x] **AddHabitForm** - Validated form with name, frequency, color, and icon selector (24 preset emojis)
- [x] **HabitCard** - Calendar week/month view, week navigation, completion bubbles, color-coded indicators, "Today" button
- [x] **EditHabitModal** - Edit title, description, color, and icon with validation and error handling
- [x] **Date Utilities** - `getCalendarWeek()` and `getCalendarMonth()` functions with timezone handling

### Acceptance Testing

#### Test Infrastructure

- [x] **Test Database** - Separate Docker container (port 5433), same schema as production
- [x] **Setup Scripts** - `test-db-start.sh`, `test-db-stop.sh`, `test-db-reset.sh`, `test-db-fresh.sh`
- [x] **Test Fixtures** - Two test users with predictable UUIDs, sample habits, and completions
- [x] **E2E Framework** - Playwright with global setup/teardown, multiple run modes

#### Backend Integration Tests

- [x] Authentication flows, habit CRUD with user isolation, cascading deletes, completion tracking with duplicate prevention

#### Frontend E2E Tests (Playwright)

- [x] 50 E2E tests covering authentication, habit management, and completion tracking
- [x] **Test Isolation** - Fixture users are read-only; data-modifying tests create unique entities with timestamps

### Documentation

- [x] **README.md** - v1 features, current tech stack, removed polyglot references
- [x] **GETTING_STARTED.md** - JWT auth setup, quick start instructions
- [x] **OpenAPI Spec** - Complete API documentation with auth endpoints and examples
- [x] **Backend/Frontend READMEs** - Current endpoints, component structure, test examples
- [x] **AWS Architecture** (`docs/AWS_ARCHITECTURE.md`) - Lightsail + RDS setup, CI/CD, security checklist, backup procedures
- [ ] **User Guide** - Registration, habit management, troubleshooting

### Security & Deployment

#### Security Hardening

- [x] **Rate Limiting** - express-rate-limit on auth endpoints
- [x] **Input Sanitization** - XSS prevention with xss library, parameterized SQL queries
- [x] **CORS** - Specific origin configuration via FRONTEND_URL env var
- [x] **Security Headers** - helmet.js (CSP, HSTS, etc.)
- [x] **Token Security** - Refresh token rotation, database-backed revocation, unique JTI claims
- [x] **Security Audit** - OWASP Top 10 review, environment variable security, token expiration testing

#### Production Configuration

- [x] **Dockerfiles** - Production-optimized with health checks and standalone output
- [x] **AWS Lightsail** - Frontend + Backend containers, RDS PostgreSQL, VPC peering
- [x] **Environment** - Secure JWT_SECRET (64+ bytes), automatic HTTPS, production rate limits

#### Custom Domain (habitcraft.org)

- [x] DNS (IONOS) with CNAME records, Lightsail SSL certificates
- [x] Verified HTTPS/cookie functionality across `www.habitcraft.org` and `api.habitcraft.org`

---

## v1.0 Success Criteria

### Functionality Checklist

- [x] User can register with email/password
- [x] User can login and receive JWT tokens
- [x] User can access protected routes with valid token
- [x] User can create, read, update, delete habits
- [x] User can track habit completions
- [x] User can view calendar with completion status
- [x] Users are isolated (can't see each other's data)
- [x] Token refresh works automatically
- [x] Logout clears authentication state

### Quality Checklist

- [ ] Comprehensive review of all FE & BE unit tests (evaluate for redundancies, gaps, and refactoring opportunities)
- [x] Review E2E tests for proper isolation (each test should be independent and not rely on state from other tests)
- [ ] Code coverage >90% (backend and frontend)
- [ ] Documentation complete and accurate
- [ ] Security hardening complete

### Deployment Checklist

- [x] Application runs in Docker with docker-compose
- [x] Environment variables properly configured
- [x] Database migrations work correctly
- [x] Production deployment complete (AWS Lightsail + RDS)
- [x] Custom domain configured (habitcraft.org)

---

## Beyond v1.0

### Feature Enhancements

- **Registration Password Strength Indicator**
  - Visual feedback for password strength (weak/medium/strong)
  - Real-time password strength calculation
- **Statistics & Analytics**
  - Streak tracking
  - Completion rate calculations
  - Habit performance charts
  - Weekly/monthly reports
- **API Enhancements**
  - GET /api/v1/habits/{habitId} - Get single habit by ID
  - GET /api/v1/habits/{habitId}/statistics - Get habit statistics
- **Habit Organization**
  - Categories and tags
  - Habit grouping
  - Custom sorting and filtering
  - Search functionality
- **Notifications & Reminders**
  - Email reminders
  - Push notifications
  - Daily digest emails
  - Customizable reminder schedules
- **Social Features**
  - Share habits with friends
  - Accountability partners
  - Community challenges
  - Public habit templates
- **Advanced Authentication**

  *Current implementation uses JWT with HttpOnly cookies, bcrypt password hashing, refresh token rotation, database-backed revocation, rate limiting, and security headers. The following enhancements are organized by priority.*

  - [ ] **High Priority** *(Core security and usability gaps)*
    - [ ] **Password Reset Flow**
      - *Justification:* Users currently have no account recovery option if they forget their password. This is a critical usability gap that will cause support burden and user frustration.
      - [ ] Create password reset request endpoint (POST /api/v1/auth/forgot-password)
      - [ ] Generate secure time-limited reset token (1 hour expiry)
      - [ ] Store reset token hash in database (not plaintext)
      - [ ] Send reset email with secure link
      - [ ] Create password reset endpoint (POST /api/v1/auth/reset-password)
      - [ ] Invalidate all existing sessions on password reset
      - [ ] Rate limit reset requests (3 per hour per email)
      - [ ] Add frontend forgot password page
      - [ ] Add frontend reset password page
    - [ ] **Email Verification**
      - *Justification:* Prevents fake account creation, ensures users own their email address, and is required for password reset functionality.
      - [ ] Add `email_verified` boolean column to users table
      - [ ] Generate verification token on registration
      - [ ] Send verification email with secure link
      - [ ] Create verification endpoint (GET /api/v1/auth/verify-email)
      - [ ] Add "Resend verification" functionality
      - [ ] Consider: Restrict certain features until verified
      - [ ] Add frontend verification status indicator
      - [ ] Add frontend resend verification UI
    - [ ] **Access Token Revocation (Short-lived Blacklist)**
      - *Justification:* Currently, compromised access tokens remain valid for 15 minutes. A lightweight blacklist enables immediate revocation for security incidents.
      - [ ] Implement in-memory token blacklist (Map or Set)
      - [ ] Add token JTI to blacklist on critical events (password change, security logout)
      - [ ] Check blacklist in JWT middleware (before expiry check)
      - [ ] Auto-cleanup expired entries from blacklist
      - [ ] Optional: Redis-backed blacklist for multi-instance deployments

  - [ ] **Medium Priority** *(Enhanced security and user control)*
    - [ ] **Two-Factor Authentication (2FA/TOTP)**
      - *Justification:* Adds a second layer of security for users with sensitive data. Increasingly expected by security-conscious users and required for some compliance standards.
      - [ ] Add `totp_secret` and `totp_enabled` columns to users table
      - [ ] Create 2FA setup endpoint (generate secret, return QR code)
      - [ ] Create 2FA verification endpoint (validate TOTP code)
      - [ ] Create 2FA disable endpoint (require password confirmation)
      - [ ] Modify login flow to require TOTP when enabled
      - [ ] Generate backup codes for account recovery
      - [ ] Add frontend 2FA setup flow with QR code display
      - [ ] Add frontend 2FA login prompt
      - [ ] Add frontend backup codes display and regeneration
    - [ ] **Device/Session Management UI**
      - *Justification:* Users should be able to see where they're logged in and revoke sessions on lost/stolen devices. The backend already supports `revokeAllUserTokens()`.
      - [ ] Add `device_info` and `last_used_at` columns to refresh_tokens table
      - [ ] Capture device info on login (user agent parsing)
      - [ ] Create endpoint to list active sessions (GET /api/v1/users/me/sessions)
      - [ ] Create endpoint to revoke specific session (DELETE /api/v1/users/me/sessions/:id)
      - [ ] Create endpoint to revoke all other sessions (POST /api/v1/users/me/sessions/revoke-others)
      - [ ] Add frontend sessions management page
      - [ ] Show device type, location (approximate from IP), last active
    - [ ] **Automated Token Cleanup**
      - *Justification:* Expired refresh tokens accumulate in database. Without cleanup, the table grows indefinitely, impacting query performance.
      - [ ] Create scheduled cleanup job (daily recommended)
      - [ ] Use existing `cleanupExpiredTokens()` from tokenService.js
      - [ ] Option A: Cron job calling cleanup endpoint
      - [ ] Option B: Database scheduled job (pg_cron)
      - [ ] Option C: Application startup cleanup
      - [ ] Add monitoring for token table size
    - [ ] **Account Lockout After Failed Attempts**
      - *Justification:* Rate limiting alone doesn't prevent distributed attacks. Temporary account lockout adds defense-in-depth against credential stuffing.
      - [ ] Add `failed_login_attempts` and `locked_until` columns to users table
      - [ ] Increment counter on failed login
      - [ ] Lock account after 10 consecutive failures (15-minute lockout)
      - [ ] Reset counter on successful login
      - [ ] Return generic error (don't reveal lockout to attacker)
      - [ ] Optional: Send email notification on lockout
      - [ ] Log lockout events for security monitoring
    - [ ] **Password Strength Requirements**
      - *Justification:* Current 8-character minimum is weak. Stronger requirements reduce successful brute-force attacks.
      - [ ] Require: 8+ chars, 1 uppercase, 1 lowercase, 1 number
      - [ ] Optional: Check against common password list (top 10k)
      - [ ] Add frontend password strength indicator
      - [ ] Show requirements as user types
      - [ ] Consider: Check against Have I Been Pwned API

  - [ ] **Nice to Have** *(Enhanced UX and modern auth options)*
    - [ ] **OAuth/SSO Integration**
      - *Justification:* Reduces friction for users who prefer social login. Eliminates password management burden for those accounts.
      - [ ] Google OAuth 2.0 integration
      - [ ] GitHub OAuth integration
      - [ ] Handle account linking (OAuth + existing email)
      - [ ] Add frontend OAuth buttons on login/register pages
    - [ ] **Passwordless Login (Magic Links)**
      - *Justification:* Modern authentication option that eliminates password-related security risks entirely.
      - [ ] Generate secure one-time login token
      - [ ] Send magic link via email
      - [ ] Token expires after 15 minutes or single use
      - [ ] Add frontend "Email me a login link" option
    - [ ] **WebAuthn/Passkeys Support**
      - *Justification:* Phishing-resistant authentication using device biometrics or security keys. Emerging industry standard.
      - [ ] Implement WebAuthn registration flow
      - [ ] Implement WebAuthn authentication flow
      - [ ] Store public key credentials in database
      - [ ] Support as primary auth or 2FA method
    - [ ] **Login History/Audit Log UI**
      - *Justification:* Allows users to detect unauthorized access to their account.
      - [ ] Create `login_history` table (timestamp, IP, user agent, success/failure)
      - [ ] Record all login attempts
      - [ ] Create endpoint to fetch login history (GET /api/v1/users/me/login-history)
      - [ ] Add frontend login history page
      - [ ] Show suspicious activity warnings
    - [ ] **Refresh Token Family Tracking**
      - *Justification:* Detects token replay attacks. If an old (rotated) token is used, revoke the entire token family.
      - [ ] Add `family_id` column to refresh_tokens table
      - [ ] All rotated tokens share the same family_id
      - [ ] On use of revoked token: revoke entire family
      - [ ] Alert user of potential compromise
    - [ ] **Breach Detection Integration**
      - *Justification:* Proactively protect users whose passwords appear in known data breaches.
      - [ ] Integrate Have I Been Pwned API (k-anonymity model)
      - [ ] Check on registration and password change
      - [ ] Optional: Periodic check of existing passwords (hash prefix only)
      - [ ] Prompt users to change compromised passwords
- **Mobile Applications**
  - React Native mobile app
  - Flutter mobile app
  - Progressive Web App (PWA)
- **UI/UX Enhancements**
  - Custom themes
  - Accessibility improvements (WCAG AA compliance)
  - Internationalization (i18n)
  - Mobile-responsive improvements
- **UI Polish**
  - Loading states (disabled fields, submit button)
    - Login form
      - Write tests and run tests (red phase)
      - Implementation and run tests (green phase)
      - Evaluate refactoring opportunities (refactor phase)
    - Registration form
      - Write tests and run tests (red phase)
      - Implementation and run tests (green phase)
      - Evaluate refactoring opportunities (refactor phase)
    - Add habit form
      - Write tests and run tests (red phase)
      - Implementation and run tests (green phase)
      - Evaluate refactoring opportunities (refactor phase)
    - Update habit form
      - Write tests and run tests (red phase)
      - Implementation and run tests (green phase)
      - Evaluate refactoring opportunities (refactor phase)
  - Loading skeletons for habit list
    - Write tests and run tests (red phase)
    - Implementation and run tests (green phase)
    - Evaluate refactoring opportunities (refactor phase)
  - Toast notifications for errors
    - Write tests and run tests (red phase)
    - Implementation and run tests (green phase)
    - Evaluate refactoring opportunities (refactor phase)
  - Inline validation error messages
    - Write tests and run tests (red phase)
    - Implementation and run tests (green phase)
    - Evaluate refactoring opportunities (refactor phase)
  - Network error recovery UI
    - Write tests and run tests (red phase)
    - Implementation and run tests (green phase)
    - Evaluate refactoring opportunities (refactor phase)
  - Optimistic UI Updates
    - Write tests and run tests (red phase)
    - Implementation and run tests (green phase)
    - Evaluate refactoring opportunities (refactor phase)

### Code Quality & Testability Refactors

Extract closure-captured logic from React event handlers into pure utility functions for better testability. See `CLAUDE.md` for the pattern documentation.

- **Registration Form Validation** ✓
  - Extracted `validateRegistrationForm()` to `utils/authUtils.ts`
  - Unit tests for password length and match validation
- **Edit Modal Change Detection** (`EditHabitModal.tsx:79-115`)
  - [ ] Extract `detectHabitChanges(current, original)` to `utils/habitUtils.ts`
  - [ ] Extract `buildHabitUpdatePayload()` for update payload construction
  - [ ] Unit tests for change detection edge cases
- **Completion Filtering** (`useHabits.ts:93-94`)
  - [ ] Extract `filterCompletionsByDate()` to `utils/completionUtils.ts`
  - [ ] Unit tests for date filtering logic
- **Login Form Handler** (`login/page.tsx:40-49`)
  - [ ] Extract field change handler factory to `utils/formUtils.ts`
  - [ ] Reusable across login/register forms
- **Async Action Handlers** (`Header.tsx:12-24`, `AddHabitForm.tsx:27-47`)
  - [ ] Extract `handleLogoutWithRecovery()` pattern
  - [ ] Extract form reset logic to `resetFormState()`

### Infrastructure & DevOps

- **Local Git Hooks (pre-commit framework)**
  - [ ] Install pre-commit framework (language-agnostic)
  - [ ] Configure `.pre-commit-config.yaml`
  - [ ] Backend unit tests on commit
  - [ ] Backend integration tests on commit
  - [ ] Frontend unit tests on commit
  - [ ] Frontend E2E tests on commit
  - [ ] Linting on commit (ESLint)
  - [ ] Document setup in GETTING_STARTED.md
- **CI/CD Pipelines**
  - [x] GitHub Actions workflows with automated testing, linting, Codecov coverage, and AWS Lightsail deployment
  - [x] Integration/E2E tests depend on unit tests passing first
  - [ ] **Path-Based Deployment Filtering**
    - [ ] Add `dorny/paths-filter` action to detect changed paths
    - [ ] Define path filters for frontend, backend, and shared code:
      - `backend`: `backends/node/**`, `shared/database/**`
      - `frontend`: `frontends/nextjs/**`, `shared/types/**`
      - `shared`: `shared/**` (triggers both)
      - `ci`: `.github/workflows/**` (triggers both)
    - [ ] Update `deploy-backend` job condition:
      - Deploy when backend paths change OR shared paths change OR CI config changes
      - Skip deployment if only frontend paths changed
    - [ ] Update `deploy-frontend` job condition:
      - Deploy when frontend paths change OR shared paths change OR CI config changes
      - Skip deployment if only backend paths changed
    - [ ] Add workflow summary output showing which services will deploy
    - [ ] Test scenarios to verify:
      - Backend-only change → only backend deploys
      - Frontend-only change → only frontend deploys
      - Shared code change → both deploy
      - CI workflow change → both deploy
      - Documentation change → neither deploys (already excluded)
  - [x] **E2E Test Container Optimization**
    - Docker BuildKit layer caching with GHA cache backend (31% faster: 240s → 166s)
    - Local development: `scripts/test-all.sh` with `--rebuild` flag, auto-detection of dependency changes
    - CI: `docker/bake-action@v5` with GHA cache, force-rebuild workflow_dispatch input
    - Named volumes to prevent stale node_modules issues

- **Cloud Deployment**
  - [x] AWS deployment (Lightsail Containers, RDS PostgreSQL)
- **Infrastructure as Code**
  - [x] AWS CLI deployment scripts
  - [x] GitHub Actions CI/CD workflows
  - [x] IAM policies for CI/CD, ops, and monitoring
  - [ ] Terraform
- **Monitoring & Observability**
  - CloudWatch Alarms (AWS-native)
    - SNS topic for email notifications (`habitcraft-alerts`)
    - Lightsail alarms: Backend/Frontend CPU high (>80%), sustained load (>60%)
    - RDS alarms: CPU, connections, storage, read/write latency
    - Setup scripts in `infrastructure/monitoring/`
  - Application monitoring (Datadog, New Relic)
  - Error tracking (Sentry)
  - Logging aggregation (ELK stack)
  - Performance monitoring (Prometheus + Grafana)
- **Performance Optimization**
  - Caching layer (Redis)
  - CDN for static assets
  - Database query optimization
  - API response caching
  - Image optimization
- **Advanced Database**
  - Database replication
  - Automated backups
  - Point-in-time recovery
  - Database performance tuning

---

## Development Principles

1. **Test-Driven Development** - Write tests before implementation
2. **Small, Focused Commits** - Commit after each passing test or feature
3. **Documentation as Code** - Update docs alongside features
4. **Security First** - Never compromise on authentication and authorization
5. **User Experience** - Smooth, responsive UI with proper error handling
6. **Code Quality** - Clean, readable, maintainable code

---

## Resources

- **Project Plan:** `/PROJECT_PLAN.md` (this file)
- **Getting Started:** `/GETTING_STARTED.md`
- **Authentication Guide:** `/AUTHENTICATION.md`
- **Testing Guide:** `/docs/TESTING.md`
- **AWS Architecture:** `/docs/AWS_ARCHITECTURE.md`
- **Main README:** `/README.md`
- **API Specification:** `/shared/api-spec/openapi.yaml`
- **Database Schema:** `/shared/database/schema.sql`
- **Backend README:** `/backends/node/README.md`
- **Frontend README:** `/frontends/nextjs/README.md`
