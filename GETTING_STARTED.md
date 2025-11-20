# Getting Started with HabitCraft

Quick start guide for the HabitCraft polyglot learning project.

## Quick Start Options

### Option 1: Node.js Backend (Currently Implemented)

The Node.js backend has a basic "Hello World" API ready to go.

```bash
# 1. Navigate to the Node.js backend
cd backends/node

# 2. Install dependencies
npm install

# 3. Run tests to verify everything works
npm test

# 4. Start the server
npm start

# 5. Test the endpoint
curl http://localhost:3000/hello
# Should return: {"message":"Hello World!"}
```

### Option 2: Next.js Frontend (Connected to Backend API)

The Next.js frontend is connected to the Node.js backend API.

```bash
# 1. Navigate to the Next.js frontend
cd frontends/nextjs

# 2. Install dependencies (if not already done)
npm install

# 3. Copy environment variables
cp .env.example .env.local

# 4. Start the development server
npm run dev

# 5. Open browser to http://localhost:3000
# Note: Make sure the backend is running on port 3000
```

### Option 3: Full Stack with Docker

Run everything together with Docker Compose:

```bash
# From the project root

# 1. Start database + Node.js backend + Next.js frontend
docker-compose up postgres backend-node frontend-nextjs

# 2. Access services:
# - Frontend: http://localhost:3100
# - Backend API: http://localhost:3000
# - Database Admin (Adminer): http://localhost:8080
```

## Project Structure Overview

```
habittracker_fullstack/
├── backends/              # Multiple backend implementations
│   ├── node/             # ✅ Node.js (CRUD endpoints + CORS)
│   ├── python/           # 📅 Planned
│   ├── golang/           # 📅 Planned
│   └── java/             # 📅 Planned
├── frontends/            # Multiple frontend implementations
│   ├── nextjs/           # ✅ Connected to backend API
│   ├── react/            # 📅 Planned
│   └── vue/              # 📅 Planned
├── infrastructure/       # Deployment configs
│   └── terraform/        # 📅 Planned
├── shared/               # Shared resources
│   ├── api-spec/         # ✅ OpenAPI specification
│   ├── database/         # ✅ PostgreSQL schema
│   └── types/            # ✅ Shared type definitions
├── docker-compose.yml    # ✅ Orchestration config
├── .env.example          # ✅ Environment variables template
└── README.md             # ✅ Main documentation
```

## Next Steps

### 1. Set Up Environment Variables ✅ COMPLETED

```bash
# Copy the example env file
cp .env.example .env

# Edit .env and update with your values (especially JWT_SECRET)
```

**Status:** `.env` file created with secure JWT_SECRET

### 2. Set Up Database ✅ COMPLETED

Using Docker (recommended):

```bash
# Start just the database
docker-compose up postgres

# Or start it in the background
docker-compose up -d postgres
```

**Status:** PostgreSQL 14.20 running in Docker with:
- ✅ Schema loaded (users, habits, completions tables)
- ✅ Seed data loaded automatically:
  - Demo user (ID: `123e4567-e89b-12d3-a456-426614174000`)
  - 3 sample habits (Morning Exercise, Read Books, Meditation)

**View Database:** Adminer is running at http://localhost:8080

- Login with: habituser / habitpass / habitcraft
- Demo user email: demo@example.com

Manual setup:

```bash
# Create database
createdb habitcraft

# Run schema
psql -d habitcraft -f shared/database/schema.sql
```

### 3. Choose Your Development Path

**Path A: Continue Node.js Backend** ✅ CRUD Read Operations Complete!

- ✅ Implement database connection (COMPLETED - see `backends/node/db/`)
- ✅ Implement habit creation endpoint (COMPLETED - POST /api/v1/habits)
  - Mock authentication middleware using X-User-Id header
  - Comprehensive input validation
  - 9 passing tests following TDD approach
- ✅ Implement habit read endpoint (COMPLETED - GET /api/v1/habits)
  - Returns all habits for authenticated user
  - Supports optional status filter (active/archived)
  - User isolation (only returns user's own habits)
  - 6 passing tests following TDD approach
- ✅ Add CORS support (COMPLETED - see `backends/node/app.js`)
  - Enables frontend to call backend from different port
  - Required for Next.js (localhost:3100) to call API (localhost:3000)
- ✅ Implement habit update endpoint (COMPLETED - PUT /api/v1/habits/:id)
  - Updates habit fields (name, description, frequency, targetDays, color, icon, status)
  - Validates habit ID format and input fields
  - Enforces user ownership (users can only update their own habits)
  - Returns 200 with updated habit, 404 if not found, 400 for invalid input
  - Supports status changes (active/archived)
  - 12 passing tests following TDD approach
- ✅ Implement habit delete endpoint (COMPLETED - DELETE /api/v1/habits/:id)
  - Validates habit ID format
  - Enforces user ownership (users can only delete their own habits)
  - Returns 204 on success, 404 if not found, 400 for invalid format
  - 6 passing tests following TDD approach
- ✅ Implement completions endpoints (COMPLETED - TDD approach)
  - POST /api/v1/habits/:habitId/completions - Create completion
  - GET /api/v1/habits/:habitId/completions - Get completions (with date filtering)
  - DELETE /api/v1/habits/:habitId/completions/:date - Remove completion
  - 17 passing tests for completions API
  - Validates habit ownership and date formats
  - Handles duplicate completions (409 Conflict)
- 📋 Replace mock auth with real JWT authentication
- 📋 Continue following the TDD approach
- **TODO:** Add acceptance/integration tests that test against real database
  - Current tests use mocks for fast unit testing
  - Need end-to-end tests to verify actual database integration
  - Consider using a separate test database or test containers

**Path B: Next.js Frontend Integration** ✅ Connected to Backend!

- ✅ Connect frontend to backend API (COMPLETED - TDD approach)
  - Created API client service (`frontends/nextjs/lib/api.ts`)
  - 7 passing unit tests for API client
  - Updated type definitions to match backend schema
  - Updated useHabits hook to fetch from API instead of localStorage
  - 6 passing unit tests for useHabits hook
  - Environment variable configuration for API base URL
- ✅ Display habits from database (COMPLETED)
  - Shows frequency, status, target days, icons
  - Read-only view of habits from backend
- ✅ Implement habit creation in frontend (COMPLETED - TDD approach)
  - Connected AddHabitForm to POST /api/v1/habits endpoint
  - Implemented createHabit API function (`frontends/nextjs/lib/api.ts`)
  - Updated useHabits hook to support creating habits
  - 9 passing unit tests for useHabits hook (including 3 new createHabit tests)
  - Habits immediately appear in UI after creation without refresh
- ✅ Implement completions API client (COMPLETED - TDD approach)
  - fetchCompletions, createCompletion, deleteCompletion functions
  - Added Completion type definition
  - 9 new passing tests for completions API
  - Total: 16 API tests passing (7 habits + 9 completions)
  - Supports date range filtering
- ✅ Implement completion tracking in useHabits hook (COMPLETED - TDD approach)
  - toggleCompletion and isHabitCompletedOnDate functions
  - Fetches completions for all habits on mount
  - Optimistic UI updates with local state management
  - 6 new passing tests for completion tracking
  - Total: 15 useHabits tests passing
  - Fixed date comparison bug (stripped timestamps)
- ✅ Restore full HabitCard UI with completion tracking (COMPLETED)
  - Daily completion toggles (last 7 days)
  - Visual completion bubbles with checkmarks
  - Color-coded completion indicators
  - Click to toggle completion status
  - Fully integrated with backend API
  - Fixed timezone handling for date parsing
- ✅ Implement habit deletion in frontend (COMPLETED - TDD approach)
  - Implemented deleteHabit API function (`frontends/nextjs/lib/api.ts`)
  - Added deleteHabit function to useHabits hook
  - Wired delete button to UI in page.tsx
  - Removes habit from local state
  - Removes associated completions when habit is deleted
  - 12 new passing tests (4 API + 4 hook + 4 page tests)
  - Total: 72 frontend tests passing
  - Proper error handling for delete failures (400, 401, 404)
  - Delete button integrated into HabitCard component
- 📋 Add loading states and error handling to UI
  - Show loading spinner while fetching
  - Display user-friendly error messages

**Path C: Start Another Backend**

- Choose Python, Go, or Java
- Follow the same API spec
- Compare implementation approaches

**Path D: Start Another Frontend**

- Choose React or Vue
- Implement the same features
- Compare framework approaches

## Useful Commands

### Database Management

```bash
# Access database with psql
psql postgresql://habituser:habitpass@localhost:5432/habitcraft

# View schema
psql postgresql://habituser:habitpass@localhost:5432/habitcraft -c "\dt"

# Use Adminer (web UI)
docker-compose up adminer
# Then visit http://localhost:8080
```

### Running Tests

```bash
# Node.js backend (62 tests)
cd backends/node
npm test

# Run specific test file
npm test -- routes/habits.test.js
npm test -- routes/completions.test.js

# Next.js frontend (72 tests passing)
cd frontends/nextjs
npm test

# Run specific test file
npm test -- lib/api.test.ts
npm test -- hooks/useHabits.test.ts
npm test -- app/page.test.tsx
```

### API Documentation

The OpenAPI specification is available at:

- File: `shared/api-spec/openapi.yaml`
- View online: Use [Swagger Editor](https://editor.swagger.io/) and paste the file contents

## Learning Resources

Each backend/frontend directory has its own README with:

- Tech stack details
- Installation instructions
- Development commands
- Project structure

Check these files:

- `backends/node/README.md`
- `backends/python/README.md`
- `backends/golang/README.md`
- `backends/java/README.md`
- `frontends/nextjs/README.md`
- `frontends/react/README.md`
- `frontends/vue/README.md`

## Common Issues

### Port Already in Use

If you get "port already in use" errors:

```bash
# Change ports in docker-compose.yml or use different ports
# For example, change "3000:3000" to "3001:3000"
```

### Database Connection Issues

```bash
# Make sure PostgreSQL is running
docker-compose ps

# Check database logs
docker-compose logs postgres

# Verify connection
psql postgresql://habituser:habitpass@localhost:5432/habitcraft -c "SELECT 1"
```

### CORS Issues (Frontend Can't Access Backend)

If the frontend shows "No habits found" but the backend has data:

```bash
# 1. Verify backend has CORS enabled
curl -i http://localhost:3000/hello | grep "Access-Control"
# Should show: Access-Control-Allow-Origin: *

# 2. Check browser console for CORS errors
# Open DevTools (F12) → Console tab

# 3. Verify backend is accessible
curl -H "X-User-Id: 123e4567-e89b-12d3-a456-426614174000" \
  http://localhost:3000/api/v1/habits

# 4. If CORS header is missing, restart backend
docker-compose restart backend-node
```

### Working with the Demo User

The database is automatically seeded with a demo user on first startup:
- **User ID:** `123e4567-e89b-12d3-a456-426614174000`
- **Email:** demo@example.com
- **Sample Habits:** 3 pre-created habits

All API requests in development use the `X-User-Id` header for authentication:

```bash
# Create additional test habits via API
curl -X POST http://localhost:3000/api/v1/habits \
  -H "Content-Type: application/json" \
  -H "X-User-Id: 123e4567-e89b-12d3-a456-426614174000" \
  -d '{
    "name": "Morning Exercise",
    "frequency": "daily",
    "color": "#3B82F6",
    "icon": "🏃"
  }'
```

## Contributing to This Project

As you implement features:

1. ✅ Write tests first (TDD)
2. ✅ Follow the OpenAPI spec
3. ✅ Update relevant READMEs
4. ✅ Keep type definitions in sync
5. ✅ Document any new setup steps

## Questions?

- Check individual README files for specific tech stacks
- Review the OpenAPI spec for API details
- Look at the database schema for data structure
- Refer to the shared types for data models

---

Happy coding! 🚀
