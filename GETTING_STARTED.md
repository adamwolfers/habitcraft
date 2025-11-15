# Getting Started with Habit Tracker

Quick start guide for the Habit Tracker polyglot learning project.

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

### Option 2: Next.js Frontend (Fully Implemented)

The Next.js frontend is fully implemented and ready to use.

```bash
# 1. Navigate to the Next.js frontend
cd frontends/nextjs

# 2. Install dependencies (if not already done)
npm install

# 3. Start the development server
npm run dev

# 4. Open browser to http://localhost:3000
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
│   ├── node/             # ✅ Node.js (Hello World implemented)
│   ├── python/           # 📅 Planned
│   ├── golang/           # 📅 Planned
│   └── java/             # 📅 Planned
├── frontends/            # Multiple frontend implementations
│   ├── nextjs/           # ✅ Fully implemented
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

**Status:** PostgreSQL 14.20 running in Docker with schema loaded (users, habits, completions tables)

**View Database:** Adminer is running at http://localhost:8080
- Login with: habituser / habitpass / habittracker

Manual setup:
```bash
# Create database
createdb habittracker

# Run schema
psql -d habittracker -f shared/database/schema.sql
```

### 3. Choose Your Development Path

**Path A: Continue Node.js Backend**
- Implement database connection
- Add user authentication
- Implement CRUD endpoints
- Follow the TDD approach

**Path B: Explore Next.js Frontend**
- Review the existing implementation
- Connect to a backend API
- Customize the UI

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
psql postgresql://habituser:habitpass@localhost:5432/habittracker

# View schema
psql postgresql://habituser:habitpass@localhost:5432/habittracker -c "\dt"

# Use Adminer (web UI)
docker-compose up adminer
# Then visit http://localhost:8080
```

### Running Tests

```bash
# Node.js backend
cd backends/node
npm test

# Next.js frontend
cd frontends/nextjs
npm test
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
psql postgresql://habituser:habitpass@localhost:5432/habittracker -c "SELECT 1"
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
