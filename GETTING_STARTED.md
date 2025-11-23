# Getting Started with HabitCraft

Quick start guide for running HabitCraft locally.

## Quick Start Options

### Option 1: Node.js Backend

The Node.js backend provides full habit tracking API with CRUD operations.

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
├── PROJECT_PLAN.md       # Detailed development roadmap
└── README.md             # Project overview
```

## Setup Steps

### 1. Set Up Environment Variables

```bash
# Copy the example env file
cp .env.example .env

# Edit .env and update with your values (especially JWT_SECRET)
```

### 2. Set Up Database

Using Docker (recommended):

```bash
# Start just the database
docker-compose up postgres

# Or start it in the background
docker-compose up -d postgres
```

The database includes:

- Schema with users, habits, and completions tables
- Seed data with a demo user and sample habits
- Adminer web UI at http://localhost:8080
  - Login: habituser / habitpass / habitcraft
  - Demo User 1 ID: `123e4567-e89b-12d3-a456-426614174000`
  - Demo User 1 Email: `demo@example.com`
  - Demo User 1 Password: `demo123`
  - Demo User 2 ID: `8353071d-5c46-4414-a6a2-19d2f398e5a3`
  - Demo User 2 Email: `demo2@example.com`
  - Demo User 2 Password: `demo1234`

Manual setup:

```bash
# Create database
createdb habitcraft

# Run schema
psql -d habitcraft -f shared/database/schema.sql
```

## Current Features

### Backend (Node.js + Express)

- Full habit CRUD operations (Create, Read, Update, Delete)
- Completion tracking (mark complete, view history, remove)
- Mock authentication (X-User-Id header for development)
- CORS support for frontend integration
- PostgreSQL database with connection pooling

### Frontend (Next.js + React)

- Habit management UI (create, update, delete)
- Calendar week view with completion tracking
- Week navigation (previous/next)
- Optimistic UI updates
- Fully connected to backend API

## What's Next

See [PROJECT_PLAN.md](PROJECT_PLAN.md) for the complete development roadmap, including:

- JWT authentication implementation
- Acceptance testing
- Production deployment preparation

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
# Node.js backend
cd backends/node
npm test

# Run specific test file
npm test -- routes/habits.test.js
npm test -- routes/completions.test.js

# Next.js frontend
cd frontends/nextjs
npm test

# Run specific test file
npm test -- lib/api.test.ts
npm test -- hooks/useHabits.test.ts
```

### API Documentation

The OpenAPI specification is available at:

- File: `shared/api-spec/openapi.yaml`
- View online: Use [Swagger Editor](https://editor.swagger.io/) and paste the file contents

## Documentation

- **[PROJECT_PLAN.md](PROJECT_PLAN.md)** - Complete development roadmap and task list
- **[AUTHENTICATION.md](AUTHENTICATION.md)** - JWT authentication implementation guide
- **[README.md](README.md)** - Project overview
- **[backends/node/README.md](backends/node/README.md)** - Backend setup and API reference
- **[shared/api-spec/openapi.yaml](shared/api-spec/openapi.yaml)** - OpenAPI specification

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
- **Email:** `demo@example.com`
- **Password:** `demo123`
- **Sample Habits:** 3 pre-created habits

You can use these credentials to test the login page at http://localhost:3100/login

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

---

For detailed development plans and roadmap, see [PROJECT_PLAN.md](PROJECT_PLAN.md).
