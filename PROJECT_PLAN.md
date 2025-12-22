# HabitCraft - Project Plan

## Project Vision

HabitCraft is a full-stack habit tracking application demonstrating modern web development practices with Test-Driven Development (TDD), clean architecture, and comprehensive testing.

## Technology Stack

- **Frontend:** Next.js with React, TypeScript, Tailwind CSS
- **Backend:** Node.js with Express, JavaScript
- **Database:** PostgreSQL 14+
- **Testing:** Jest + Supertest (Backend), Jest + React Testing Library (Frontend)
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

- [x] Project structure and configuration
- [x] Docker Compose orchestration
- [x] PostgreSQL database setup
- [x] Database schema (users, habits, completions tables)
- [x] Seed data (demo users + sample habits)
- [x] Environment variables configured
- [x] Adminer database admin UI

### Backend - Node.js + Express

#### Foundation

- [x] Express app setup and configuration
- [x] Testing framework (Jest + Supertest)
- [x] Database connection pool
- [x] CORS support
- [x] Environment variable management
- [x] Hello World endpoint with tests

#### Authentication & Authorization

- [x] Install dependencies (bcrypt, jsonwebtoken, express-validator)
- [x] **User Registration (POST /api/v1/auth/register)**
  - [x] Write tests (valid registration, duplicate email, validation, password hashing, JWT generation)
  - [x] Implement endpoint with input validation
  - [x] Hash passwords with bcrypt (10 salt rounds)
  - [x] Generate access token (15 min) and refresh token (7 days)
- [x] **User Login (POST /api/v1/auth/login)**
  - [x] Write tests (success, invalid email, wrong password, token generation)
  - [x] Implement endpoint with credential verification
  - [x] Generic error messages (prevent user enumeration)
  - [x] Generate JWT tokens
- [x] **JWT Authentication Middleware**
  - [x] Write tests (valid token, missing/malformed/expired tokens, wrong token type)
  - [x] Implement jwtAuth.js middleware
  - [x] Extract and verify token from Authorization header
  - [x] Attach userId to request object
- [x] **Token Refresh (POST /api/v1/auth/refresh)**
  - [x] Write tests (valid refresh, expired token, wrong type, invalid signature)
  - [x] Implement refresh endpoint
  - [x] Validate refresh token and generate new access token
- [x] **User Profile (GET /api/v1/auth/me)**
  - [x] Write tests (success with valid token, missing/invalid/expired token)
  - [x] Implement profile endpoint
  - [x] Return user data (id, email, name, createdAt)
- [x] **Update Protected Routes**
  - [x] Write tests for habit endpoints with JWT authentication
  - [x] Write tests for completion endpoints with JWT authentication
  - [x] Replace mockAuth with jwtAuth middleware (with X-User-Id fallback for development)
  - [x] Remove mockAuth.js file
  - [x] Verify user isolation and data access controls
  - [x] Remove X-User-Id fallback once frontend JWT auth is complete
- [x] **Secure Token Storage (HttpOnly Cookies)**
  - [x] Install cookie-parser middleware
  - [x] Update CORS config to allow credentials
  - [x] Update login/register to set HttpOnly cookies instead of returning tokens in body
  - [x] Update JWT middleware to read tokens from cookies (with Authorization header fallback)
  - [x] Update refresh endpoint to use cookies
  - [x] Add logout endpoint to clear cookies
  - [x] Update frontend to use credentials: 'include' for API requests
  - [x] Remove localStorage token handling from frontend (using HttpOnly cookies instead)

#### Habit Management

- [x] **POST /api/v1/habits** - Create habit
  - [x] Tests
  - [x] Input validation (name, frequency, color, icon)
  - [x] User isolation enforcement
- [x] **GET /api/v1/habits** - List habits
  - [x] Tests
  - [x] Optional status filter (active/archived)
  - [x] User isolation
- [x] **PUT /api/v1/habits/:id** - Update habit
  - [x] Tests
  - [x] Field updates (name, description, frequency, targetDays, color, icon, status)
  - [x] User ownership enforcement
- [x] **DELETE /api/v1/habits/:id** - Delete habit
  - [x] Tests
  - [x] User ownership enforcement

#### Completion Tracking

- [x] **POST /api/v1/habits/:habitId/completions** - Mark complete
  - [x] Tests
  - [x] Habit ownership validation
  - [x] Duplicate prevention (409 Conflict)
  - [x] Date format validation
- [x] **Prevent future date completions**
  - [x] Write tests (reject dates after today, allow today and past dates)
  - [x] Add validation to POST completions endpoint
  - [x] Return 400 Bad Request with clear error message
  - [x] Disable future date bubbles in HabitCard UI
- [x] **GET /api/v1/habits/:habitId/completions** - List completions
  - [x] Tests
  - [x] Date range filtering (startDate, endDate)
  - [x] Habit ownership validation
- [x] **DELETE /api/v1/habits/:habitId/completions/:date** - Remove completion
  - [x] Tests
  - [x] Habit ownership validation
  - [x] Date format validation

#### User Management (API Refactor)

- [x] **Refactor user profile to RESTful /users endpoint**
  - [x] **Backend: Write tests for GET /api/v1/users/me (Red phase)**
  - [x] **Backend: Implement users router (Green phase)**
  - [x] **Frontend: Update AuthContext tests (Red phase)**
  - [x] **Frontend: Update AuthContext implementation (Green phase)**
  - [x] **Clean-up: Remove deprecated /auth/me endpoint**
  - [x] **Documentation: Update OpenAPI specification**
- [ ] **User Profile Management**
  - [x] **Update Name (PUT /api/v1/users/me)**
  - [x] **Update Email (PUT /api/v1/users/me)**
  - [ ] **Change Password (PUT /api/v1/users/me/password)**
    - [ ] Write tests for password change endpoint (require current password)
    - [ ] Implement password change in backend
    - [ ] Add password change UI in frontend
  - [ ] **User Profile Management Modal**
    - [x] **Modal Infrastructure**
      - [x] Write unit tests for modal open/close functionality
      - [x] Implement modal UI structure (open/close, cancel button)
      - [x] Write tests for profile button in Header component
      - [x] Add profile button to Header component
    - [x] **Display User Info**
      - [x] Write unit tests for user info display rendering
      - [x] Implement user info display section
    - [x] **Edit Name**
      - [x] Write unit tests for name field rendering and validation
      - [x] Implement name input field with validation
      - [x] Write unit tests for name update submission
      - [x] Connect name update to API
    - [x] **Edit Email**
      - [x] Write unit tests for email field rendering and validation
      - [x] Implement email input field with validation
      - [x] Write unit tests for email update submission
      - [x] Connect email update to API
    - [ ] **Change Password Section**
      - [ ] Write unit tests for password fields rendering
      - [ ] Implement password change fields (current, new, confirm)
      - [ ] Write unit tests for password validation (match, strength)
      - [ ] Write unit tests for password change submission
      - [ ] Connect password change to API
      - [ ] Run all tests (scripts/test-all.sh)
      - [ ] Update project docs if needed
    - [x] **Error Handling**
      - [x] Write unit tests for error message rendering
      - [x] Implement error handling UI
    - [x] **Loading States**
      - [x] Write unit tests for loading state during save
      - [x] Implement loading indicators for save operations
    - [x] **Header Cleanup**
      - [x] Remove redundant user name display from Header (now in profile modal)
      - [x] Remove redundant user email display from Header (now in profile modal)
      - [x] Remove edit icons for name/email from Header
      - [x] Update Header tests to reflect removed elements

### Frontend - Next.js + React

#### Foundation

- [x] Next.js project setup with TypeScript
- [x] Tailwind CSS configuration
- [x] Testing framework (Jest + React Testing Library)
- [x] Environment variable configuration

#### Authentication & Authorization

- [x] **Auth Context (context/AuthContext.tsx)**
  - [x] Write tests (login, logout, register, session persistence, loading states)
  - [x] Implement AuthContext with user state management
  - [x] Cookie-based authentication (HttpOnly cookies)
  - [x] isLoading and isAuthenticated flags
- [x] **Custom Auth Hooks**
  - [x] Write tests for useAuth() hook
  - [x] Write tests for useRequireAuth() hook (redirect logic)
  - [x] Implement hooks
- [x] **API Client JWT Integration (lib/api.ts)**
  - [x] Write tests (401 interception, token refresh, retry logic)
  - [x] Implement 401 interceptor
  - [x] Automatic token refresh on expired access token
  - [x] Request retry with new token
  - [x] Configurable auth failure callback (setOnAuthFailure)
  - [x] Configure auth failure callback in app initialization
  - [x] Fix JSDOM navigation warnings in existing tests (lines 117, 445)
  - [x] Fix React act() warnings in AuthContext tests
  - [x] Fix React act() warnings in useHabits tests
- [x] **Login Page (app/login/page.tsx)**
  - [x] Write tests (form rendering, validation, loading, errors, redirect, links)
  - [x] Implement email/password form
  - [x] Form validation (browser HTML5 validation)
  - [x] Error handling and loading states
  - [x] Add AuthProvider to app layout
    - [x] Write tests for layout with AuthProvider
    - [x] Wrap app with AuthProvider in layout.tsx
  - [x] Update seed data with working demo password
    - [x] Generate bcrypt hash for demo password (demo123)
    - [x] Update seed.sql with valid password hash
    - [x] Update documentation (GETTING_STARTED.md, database README)
- [x] **Registration Page (app/register/page.tsx)**
  - [x] **Step 1: Basic Form Structure**
    - [x] Write tests for form rendering (name, email, password, confirm password fields, submit button, heading, link to login)
    - [x] Implement basic registration form UI
    - [x] Add auto-redirect for already authenticated users
  - [x] **Step 2: Form Validation**
    - [x] Write tests for HTML5 validation (required fields, email format)
    - [x] Write tests for password matching validation
    - [x] Write tests for minimum password length (8 characters)
    - [x] Implement client-side validation logic
  - [x] **Step 3: Form Submission**
    - [x] Write tests for successful registration flow
    - [x] Write tests for redirect to home page after registration
    - [x] Implement form submission logic
  - [x] **Step 4: Error Handling**
    - [x] Write tests for API error display
    - [x] Write tests for clearing errors on input change
    - [x] Implement error handling UI and logic
- [x] **Protected Routes**
  - [x] Write tests (loading state, redirect, authenticated access)
  - [x] Implement ProtectedRoute wrapper component
  - [x] Wrap main app pages
- [x] **Logout Functionality**
  - [x] Write tests (Header component with logout button, loading states, error handling)
  - [x] Add logout button to UI (Header component in layout)
  - [x] Implement logout flow (calls AuthContext.logout, redirects to /login)

#### API Integration

- [x] API client service (lib/api.ts)
- [x] Type definitions matching backend
- [x] Error handling for API calls
- [x] **Habits API**
  - [x] fetchHabits()
  - [x] createHabit()
  - [x] updateHabit()
  - [x] deleteHabit()
- [x] **Completions API**
  - [x] fetchCompletions()
  - [x] createCompletion()
  - [x] deleteCompletion()

#### State Management

- [x] useHabits hook
  - [x] Fetch habits from API
  - [x] Create habit
  - [x] Update habit
  - [x] Delete habit
  - [x] Toggle completion
  - [x] Check completion status
  - [x] Optimistic UI updates

#### UI Components

- [x] **Home Page (app/page.tsx)**
  - [x] Display habits from database
  - [x] Create habit form integration
  - [x] Update habit functionality (see EditHabitModal component below)
  - [x] Delete habit button
  - [x] Loading and empty states
- [x] **AddHabitForm Component**
  - [x] Form with validation
  - [x] Habit customization (name, frequency, color, icon)
  - [x] Connected to API
  - [ ] **Icon Selector**
    - [ ] Write tests for icon picker rendering
    - [ ] Implement icon picker UI (reuse from EditHabitModal)
    - [ ] Write tests for icon selection in form submission
    - [ ] Connect icon selection to createHabit API
- [x] **HabitCard Component**
  - [x] Calendar week view (Sunday-Saturday)
  - [x] Week navigation (previous/next)
  - [x] Completion bubbles with checkmarks
  - [x] Color-coded indicators
  - [x] Toggle completion on click
  - [x] Delete button
  - [x] Timezone handling for dates
  - [x] Remove color dot next to edit button
  - [x] Add "Today" button to jump to current week
- [x] **EditHabitModal Component**
  - [x] **Modal Infrastructure**
    - [x] Write tests for modal open/close functionality
    - [x] Implement modal UI structure (open/close, cancel button)
    - [x] Write tests for edit button in HabitCard
    - [x] Add edit button to HabitCard component
  - [x] **Update Habit Title**
    - [x] Write tests for title field rendering and validation
    - [x] Implement title input field with validation
    - [x] Write tests for title update submission
    - [x] Connect title update to API
  - [x] **Update Habit Description**
    - [x] Write tests for description field rendering
    - [x] Implement description textarea field
    - [x] Write tests for description update submission
    - [x] Connect description update to API
  - [x] **Update Habit Color**
    - [x] Write tests for color picker rendering
    - [x] Implement color picker component
    - [x] Write tests for color update submission
    - [x] Connect color update to API
  - [x] **Update Habit Icon**
    - [x] Write tests for icon selector rendering (24 icons)
    - [x] Implement icon selector component with 24 preset emojis
    - [x] Write tests for icon update submission
    - [x] Connect icon update to API
  - [x] **Error Handling**
    - [x] Write tests for API error display
    - [x] Implement error handling UI
- [x] **Date Utilities (utils/dateUtils.ts)**
  - [x] getCalendarWeek() function
  - [x] Week calculation logic

### Acceptance Testing

#### Test Infrastructure

- [x] **Test Database Configuration**
  - [x] Separate Docker container for test database (docker-compose.test.yml)
  - [x] Test database: habitcraft_test on port 5433 (avoids conflict with dev on 5432)
  - [x] Same schema as production (shared/database/schema.sql)
- [x] **Automatic Setup/Teardown Scripts** (scripts/)
  - [x] test-db-start.sh - Start test database container
  - [x] test-db-stop.sh - Stop test database container
  - [x] test-db-reset.sh - Reset to clean state with fixtures
  - [x] test-db-fresh.sh - Remove all data and start fresh
- [x] **Test Data Fixtures** (shared/database/test-fixtures.sql)
  - [x] Test User 1: test@example.com / Test1234! (UUID: 11111111-...)
  - [x] Test User 2: test2@example.com / Test1234! (UUID: 22222222-...)
  - [x] Sample habits with predictable UUIDs for both users
  - [x] Sample completions for integration testing
- [x] **Environment Variables for Test Environment**
  - [x] backends/node/.env.test - Test database connection, test JWT secret
  - [x] frontends/nextjs/.env.test - Test API URL
- [x] **E2E Testing Framework**
  - [x] Install and configure Playwright (@playwright/test)
  - [x] Playwright configuration (playwright.config.ts)
  - [x] Global setup/teardown for test database (e2e/global-setup.ts, e2e/global-teardown.ts)
  - [x] npm scripts: test:e2e, test:e2e:ui, test:e2e:headed, test:e2e:report

#### Backend Integration Tests

- [x] **Authentication Flow Tests** (integration/auth.test.js)
  - [x] Register → Login → Access Protected Route
  - [x] Login → Token Refresh → Continue Session
  - [x] Invalid Credentials → Proper Error Response
  - [x] User isolation verification
  - [x] Logout and session invalidation
  - [x] Token expiration handling
- [x] **Habit CRUD Integration Tests** (integration/habits.test.js)
  - [x] Full CRUD cycle with real database
  - [x] User isolation (can't access other users' data)
  - [x] Cascading deletes (habits → completions)
  - [x] Status filtering with real data
  - [x] Update validations with database constraints
- [x] **Completion Tracking Integration Tests** (integration/completions.test.js)
  - [x] Create completion → Verify in database
  - [x] Date filtering with real data
  - [x] Delete completion → Verify removal
  - [x] Duplicate prevention
  - [x] Habit ownership validation

#### Frontend End-to-End Tests (Playwright)

- [x] Set up Playwright E2E testing framework
- [x] **Authentication Flow E2E** (e2e/auth.spec.ts)
  - [x] User registration flow
  - [x] Login flow
  - [x] Protected route access
  - [x] Logout flow
  - [x] User isolation verification
    - [x] User 1 sees own habits, not User 2's habits
    - [x] User 2 sees own habits, not User 1's habits (reverse direction)
    - [x] Session switching: no data leakage between user sessions
  - [x] Token refresh during active session
- [x] **Habit Management E2E** (e2e/habits.spec.ts)
  - [x] Create habit → Appears in list
  - [x] Update habit → Changes persist
  - [x] Delete habit → Removed from list
- [x] **Completion Tracking E2E** (e2e/completions.spec.ts)
  - [x] Toggle completion → Visual update
  - [x] Navigate week → Loads completions
  - [x] Remove completion → Visual update
  - [x] Multiple habits completion tracking
  - [x] Calendar navigation
  - [x] Fix flaky test: "should persist completion after page reload"
- [x] **E2E Test Isolation Fixes**
  - **Problem:** Tests modify fixture data (habits, user profile, completions) without restoration, causing cross-test dependencies and potential failures when test order changes.
  - **Solution:** Create unique test data instead of modifying fixtures
  - **Data Strategy:**
    - User 1 (`test@example.com`): READ ONLY - never modified
    - User 2 (`test2@example.com`): Never logged in as, only used for "email taken" validation
    - All data-modifying tests create unique entities with `Date.now()` timestamps
  - [x] **habits.spec.ts - Update Habit Tests**
    - [x] Added `createTestHabit` helper that creates unique habits with timestamp
    - [x] All 5 update tests now create their own habits before testing
  - [x] **auth.spec.ts - Profile Management Tests**
    - [x] Profile update tests now register unique users before testing
    - [x] "Email already taken" tests create unique users and check against user 1's email
    - [x] Profile Modal Updates describe block creates unique users for each test
  - [x] **completions.spec.ts - Completion Toggle Tests**
    - [x] Toggle tests create unique habits using `createTestHabit` helper
    - [x] "Track completions independently" test creates two unique habits
    - [x] Navigation/display tests use fixture habits (read-only, safe)
  - [x] **Verification**
    - [x] All 50 E2E tests pass
    - [x] Comprehensive audit confirms all tests are properly isolated

### Documentation

- [x] **Update README.md**
  - [x] v1 feature list
  - [x] Remove polyglot/multi-backend references
  - [x] Update roadmap with completed work
  - [x] Current technology stack
- [x] **Update GETTING_STARTED.md**
  - [x] Remove mock auth references
  - [x] Add JWT authentication setup steps
  - [x] Update quick start instructions
- [x] **Update OpenAPI Specification**
  - [x] Add authentication endpoints (/auth/refresh, /auth/logout)
  - [x] Update auth responses for HttpOnly cookies
  - [x] Add 403 Forbidden response for completions
  - [x] Remove unimplemented endpoints (GET /habits/{id}, statistics)
  - [x] Fix DELETE completion response (200 with body)
  - [x] Add request/response examples
- [ ] **User Guide**
  - [ ] Registration and login instructions
  - [ ] Habit management guide
  - [ ] Completion tracking guide
  - [ ] Troubleshooting section
- [x] **Update Backend README**
  - [x] Remove mock auth references
  - [x] Document JWT configuration
  - [x] Update endpoint list
- [x] **Update Frontend README**
  - [x] Update status and completed features list
  - [x] Update project structure with all components
  - [x] Update test examples
  - [x] Fix port configuration
- [x] **AWS Architecture Documentation** (docs/AWS_ARCHITECTURE.md)
  - [x] Lightsail Containers + RDS architecture
  - [x] Step-by-step setup guide (~30 min)
  - [x] CI/CD with GitHub Actions
  - [x] Database migration steps
  - [x] Automatic HTTPS on Lightsail domains
  - [x] Built-in monitoring dashboards
  - [x] Security checklist
  - [x] Backup and disaster recovery procedures

### Security & Deployment

#### Security Hardening

- [x] Rate limiting on auth endpoints (express-rate-limit implementation)
- [x] Input sanitization (XSS prevention with xss library)
- [x] CORS configuration for specific origins (uses FRONTEND_URL env var, not wildcard)
- [x] Production secret enforcement (fail startup if JWT_SECRET not set in production)
- [x] Security headers (helmet.js - CSP, HSTS, etc.)
- [x] Security event logging (failed logins, token refresh, auth failures)
- [x] Security audit
  - [x] Review authentication code (bcrypt, JWT, HttpOnly cookies, rate limiting)
  - [x] Check OWASP Top 10 vulnerabilities (parameterized queries, no injection vectors)
  - [x] Verify environment variable security (.env files gitignored, secrets from env)
  - [x] Test token expiration and refresh (15m access, 7d refresh, proper rejection)
- [x] Token security enhancements
  - [x] Refresh token rotation on use
  - [x] Token revocation/blacklist for logout
  - [x] Unique token identifiers (jti claim)
  - [x] Database storage for refresh tokens

#### Production Configuration

- [x] Production Dockerfiles
  - [x] Backend Dockerfile with health checks
  - [x] Frontend Dockerfile with standalone output
  - [x] Test images build and run locally
- [x] AWS Lightsail deployment
  - [x] Create Lightsail Container Services (frontend + backend)
  - [x] Create RDS PostgreSQL instance
  - [x] Configure VPC peering for RDS access
  - [x] Set up GitHub Secrets for CI/CD
  - [x] Deploy and verify health checks
- [x] Production environment setup
  - [x] Secure JWT_SECRET generation (64+ random bytes)
  - [x] HTTPS via Lightsail (automatic on .amazonaws.com domains)
  - [x] CORS whitelist for production frontend URL
  - [x] Rate limiting configuration (production limits and thresholds)

#### Custom Domain (habitcraft.org)

- [x] **DNS Configuration (IONOS)**
  - [x] Create CNAME record for `www.habitcraft.org` → Lightsail frontend URL
  - [x] Create CNAME record for `api.habitcraft.org` → Lightsail backend URL
  - [x] Configure apex domain (`habitcraft.org`) redirect to `www`
- [x] **SSL Certificates (AWS Lightsail)**
  - [x] Create certificate for `www.habitcraft.org`
  - [x] Create certificate for `api.habitcraft.org`
  - [x] Validate domain ownership via DNS
  - [x] Attach certificates to Lightsail container services
- [x] **Application Configuration**
  - [x] Update `FRONTEND_URL` GitHub secret to `https://www.habitcraft.org`
  - [x] Update `API_URL` GitHub secret to `https://api.habitcraft.org`
  - [x] Redeploy services (CORS configured via FRONTEND_URL env var)
- [x] **Verification**
  - [x] Verify HTTPS works on custom domain
  - [x] Verify API endpoints accessible at `api.habitcraft.org`
  - [x] Verify cookies work across custom domain
  - [x] Update README and docs with new URLs

---

## v1.0 Success Criteria

### Functionality Checklist

- [ ] User can register with email/password
- [ ] User can login and receive JWT tokens
- [ ] User can access protected routes with valid token
- [ ] User can create, read, update, delete habits
- [ ] User can track habit completions
- [ ] User can view calendar with completion status
- [ ] Users are isolated (can't see each other's data)
- [ ] Token refresh works automatically
- [ ] Logout clears authentication state

### Quality Checklist

- [ ] Comprehensive review of all FE & BE unit tests (evaluate for redundancies, gaps, and refactoring opportunities)
- [x] Review E2E tests for proper isolation (each test should be independent and not rely on state from other tests)
- [ ] All backend tests passing
- [ ] All frontend tests passing
- [ ] All integration tests passing
- [ ] All E2E tests passing
- [ ] Code coverage >80% (backend and frontend)
- [ ] Documentation complete and accurate
- [ ] Security hardening complete

### Deployment Checklist

- [x] Application runs in Docker with docker-compose
- [x] Environment variables properly configured
- [x] Database migrations work correctly
- [x] Production deployment complete (AWS Lightsail + RDS)
- [ ] Custom domain configured (habitcraft.org)

---

## Beyond v1.0

### Additional Backend Implementations

| Language | Framework   | ORM/Database       | Testing          | Status         |
| -------- | ----------- | ------------------ | ---------------- | -------------- |
| Node.js  | Express     | pg (node-postgres) | Jest + Supertest | ✅ In Progress |
| Python   | FastAPI     | SQLAlchemy         | Pytest           | 🔜 Planned     |
| Go       | Gin         | GORM               | testing          | 🔜 Planned     |
| Java     | Spring Boot | JPA/Hibernate      | JUnit            | 🔜 Planned     |

### Additional Frontend Implementations

| Framework | State Management | Styling           | Testing    | Status         |
| --------- | ---------------- | ----------------- | ---------- | -------------- |
| Next.js   | React Hooks      | Tailwind CSS      | Jest + RTL | ✅ In Progress |
| React     | Redux/Zustand    | Styled Components | Jest + RTL | 🔜 Planned     |
| Vue       | Pinia            | Tailwind CSS      | Vitest     | 🔜 Planned     |

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
- **Calendar View Options**
  - Weekly view (current default)
  - Monthly view with completion grid
  - Toggle between views per habit
- **UI/UX Enhancements**
  - Dark mode
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

- **Registration Form Validation**
  - [x] Extract `validateRegistrationForm()` to `utils/authUtils.ts`
  - [x] Unit tests for password length and match validation
  - [x] Update `register/page.tsx` to use utility
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
- **Backdrop Click Handler** (`EditHabitModal.tsx:72-77`)
  - [ ] Extract `createBackdropClickHandler()` for modal reuse

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
  - [x] GitHub Actions workflows (.github/workflows/ci.yml)
  - [x] Automated testing on every commit
  - [x] Code quality checks (linting)
  - [x] Automated deployment to AWS Lightsail
  - [x] Code coverage reporting (Codecov integration)
  - [x] Make integration/E2E tests depend on unit tests passing first
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
  - [ ] **E2E Test Container Optimization**
    - **Problem:** Currently using `--build` flag on every E2E run, rebuilding containers even when dependencies haven't changed. This is slow (~2-3 min) but was added to prevent stale node_modules issues.
    - **Solution:** Conditional rebuild based on lock file changes + Docker BuildKit layer caching
    - **Prerequisites:**
      - [x] Dockerfiles already optimized (package files first, npm ci, then source) ✓

    - [x] **Phase 1: Update scripts/test-all.sh for local development**
      - **Problem:** Script uses `--no-cache` and removes volumes on every run, making local test runs very slow (~3-5 min startup)
      - [x] Add `--rebuild` / `-r` flag to force full rebuild when needed:
        ```bash
        # Parse arguments
        FORCE_REBUILD=false
        while [[ "$#" -gt 0 ]]; do
            case $1 in
                -r|--rebuild) FORCE_REBUILD=true ;;
                *) echo "Unknown parameter: $1"; exit 1 ;;
            esac
            shift
        done
        ```
      - [x] Change default behavior to use cached containers:
        ```bash
        if [ "$FORCE_REBUILD" = true ]; then
            echo "Force rebuild requested - removing old containers and volumes..."
            docker compose -f docker-compose.test.yml down -v 2>/dev/null || true
            docker compose -f docker-compose.test.yml build --no-cache
            docker compose -f docker-compose.test.yml up -d
        else
            echo "Starting containers (use --rebuild for fresh build)..."
            docker compose -f docker-compose.test.yml up -d
        fi
        ```
      - [x] Remove automatic image deletion (lines 47-48)
      - [x] Remove automatic volume deletion (lines 49-50)
      - [x] Update script header comments to document the `--rebuild` flag
      - [x] Add auto-detection of package-lock.json changes:
        ```bash
        # Store hash of lock files after successful run
        LOCK_HASH_FILE="$PROJECT_ROOT/.test-deps-hash"
        CURRENT_HASH=$(cat backends/node/package-lock.json frontends/nextjs/package-lock.json | md5sum | cut -d' ' -f1)

        if [ -f "$LOCK_HASH_FILE" ] && [ "$(cat $LOCK_HASH_FILE)" != "$CURRENT_HASH" ]; then
            echo "⚠️  Dependencies changed since last run - triggering rebuild"
            FORCE_REBUILD=true
        fi

        # Save hash after successful run
        echo "$CURRENT_HASH" > "$LOCK_HASH_FILE"
        ```
      - [x] Test scenarios:
        - Default run (no flags) → fast startup with cached containers
        - `--rebuild` flag → full rebuild with no cache
        - Auto-detect dependency change → triggers rebuild automatically

    - [x] **Phase 2: Add Docker BuildKit caching**
      - [x] Add `docker/setup-buildx-action@v3` to e2e-tests job
      - [x] Enable BuildKit with `DOCKER_BUILDKIT=1` environment variable
      - [x] Create `docker-bake.test.hcl` for buildx bake configuration
      - [x] Update CI to use `docker/bake-action@v5` with GitHub Actions cache backend:
        ```yaml
        - name: Build test containers with cache
          uses: docker/bake-action@v5
          with:
            files: |
              docker-compose.test.yml
              docker-bake.test.hcl
            set: |
              *.cache-from=type=gha
              *.cache-to=type=gha,mode=max
            load: true
        ```
      - [x] Remove unused `actions/cache` step (GHA cache is handled by buildx directly)
      - [x] Update `docker compose up` to not rebuild (images already built by bake)
      - [x] Verify cache hits on subsequent CI runs (31% faster: 240s → 166s)

    - [x] **Phase 3: Add dependency change visibility logging**
      - BuildKit layer caching (Phase 2) automatically handles rebuilds when dependencies change
      - This phase adds visibility into what's happening for debugging/monitoring
      - [x] Add step to detect and log dependency changes

    - [x] **Phase 4: Add force-rebuild workflow_dispatch input**
      - Provides escape hatch for cache corruption or stale image issues
      - [x] Add workflow_dispatch input with `force_rebuild` boolean
      - [x] Update bake-action to conditionally skip cache when force_rebuild is true

    - [x] **Phase 5: Replace anonymous volumes with named volumes**
      - Anonymous volumes can cause stale node_modules issues
      - [x] Update frontend-nextjs-test service volumes to use named volumes
      - [x] Add `frontend_test_modules` and `frontend_test_next` to volumes section
      - [x] Add explanatory comment in docker-compose.test.yml

    - [ ] **Phase 6: Testing and validation in CI**
      - [ ] Test scenario: Source-only change → BuildKit cache hits, fast build
      - [ ] Test scenario: package-lock.json change → BuildKit rebuilds npm layers
      - [ ] Test scenario: Manual force rebuild via workflow_dispatch
      - [x] Test scenario: First run (no cache) → full build works (verified locally)


- **Cloud Deployment**
  - [x] AWS deployment (Lightsail Containers, RDS PostgreSQL)
  - Google Cloud Platform
  - Azure deployment
- **Infrastructure as Code**
  - [x] AWS CLI deployment scripts
  - [x] GitHub Actions CI/CD workflows
  - [x] IAM policies for CI/CD, ops, and monitoring
  - CloudFormation templates (future)
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
- **AWS Architecture:** `/docs/AWS_ARCHITECTURE.md`
- **Main README:** `/README.md`
- **API Specification:** `/shared/api-spec/openapi.yaml`
- **Database Schema:** `/shared/database/schema.sql`
- **Backend README:** `/backends/node/README.md`
- **Frontend README:** `/frontends/nextjs/README.md`
