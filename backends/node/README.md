# HabitCraft - Node.js Backend

Node.js + Express implementation of the HabitCraft API.

## Status

🚧 **In Progress** - Most habit CRUD operations complete (missing update)

### Completed
- [x] Project setup with npm
- [x] Testing framework (Jest + Supertest) - 50 tests passing
- [x] Hello World endpoint with tests
- [x] Database connection (PostgreSQL with pg pool)
- [x] Mock authentication (X-User-Id header for development)
- [x] CORS support for frontend integration
- [x] Habit creation endpoint (POST /api/v1/habits)
- [x] Habit read endpoint (GET /api/v1/habits with status filtering)
- [x] Habit delete endpoint (DELETE /api/v1/habits/:id)
- [x] Completion tracking - all 3 endpoints:
  - POST /api/v1/habits/:habitId/completions
  - GET /api/v1/habits/:habitId/completions (with date filtering)
  - DELETE /api/v1/habits/:habitId/completions/:date

### In Progress / TODO
- [ ] **Real JWT authentication (TDD approach) - IN PLANNING:**
  - [ ] Install dependencies: bcrypt, jsonwebtoken, express-validator
  - [ ] Write tests & implement registration endpoint (POST /api/v1/auth/register)
  - [ ] Write tests & implement login endpoint (POST /api/v1/auth/login)
  - [ ] Write tests & implement JWT middleware (replace mockAuth)
  - [ ] Write tests & implement token refresh endpoint (POST /api/v1/auth/refresh)
  - [ ] Write tests & implement user profile endpoint (GET /api/v1/auth/me)
  - [ ] Write tests & update all protected routes to use JWT middleware
- [ ] Habit get by ID endpoint (GET /api/v1/habits/:id)
- [ ] Statistics calculation endpoint
- [ ] Integration tests with real database
- [ ] API documentation endpoint (Swagger UI)

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js 5
- **Language**: JavaScript (CommonJS)
- **Database**: PostgreSQL with pg (node-postgres)
- **Testing**: Jest + Supertest (50 tests passing)
- **CORS**: cors middleware
- **Environment**: dotenv
- **Authentication**: Mock (X-User-Id header) - JWT planned

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

See the [OpenAPI specification](../../shared/api-spec/openapi.yaml) for full API documentation.

### Currently Implemented

**Health/Testing:**
- `GET /hello` - Hello World endpoint

**Habits:**
- `POST /api/v1/habits` - Create habit (requires X-User-Id header)
- `GET /api/v1/habits` - List habits (supports ?status=active|archived filter)
- `DELETE /api/v1/habits/:id` - Delete habit (enforces user ownership)

**Completions:**
- `POST /api/v1/habits/:habitId/completions` - Mark habit complete for a date
- `GET /api/v1/habits/:habitId/completions` - List completions (supports ?startDate & ?endDate filters)
- `DELETE /api/v1/habits/:habitId/completions/:date` - Remove completion

### Planned

**Authentication (TDD approach):**
- `POST /api/v1/auth/register` - User registration with password hashing (bcrypt)
  - Validates email format and password strength (min 8 chars)
  - Returns JWT access token (15 min) and refresh token (7 days)
- `POST /api/v1/auth/login` - User login with JWT generation
  - Validates credentials with bcrypt.compare()
  - Returns JWT access token and refresh token
- `POST /api/v1/auth/refresh` - Refresh access token using refresh token
  - Validates refresh token and issues new access token
- `GET /api/v1/auth/me` - Get current user profile
  - Requires JWT authentication
  - Returns user info (id, email, name)

**Other Features:**
- `GET /health` - Health check endpoint
- `GET /api/v1/habits/:id` - Get single habit by ID
- `GET /api/v1/habits/:id/statistics` - Get habit statistics (streaks, completion rate, etc.)

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
│   ├── habits.js                 # Habit CRUD endpoints
│   ├── habits.test.js           # Habit endpoint tests
│   ├── completions.js           # Completion tracking endpoints
│   └── completions.test.js      # Completion endpoint tests
├── middleware/                    # Express middleware
│   └── auth.js                   # Mock authentication (X-User-Id header)
├── package.json                   # Dependencies and scripts
└── README.md                     # This file
```

## Testing

This project follows Test-Driven Development (TDD):

```bash
# Run all tests (50 tests passing)
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- routes/habits.test.js
npm test -- routes/completions.test.js
npm test -- db/pool.test.js
```

**Test Coverage:**
- App configuration: 4 tests
- Database pool: 6 tests
- Database config: 5 tests
- Habit endpoints: 21 tests (including 6 for DELETE)
- Completion endpoints: 17 tests
- **Total: 50 tests passing**

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

## Contributing

Follow the TDD approach:
1. Write a failing test
2. Implement minimum code to pass
3. Refactor if needed

## License

MIT
