# HabitCraft - Go Backend

Go + Gin implementation of the HabitCraft API.

## Status

📅 **Planned** - Not yet implemented

## Tech Stack

- **Language**: Go 1.21+
- **Framework**: Gin
- **Database**: PostgreSQL with GORM
- **Testing**: testing package + testify
- **Validation**: go-playground/validator
- **Authentication**: golang-jwt

## Prerequisites

- Go 1.21 or higher
- PostgreSQL 14+ (or use Docker)

## Installation

```bash
# Install dependencies
go mod download

# Run database migrations
go run cmd/migrate/main.go

# Start development server
go run cmd/server/main.go
```

## Development

```bash
# Run with hot reload (using air)
air

# Run tests
go test ./...

# Run tests with coverage
go test -cover ./...

# Format code
go fmt ./...

# Lint
golangci-lint run
```

## Environment Variables

Create a `.env` file:

```env
ENVIRONMENT=development
PORT=3002
DATABASE_URL=postgresql://habituser:habitpass@localhost:5432/habittracker
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRATION=168h
```

## Planned Structure

```
backends/golang/
├── cmd/
│   └── server/
│       └── main.go
├── internal/
│   ├── api/
│   │   ├── handlers/
│   │   ├── middleware/
│   │   └── routes.go
│   ├── models/
│   ├── repository/
│   ├── service/
│   └── config/
├── pkg/
│   └── utils/
├── go.mod
├── go.sum
└── README.md
```

## License

MIT
