# HabitCraft

[![CI](https://github.com/adamwolfers/habitcraft/actions/workflows/ci.yml/badge.svg)](https://github.com/adamwolfers/habitcraft/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/adamwolfers/habitcraft/graph/badge.svg)](https://codecov.io/gh/adamwolfers/habitcraft)

A free, open-source, self-hostable habit tracker, built test-first against an enforced API contract.

> **Rebuild in progress.** HabitCraft is being rebuilt side by side on Go + a React/Vite SPA, with Farley-style acceptance tests proving parity before cutover. See [Direction](#direction).

## Project Overview

HabitCraft helps users build and track daily habits with an intuitive calendar-based interface. The application demonstrates professional software development practices including comprehensive testing, API design, and production-ready architecture.

## Direction

HabitCraft is a free, open-source, self-hostable habit tracker. Its core packages are also designed to be embedded by other applications.

It is being **rebuilt side by side** on a new stack (decided 2026-10-10). The current stack and production keep running until the new one reaches parity, then the old one is deleted:

- **Backend:** a Go monolith whose server is generated from `shared/api-spec/openapi.yaml` (`oapi-codegen`), packaged as an embeddable Go module plus a standalone binary. `db/migrations/` carries over unchanged.
- **Web:** a React + Vite SPA, a static bundle served by the Go binary (no Node in production). It ships new views rather than copying the Next.js UI (decided 2026-10-11):
  - **Today** (the default): the active habits not yet done today. A completed habit leaves the list, and a collapsed "Completed today (N)" row at the bottom expands to list them, where a completion can be undone.
  - **Dots**: one compact grid per habit, a dot per day running back up to a year. Filled means done, so consistency shows at a glance.
  - **Habit detail**: a month calendar for backfilling past days and adding notes, plus completion rates over 30 and 365 days.
  - The per-habit Week/Month toggles are not carried over. Deliberately, **habits are daily only** (no other schedules) and there is **no streak tracking**.
- **Hosting:** a single VPS deployed with Kamal, replacing Cloud Run + Cloud SQL.
- **Testing:** acceptance-test-driven development using Dave Farley's four-layer model (test cases in domain language → DSL → protocol drivers → system), in TypeScript. The same acceptance suite proves the Node → Go parity. See [docs/TESTING.md](docs/TESTING.md#acceptance-tests-four-layer-atdd).
- **Native mobile apps** move out of this repository; the Expo app here is retired at cutover.

All planned work, including what comes after the rebuild, is tracked in [beads](./AGENTS.md): the rebuild is the `habitcraft-vxln` epic, and `bd ready` shows what's unblocked. There is no separate roadmap document.

## Technology Stack

- **Backend:** Node.js + Express
- **Frontend:** Next.js (React) + TypeScript + Tailwind CSS
- **Database:** PostgreSQL 14+
- **Testing:** Jest + Supertest (Backend), Jest + React Testing Library (Frontend)
- **Deployment:** Docker Compose (dev), GCP Cloud Run + Cloud SQL (prod)

## Project Structure

```
habittracker_fullstack/
├── backend/              # Node.js + Express backend
├── frontend/             # Next.js frontend
├── mobile/               # React Native (Expo) mobile app
├── db/                   # dbmate SQL migrations (schema source of truth)
│                         #   + schema.sql, generated from them
├── shared/               # Shared resources
│   ├── api-spec/         # OpenAPI spec: enforced against responses, and
│   │                     #   generates each client's types + validation limits
│   ├── database/         # Test fixtures / seed data
│   └── types/            # Superseded by api-spec/ codegen (habitcraft-brj)
├── docker-compose.yml    # Docker orchestration
├── GETTING_STARTED.md    # Quick start guide
└── AUTHENTICATION.md     # JWT authentication guide
```

## Features (v1.0)

**Authentication & Security:**
- User registration and login
- JWT-based authentication with secure token management
- Protected routes and API endpoints
- Automatic token refresh
- User data isolation
- User profile management (name, email updates)

**Habit Management:**
- Create, read, update, and delete habits
- Customize habit properties (name, description, color, icon)
- Filter habits by status (active/archived)

**Completion Tracking:**
- Mark habits complete for any date
- Track completion history
- Week-based calendar view with visual indicators
- Navigate through weeks to view history

**Architecture & Quality:**
- RESTful API following OpenAPI specification
- Test-Driven Development (TDD) approach
- Comprehensive test coverage
- Docker-based deployment

## Live Application

**Production:** https://www.habitcraft.org/

Create an account to get started.

---

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose

### Running with Docker

```bash
# Start all services (database + backend + frontend)
docker-compose up postgres backend frontend

# Access the application:
# - Frontend: http://localhost:3100
# - Backend API: http://localhost:3000
# - Database Admin: http://localhost:8080
```

**Seed the database** (one-off, after the services are up):

```bash
docker compose --profile seed run --rm db-seed
```

**Test User:**
- Email: `test@example.com`
- Password: `Test1234!`

### Manual Setup

See [GETTING_STARTED.md](./GETTING_STARTED.md) for detailed setup instructions.

## Documentation

- **[GETTING_STARTED.md](./GETTING_STARTED.md)** - Quick start and setup guide
- **[AUTHENTICATION.md](./AUTHENTICATION.md)** - JWT authentication implementation guide
- **[GCP Architecture](./docs/GCP_ARCHITECTURE.md)** - Production deployment guide (Cloud Run + Cloud SQL)
- **[API Specification](./shared/api-spec/openapi.yaml)** - The API contract: enforced against every backend integration response, generates the clients' types and limits, and gated for breaking changes ([how](./shared/api-spec/README.md))
- **[Database Migrations](./db/README.md)** - dbmate migrations, the source of truth for the schema
- **[Generated Schema](./db/schema.sql)** - `pg_dump` of those migrations, regenerated and diffed in CI

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register a new user
- `POST /api/v1/auth/login` - Login and receive JWT tokens
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - Logout and clear tokens

### Users
- `GET /api/v1/users/me` - Get current user profile
- `PUT /api/v1/users/me` - Update current user profile (name, email)

### Habits
- `POST /api/v1/habits` - Create a new habit
- `GET /api/v1/habits` - List all habits (with optional status filter)
- `PUT /api/v1/habits/:id` - Update a habit
- `DELETE /api/v1/habits/:id` - Delete a habit

### Completions
- `POST /api/v1/habits/:habitId/completions` - Mark habit complete
- `GET /api/v1/habits/:habitId/completions` - Get completions (with date filtering)
- `DELETE /api/v1/habits/:habitId/completions/:date` - Remove completion

See the [OpenAPI specification](./shared/api-spec/openapi.yaml) for complete API documentation.
It is enforced, not descriptive: the backend integration suite validates every
response against it and fails on any mismatch, so a shape documented there is a
shape the API actually returns. See [backend/openapi/README.md](./backend/openapi/README.md).

## Development

### Running Tests

```bash
# Run every gate CI runs — lint, typecheck, unit, integration, E2E (recommended)
./scripts/test-all.sh

# Backend unit tests
cd backend
npm test

# Backend integration tests (requires test database)
./scripts/test-db-start.sh
cd backend && npm run test:integration
./scripts/test-db-stop.sh

# Frontend unit tests
cd frontend
npm test

# Frontend E2E tests (requires test environment)
./scripts/test-db-start.sh
docker compose -f docker-compose.test.yml up -d
cd frontend && npm run test:e2e
docker compose -f docker-compose.test.yml down
./scripts/test-db-stop.sh
```

### Development Approach

This project follows:
- **Acceptance-Test-Driven Development (ATDD)** - Each user-facing change starts with a failing acceptance test in domain language, then unit TDD underneath ([docs/TESTING.md](./docs/TESTING.md#acceptance-tests-four-layer-atdd))
- **Clean Architecture** - Separation of concerns and clear boundaries
- **RESTful API Design** - Consistent, predictable endpoints
- **OpenAPI Compliance** - API specification as the source of truth

## Version 1.0 Scope

- User authentication and authorization
- Habit management with full CRUD operations
- Completion tracking with calendar interface
- Acceptance test coverage
- Production-ready deployment

See [Direction](#direction) for where it goes next.

## License

[GNU AGPL-3.0](./LICENSE) (AGPL-3.0-only), from 2026-10-10 onwards. Earlier commits were published while this README said "MIT License". Contributions need a CLA; see [CONTRIBUTING.md](./CONTRIBUTING.md).
