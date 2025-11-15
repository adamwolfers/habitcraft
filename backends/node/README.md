# Habit Tracker - Node.js Backend

Node.js + Express implementation of the Habit Tracker API.

## Status

🚧 **In Progress** - Currently implementing basic endpoints with TDD approach

### Completed
- [x] Project setup with npm
- [x] Testing framework (Jest + Supertest)
- [x] Hello World endpoint with tests
- [ ] Database connection (Prisma/TypeORM)
- [ ] User authentication (JWT)
- [ ] Habit CRUD endpoints
- [ ] Completion tracking
- [ ] Statistics calculation

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: JavaScript (CommonJS)
- **Database**: PostgreSQL with Prisma/TypeORM
- **Testing**: Jest + Supertest
- **Validation**: express-validator
- **Authentication**: jsonwebtoken + bcrypt

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
DATABASE_URL=postgresql://habituser:habitpass@localhost:5432/habittracker
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d
```

## API Endpoints

See the [OpenAPI specification](../../shared/api-spec/openapi.yaml) for full API documentation.

### Currently Implemented

- `GET /hello` - Hello World endpoint

### Planned

- `GET /health` - Health check
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `GET /users/me` - Get current user
- `GET /habits` - List habits
- `POST /habits` - Create habit
- `GET /habits/:id` - Get habit
- `PUT /habits/:id` - Update habit
- `DELETE /habits/:id` - Delete habit
- `GET /habits/:id/completions` - List completions
- `POST /habits/:id/completions` - Mark complete
- `DELETE /habits/:id/completions/:date` - Remove completion
- `GET /habits/:id/statistics` - Get statistics

## Project Structure

```
backends/node/
├── app.js              # Express app configuration
├── server.js           # Server entry point
├── app.test.js         # API tests
├── package.json        # Dependencies and scripts
└── README.md          # This file
```

Planned structure:
```
backends/node/
├── src/
│   ├── config/        # Configuration files
│   ├── controllers/   # Route controllers
│   ├── middleware/    # Express middleware
│   ├── models/        # Database models
│   ├── routes/        # API routes
│   ├── services/      # Business logic
│   ├── utils/         # Utilities
│   └── app.js        # Express app
├── tests/            # Test files
├── server.js         # Entry point
└── package.json
```

## Testing

This project follows Test-Driven Development (TDD):

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Docker

```bash
# Build image
docker build -t habittracker-node .

# Run container
docker run -p 3000:3000 \
  -e DATABASE_URL=postgresql://habituser:habitpass@postgres:5432/habittracker \
  habittracker-node

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
