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
- [x] Mock authentication middleware (X-User-Id header for development)
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
  - [ ] Remove X-User-Id fallback once frontend JWT auth is complete

#### Habit Management
- [x] **POST /api/v1/habits** - Create habit
  - [x] Input validation (name, frequency, color, icon)
  - [x] User isolation enforcement
  - [x] Tests with mock auth
- [x] **GET /api/v1/habits** - List habits
  - [x] Optional status filter (active/archived)
  - [x] User isolation
  - [x] Tests with mock auth
- [x] **PUT /api/v1/habits/:id** - Update habit
  - [x] Field updates (name, description, frequency, targetDays, color, icon, status)
  - [x] User ownership enforcement
  - [x] Tests with mock auth
- [x] **DELETE /api/v1/habits/:id** - Delete habit
  - [x] User ownership enforcement
  - [x] Tests with mock auth

#### Completion Tracking
- [x] **POST /api/v1/habits/:habitId/completions** - Mark complete
  - [x] Habit ownership validation
  - [x] Duplicate prevention (409 Conflict)
  - [x] Date format validation
  - [x] Tests with mock auth
- [x] **GET /api/v1/habits/:habitId/completions** - List completions
  - [x] Date range filtering (startDate, endDate)
  - [x] Habit ownership validation
  - [x] Tests with mock auth
- [x] **DELETE /api/v1/habits/:habitId/completions/:date** - Remove completion
  - [x] Habit ownership validation
  - [x] Date format validation
  - [x] Tests with mock auth

### Frontend - Next.js + React

#### Foundation
- [x] Next.js project setup with TypeScript
- [x] Tailwind CSS configuration
- [x] Testing framework (Jest + React Testing Library)
- [x] Environment variable configuration

#### Authentication & Authorization
- [ ] **Auth Context (context/AuthContext.tsx)**
  - [ ] Write tests (login, logout, register, token persistence, loading states)
  - [ ] Implement AuthContext with user state management
  - [ ] Token storage in localStorage
  - [ ] isLoading and isAuthenticated flags
- [ ] **Custom Auth Hooks**
  - [ ] Write tests for useAuth() hook
  - [ ] Write tests for useRequireAuth() hook (redirect logic)
  - [ ] Implement hooks
- [ ] **API Client JWT Integration (lib/api.ts)**
  - [ ] Write tests (Authorization header, 401 interception, token refresh, retry logic)
  - [ ] Add Authorization header injection
  - [ ] Implement 401 interceptor
  - [ ] Automatic token refresh on expired access token
  - [ ] Request retry with new token
  - [ ] Redirect to login on refresh failure
- [ ] **Login Page (app/login/page.tsx)**
  - [ ] Write tests (form rendering, validation, loading, errors, redirect, links)
  - [ ] Implement email/password form
  - [ ] Form validation
  - [ ] Error handling and loading states
- [ ] **Registration Page (app/register/page.tsx)**
  - [ ] Write tests (form rendering, validation, password strength, loading, errors)
  - [ ] Implement email/password/name form
  - [ ] Client-side validation
  - [ ] Password strength indicator
- [ ] **Protected Routes**
  - [ ] Write tests (loading state, redirect, authenticated access)
  - [ ] Implement ProtectedRoute wrapper component
  - [ ] Wrap main app pages
- [ ] **Logout Functionality**
  - [ ] Write tests (clear state, clear localStorage, redirect)
  - [ ] Add logout button to UI (header/navigation)
  - [ ] Implement logout flow

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
  - [x] Update habit functionality
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
- [x] **Date Utilities (utils/dateUtils.ts)**
  - [x] getCalendarWeek() function
  - [x] Week calculation logic
- [ ] **UI Polish**
  - [ ] Loading spinners for data fetches
  - [ ] Disabled states during submission
  - [ ] Loading skeletons for habit list
  - [ ] Toast notifications for errors
  - [ ] Inline validation error messages
  - [ ] Network error recovery UI

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

- [ ] **Update README.md**
  - [ ] v1 feature list
  - [ ] Remove polyglot/multi-backend references
  - [ ] Update roadmap with completed work
  - [ ] Current technology stack
- [ ] **Update GETTING_STARTED.md**
  - [ ] Remove mock auth references
  - [ ] Add JWT authentication setup steps
  - [ ] Update quick start instructions
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
- [ ] **Update Backend README**
  - [ ] Remove mock auth references
  - [ ] Document JWT configuration
  - [ ] Update endpoint list
- [ ] **Create DEPLOYMENT.md**
  - [ ] Environment setup checklist
  - [ ] Database migration steps
  - [ ] SSL/TLS configuration
  - [ ] Monitoring recommendations
  - [ ] Backup procedures

### Security & Deployment

#### Security Hardening
- [ ] Rate limiting on auth endpoints (express-rate-limit)
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
  - [ ] Rate limiting configuration

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

| Language | Framework | ORM/Database | Testing | Status |
|----------|-----------|--------------|---------|--------|
| Node.js  | Express   | pg (node-postgres) | Jest + Supertest | ✅ In Progress |
| Python   | FastAPI   | SQLAlchemy   | Pytest | 🔜 Planned |
| Go       | Gin       | GORM         | testing | 🔜 Planned |
| Java     | Spring Boot | JPA/Hibernate | JUnit | 🔜 Planned |

### Additional Frontend Implementations

| Framework | State Management | Styling | Testing | Status |
|-----------|-----------------|---------|---------|--------|
| Next.js   | React Hooks     | Tailwind CSS | Jest + RTL | ✅ In Progress |
| React     | Redux/Zustand   | Styled Components | Jest + RTL | 🔜 Planned |
| Vue       | Pinia           | Tailwind CSS | Vitest | 🔜 Planned |

### Feature Enhancements
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
  - Vercel for frontend
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

---

**Last Updated:** 2025-11-20
**Current Status:** User registration and login complete, continuing JWT authentication
**Next Milestone:** v1.0 Release
