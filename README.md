# HabitCraft

A full-stack habit tracking application built with modern web technologies, following Test-Driven Development (TDD) and clean architecture principles.

## Project Overview

HabitCraft helps users build and track daily habits with an intuitive calendar-based interface. The application demonstrates professional software development practices including comprehensive testing, API design, and production-ready architecture.

## Technology Stack

- **Backend:** Node.js + Express
- **Frontend:** Next.js (React) + TypeScript + Tailwind CSS
- **Database:** PostgreSQL 14+
- **Testing:** Jest + Supertest (Backend), Jest + React Testing Library (Frontend)
- **Deployment:** Docker Compose

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
└── GETTING_STARTED.md    # Quick start guide
```

## Current Features

- **Habit Management:** Full CRUD operations (create, read, update, delete)
- **Completion Tracking:** Mark habits complete for any date
- **Calendar View:** Week-based calendar with visual completion indicators
- **Week Navigation:** Navigate through weeks to view history
- **User Isolation:** Mock authentication with user-based data separation
- **RESTful API:** Clean API design following OpenAPI specification
- **Comprehensive Testing:** TDD approach with full test coverage

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

### Manual Setup

See [GETTING_STARTED.md](./GETTING_STARTED.md) for detailed setup instructions.

## Documentation

- **[GETTING_STARTED.md](./GETTING_STARTED.md)** - Quick start and setup guide
- **[PROJECT_PLAN.md](./PROJECT_PLAN.md)** - Complete development roadmap and task list
- **[AUTHENTICATION.md](./AUTHENTICATION.md)** - JWT authentication implementation guide
- **[API Specification](./shared/api-spec/openapi.yaml)** - OpenAPI/Swagger specification
- **[Database Schema](./shared/database/schema.sql)** - PostgreSQL schema and migrations

## API Endpoints

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
# Backend tests
cd backends/node
npm test

# Frontend tests
cd frontends/nextjs
npm test
```

### Development Approach

This project follows:
- **Test-Driven Development (TDD)** - Write tests first, then implement
- **Clean Architecture** - Separation of concerns and clear boundaries
- **RESTful API Design** - Consistent, predictable endpoints
- **OpenAPI Compliance** - API specification as the source of truth

## Roadmap

**Version 1.0 Goals:**
- JWT authentication (user registration, login, token refresh)
- Full habit CRUD with authentication
- Completion tracking
- Acceptance test coverage
- Production deployment

See [PROJECT_PLAN.md](./PROJECT_PLAN.md) for the complete roadmap.

## License

MIT License
