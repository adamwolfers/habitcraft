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
- Rate limiting on authentication endpoints (express-rate-limit)
- Input sanitization for XSS prevention (xss library)
- Security headers via helmet (CSP, HSTS, X-Frame-Options, etc.)
- Security event logging (failed logins, auth failures, token refresh)
- TDD approach with comprehensive test coverage

See [PROJECT_PLAN.md](../../PROJECT_PLAN.md) for the complete project roadmap.

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
# Edit .env with your database credentials

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
```

## Environment Variables

Create a `.env` file in this directory:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://habituser:habitpass@localhost:5432/habitcraft
FRONTEND_URL=http://localhost:3100
JWT_SECRET=your-secret-key-change-in-production
```

**Note:** Token expiration times are hardcoded (access token: 15 minutes, refresh token: 7 days) in `routes/auth.js`.

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

### Users
- `GET /api/v1/users/me` - Get current user profile

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
│   ├── users.js                  # User profile endpoints
│   ├── users.test.js             # User endpoint tests
│   ├── habits.js                 # Habit CRUD endpoints
│   ├── habits.test.js            # Habit endpoint tests
│   ├── completions.js            # Completion tracking endpoints
│   └── completions.test.js       # Completion endpoint tests
├── middleware/                    # Express middleware
│   ├── jwtAuth.js                # JWT authentication middleware
│   ├── jwtAuth.test.js           # JWT middleware tests
│   ├── rateLimiter.js            # Rate limiting for auth endpoints
│   ├── rateLimiter.test.js       # Rate limiter tests
│   ├── sanitize.js               # Input sanitization (XSS prevention)
│   ├── sanitize.test.js          # Sanitization tests
│   └── securityHeaders.test.js   # Security headers tests (helmet)
├── validators/                    # Input validation
│   ├── habitValidator.js         # Habit input validation
│   └── habitValidator.test.js    # Validation tests
├── utils/                         # Utility modules
│   ├── securityLogger.js         # Security event logging
│   └── securityLogger.test.js    # Security logger tests
├── integration/                   # Integration tests (real database)
│   ├── setup.js                  # Test database setup utilities
│   ├── auth.test.js              # Authentication flow tests
│   └── habits.test.js            # Habit CRUD integration tests
├── package.json                   # Dependencies and scripts
└── README.md                      # This file
```

## Testing

This project follows Test-Driven Development (TDD):

```bash
# Run unit tests (mocked database)
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

### Integration Tests

Integration tests run against a real test database:

```bash
# Start the test database (from project root)
./scripts/test-db-start.sh

# Run integration tests
npm run test:integration

# Stop the test database when done
./scripts/test-db-stop.sh
```

Integration tests cover:
- **Authentication flows** (14 tests): Registration, login, token refresh, logout, user isolation
- **Habit CRUD operations** (28 tests): Full CRUD cycle, user isolation, cascading deletes, validation

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
