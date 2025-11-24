# HabitCraft - Node.js Backend

Node.js + Express implementation of the HabitCraft API.

## Status

✅ **Core features complete** - Full habit CRUD, completion tracking, and JWT authentication implemented

### Completed Features
- Express app setup with comprehensive testing (Jest + Supertest)
- PostgreSQL database connection with connection pooling
- JWT authentication with HttpOnly cookies and refresh tokens
- CORS support with credentials for frontend integration
- Full habit CRUD operations (Create, Read, Update, Delete)
- Completion tracking (Create, Read, Delete with date filtering)
- TDD approach with comprehensive test coverage

### Upcoming
See [PROJECT_PLAN.md](../../PROJECT_PLAN.md) for the v1.0 roadmap including JWT authentication, integration tests, and production deployment.

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js 5
- **Language**: JavaScript (CommonJS)
- **Database**: PostgreSQL with pg (node-postgres)
- **Testing**: Jest + Supertest
- **CORS**: cors middleware with credentials support
- **Environment**: dotenv
- **Authentication**: JWT with HttpOnly cookies and refresh tokens

## Prerequisites

- Node.js 18 or higher
- npm or yarn
- PostgreSQL 14+ (or use Docker)

## Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Run database migrations (when implemented)
npm run migrate

# Start development server
npm start
```

## Development

```bash
# Run in development mode with auto-reload
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run linter
npm run lint
```

## Environment Variables

Create a `.env` file in this directory:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://habituser:habitpass@localhost:5432/habitcraft
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d
```

## API Endpoints

### Habits
- `POST /api/v1/habits` - Create habit
- `GET /api/v1/habits` - List habits (supports ?status=active|archived filter)
- `PUT /api/v1/habits/:id` - Update habit
- `DELETE /api/v1/habits/:id` - Delete habit

### Completions
- `POST /api/v1/habits/:habitId/completions` - Mark habit complete
- `GET /api/v1/habits/:habitId/completions` - List completions (?startDate & ?endDate filters)
- `DELETE /api/v1/habits/:habitId/completions/:date` - Remove completion

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login and receive JWT tokens
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - Logout and clear tokens
- `GET /api/v1/auth/me` - Get current user profile

See the [OpenAPI specification](../../shared/api-spec/openapi.yaml) for complete API documentation.

## Project Structure

```
backends/node/
├── app.js                          # Express app configuration
├── server.js                       # Server entry point
├── app.test.js                     # App-level tests
├── db/                            # Database layer
│   ├── pool.js                    # PostgreSQL connection pool
│   ├── pool.test.js              # Pool tests
│   ├── config.js                 # Database configuration
│   ├── config.test.js            # Config tests
│   └── README.md                 # Database documentation
├── routes/                        # API route handlers
│   ├── auth.js                   # Authentication endpoints
│   ├── auth.test.js              # Authentication tests
│   ├── habits.js                 # Habit CRUD endpoints
│   ├── habits.test.js            # Habit endpoint tests
│   ├── completions.js            # Completion tracking endpoints
│   └── completions.test.js       # Completion endpoint tests
├── middleware/                    # Express middleware
│   ├── jwtAuth.js                # JWT authentication middleware
│   └── jwtAuth.test.js           # JWT middleware tests
├── validators/                    # Input validation
│   ├── habitValidator.js         # Habit input validation
│   └── habitValidator.test.js    # Validation tests
├── package.json                   # Dependencies and scripts
└── README.md                      # This file
```

## Testing

This project follows Test-Driven Development (TDD):

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- routes/auth.test.js
npm test -- routes/habits.test.js
npm test -- routes/completions.test.js
npm test -- middleware/jwtAuth.test.js
npm test -- validators/habitValidator.test.js
```

Comprehensive test coverage includes app configuration, database layer, all API endpoints, and error handling.

**Note on `server.js` coverage:**
The `server.js` file (entry point) has 0% coverage by design. This file only contains server startup code (`app.listen()`) and is intentionally separated from the application logic in `app.js`. Tests import `app.js` directly and use Supertest to test routes without starting a real HTTP server. This is a common pattern in Express applications and allows for faster, more isolated unit tests.

## Docker

```bash
# Build image
docker build -t habitcraft-node .

# Run container
docker run -p 3000:3000 \
  -e DATABASE_URL=postgresql://habituser:habitpass@postgres:5432/habitcraft \
  habitcraft-node

# Or use docker-compose from root
cd ../..
docker-compose up backend-node
```

## Development Workflow

This project follows TDD:
1. Write a failing test
2. Implement minimum code to pass the test
3. Refactor if needed

For the complete development roadmap, see [PROJECT_PLAN.md](../../PROJECT_PLAN.md).
