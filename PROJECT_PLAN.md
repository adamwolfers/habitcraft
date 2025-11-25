# HabitCraft - Project Plan

## Project Vision

HabitCraft is a full-stack habit tracking application demonstrating modern web development practices with Test-Driven Development (TDD), clean architecture, and comprehensive testing.

## Technology Stack

- **Frontend:** Next.js with React, TypeScript, Tailwind CSS
- **Backend:** Node.js with Express, JavaScript
- **Database:** PostgreSQL 14+
- **Testing:** Jest + Supertest (Backend), Jest + React Testing Library (Frontend)
- **Deployment:** Docker Compose

## Version 1.0 Goals

**Core Features:**

1. User registration and JWT authentication
2. Full habit CRUD operations with UI support
3. Completion tracking with calendar view
4. Acceptance test coverage

---

## Work Stream for v1.0

### Infrastructure & Setup

- [x] Project structure and configuration
- [x] Docker Compose orchestration
- [x] PostgreSQL database setup
- [x] Database schema (users, habits, completions tables)
- [x] Seed data (demo user + sample habits)
- [x] Update seed data to include second demo user (demo2@example.com / demo1234)
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
- [x] **GET /api/v1/habits/:habitId/completions** - List completions
  - [x] Tests
  - [x] Date range filtering (startDate, endDate)
  - [x] Habit ownership validation
- [x] **DELETE /api/v1/habits/:habitId/completions/:date** - Remove completion
  - [x] Tests
  - [x] Habit ownership validation
  - [x] Date format validation

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
  - [ ] Update habit functionality (see EditHabitModal component below)
  - [x] Delete habit button
  - [x] Loading and empty states
- [x] **AddHabitForm Component**
  - [x] Form with validation
  - [x] Habit customization (name, frequency, color, icon)
  - [x] Connected to API
- [x] **HabitCard Component**
  - [x] Calendar week view (Sunday-Saturday)
  - [x] Week navigation (previous/next)
  - [x] Completion bubbles with checkmarks
  - [x] Color-coded indicators
  - [x] Toggle completion on click
  - [x] Delete button
  - [x] Timezone handling for dates
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

- [ ] Test database configuration (separate test DB or containers)
- [ ] Automatic setup/teardown scripts
- [ ] Test data fixtures
- [ ] Environment variables for test environment

#### Backend Integration Tests

- [ ] **Authentication Flow Tests**
  - [ ] Register → Login → Access Protected Route
  - [ ] Login → Token Refresh → Continue Session
  - [ ] Invalid Credentials → Proper Error Response
  - [ ] Token expiration and refresh handling
  - [ ] User isolation verification
- [ ] **Habit CRUD Integration Tests**
  - [ ] Full CRUD cycle with real database
  - [ ] User isolation (can't access other users' data)
  - [ ] Cascading deletes (habits → completions)
  - [ ] Status filtering with real data
  - [ ] Update validations with database constraints
- [ ] **Completion Tracking Integration Tests**
  - [ ] Create completion → Verify in database
  - [ ] Date filtering with real data
  - [ ] Delete completion → Verify removal
  - [ ] Duplicate prevention
  - [ ] Habit ownership validation

#### Frontend End-to-End Tests

- [ ] Set up E2E testing framework (Playwright or Cypress)
- [ ] **Authentication Flow E2E**
  - [ ] User registration flow
  - [ ] Login flow
  - [ ] Protected route access
  - [ ] Logout flow
  - [ ] Token refresh during active session
- [ ] **Habit Management E2E**
  - [ ] Create habit → Appears in list
  - [ ] Update habit → Changes persist
  - [ ] Delete habit → Removed from list
  - [ ] Filter habits by status
- [ ] **Completion Tracking E2E**
  - [ ] Toggle completion → Visual update
  - [ ] Navigate week → Loads completions
  - [ ] Remove completion → Visual update
  - [ ] Multiple habits completion tracking
  - [ ] Calendar navigation

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
- [ ] **Update OpenAPI Specification**
  - [ ] Add authentication endpoints
  - [ ] Add Bearer token security scheme
  - [ ] Update all endpoints with auth requirements
  - [ ] Add request/response examples
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
- [ ] **Create DEPLOYMENT.md**
  - [ ] Environment setup checklist
  - [ ] Database migration steps
  - [ ] SSL/TLS configuration
  - [ ] Monitoring recommendations
  - [ ] Backup procedures

### Security & Deployment

#### Security Hardening

- [ ] Rate limiting on auth endpoints (express-rate-limit implementation)
- [ ] Input sanitization (XSS prevention)
- [ ] CORS configuration for specific origins (remove wildcard)
- [ ] Security headers (helmet.js - CSP, HSTS, etc.)
- [ ] Security event logging (failed logins, token refresh, auth failures)
- [ ] Security audit
  - [ ] Review authentication code
  - [ ] Check OWASP Top 10 vulnerabilities
  - [ ] Verify environment variable security
  - [ ] Test token expiration and refresh

#### Production Configuration

- [ ] Update Docker Compose for production
  - [ ] Environment variable management
  - [ ] PostgreSQL production config
  - [ ] Health checks for services
  - [ ] Volume management for data persistence
- [ ] Production environment setup
  - [ ] Secure JWT_SECRET generation
  - [ ] HTTPS enforcement
  - [ ] CORS whitelist for production domains
  - [ ] Rate limiting configuration (production limits and thresholds)

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
- [ ] All backend tests passing
- [ ] All frontend tests passing
- [ ] All integration tests passing
- [ ] All E2E tests passing
- [ ] Code coverage >80% (backend and frontend)
- [ ] Documentation complete and accurate
- [ ] Security hardening complete

### Deployment Checklist

- [ ] Application runs in Docker with docker-compose
- [ ] Environment variables properly configured
- [ ] Database migrations work correctly
- [ ] Ready for production deployment

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
  - Email verification
  - Password reset flow
  - Two-factor authentication (2FA)
  - OAuth integration (Google, GitHub)
- **Mobile Applications**
  - React Native mobile app
  - Flutter mobile app
  - Progressive Web App (PWA)
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

### Infrastructure & DevOps

- **CI/CD Pipelines**
  - GitHub Actions workflows
  - Automated testing on PR
  - Automated deployment
  - Code quality checks (linting, coverage)
- **Cloud Deployment**
  - AWS deployment (ECS, RDS, S3)
  - Google Cloud Platform
  - Azure deployment
- **Infrastructure as Code**
  - Terraform configurations
  - CloudFormation templates
  - Kubernetes manifests
- **Monitoring & Observability**
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
- **Main README:** `/README.md`
- **API Specification:** `/shared/api-spec/openapi.yaml`
- **Database Schema:** `/shared/database/schema.sql`
- **Backend README:** `/backends/node/README.md`
- **Frontend README:** `/frontends/nextjs/README.md`
