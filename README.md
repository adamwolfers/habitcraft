# HabitCraft

A full-stack habit tracking application built with modern web technologies, following Test-Driven Development (TDD) and clean architecture principles.

## Project Overview

HabitCraft helps users build and track daily habits with an intuitive calendar-based interface. The application demonstrates professional software development practices including comprehensive testing, API design, and production-ready architecture.

## Technology Stack

- **Backend:** Node.js + Express
- **Frontend:** Next.js (React) + TypeScript + Tailwind CSS
- **Database:** PostgreSQL 14+
- **Testing:** Jest + Supertest (Backend), Jest + React Testing Library (Frontend)
- **Deployment:** Docker Compose (dev), AWS Lightsail Containers + RDS (prod)

## Project Structure

```
habittracker_fullstack/
├── backends/node/        # Node.js + Express backend
├── frontends/nextjs/     # Next.js frontend
├── shared/               # Shared resources
│   ├── api-spec/         # OpenAPI specification
│   ├── database/         # PostgreSQL schema and migrations
│   └── types/            # Shared type definitions
├── docker-compose.yml    # Docker orchestration
├── PROJECT_PLAN.md       # Development roadmap
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

## Live Demo

**Production:** https://habitcraft-frontend.yxzyhs04ajgq0.us-west-2.cs.amazonlightsail.com/

Create an account or use the demo credentials below to explore.

---

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose

### Running with Docker

```bash
# Start all services (database + backend + frontend)
docker-compose up postgres backend-node frontend-nextjs

# Access the application:
# - Frontend: http://localhost:3100
# - Backend API: http://localhost:3000
# - Database Admin: http://localhost:8080
```

**Demo User:**
- Email: `demo@example.com`
- Password: `demo123`

### Manual Setup

See [GETTING_STARTED.md](./GETTING_STARTED.md) for detailed setup instructions.

## Documentation

- **[GETTING_STARTED.md](./GETTING_STARTED.md)** - Quick start and setup guide
- **[PROJECT_PLAN.md](./PROJECT_PLAN.md)** - Complete development roadmap and task list
- **[AUTHENTICATION.md](./AUTHENTICATION.md)** - JWT authentication implementation guide
- **[AWS Architecture](./docs/AWS_ARCHITECTURE.md)** - Production deployment guide (Lightsail + RDS)
- **[API Specification](./shared/api-spec/openapi.yaml)** - OpenAPI/Swagger specification
- **[Database Schema](./shared/database/schema.sql)** - PostgreSQL schema and migrations

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register a new user
- `POST /api/v1/auth/login` - Login and receive JWT tokens
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - Logout and clear tokens

### Users
- `GET /api/v1/users/me` - Get current user profile

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

## Development

### Running Tests

```bash
# Run all tests sequentially (recommended)
./scripts/test-all.sh

# Backend unit tests
cd backends/node
npm test

# Backend integration tests (requires test database)
./scripts/test-db-start.sh
cd backends/node && npm run test:integration
./scripts/test-db-stop.sh

# Frontend unit tests
cd frontends/nextjs
npm test

# Frontend E2E tests (requires test environment)
./scripts/test-db-start.sh
docker compose -f docker-compose.test.yml up -d
cd frontends/nextjs && npm run test:e2e
docker compose -f docker-compose.test.yml down
./scripts/test-db-stop.sh
```

### Development Approach

This project follows:
- **Test-Driven Development (TDD)** - Write tests first, then implement
- **Clean Architecture** - Separation of concerns and clear boundaries
- **RESTful API Design** - Consistent, predictable endpoints
- **OpenAPI Compliance** - API specification as the source of truth

## Version 1.0 Scope

- User authentication and authorization
- Habit management with full CRUD operations
- Completion tracking with calendar interface
- Acceptance test coverage
- Production-ready deployment

See [PROJECT_PLAN.md](./PROJECT_PLAN.md) for detailed development status and roadmap.

## License

MIT License
