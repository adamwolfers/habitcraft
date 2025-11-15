# Database Schema

This directory contains the shared database schema used by all backend implementations.

## Database

- **Type**: PostgreSQL 14+
- **Extensions**: uuid-ossp

## Schema Overview

### Tables

1. **users** - User accounts
   - id (UUID, primary key)
   - email (unique)
   - password_hash
   - name
   - timestamps

2. **habits** - User habits to track
   - id (UUID, primary key)
   - user_id (foreign key to users)
   - name, description
   - frequency (daily, weekly, custom)
   - target_days (array for weekly schedules)
   - color, icon (UI customization)
   - status (active, archived)
   - timestamps

3. **completions** - Habit completion records
   - id (UUID, primary key)
   - habit_id (foreign key to habits)
   - date (unique per habit)
   - notes
   - created_at

### Relationships

```
users (1) ──< (N) habits (1) ──< (N) completions
```

## Usage

### Creating the Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE habittracker;

# Connect to the database
\c habittracker

# Run the schema
\i schema.sql
```

### Using Docker

```bash
# Start PostgreSQL with Docker
docker run --name habittracker-db \
  -e POSTGRES_DB=habittracker \
  -e POSTGRES_USER=habituser \
  -e POSTGRES_PASSWORD=habitpass \
  -p 5432:5432 \
  -d postgres:14

# Import schema
docker exec -i habittracker-db psql -U habituser -d habittracker < schema.sql
```

### Migrations

For production use, consider using migration tools specific to your backend:

- **Node.js**: Prisma, TypeORM, Knex
- **Python**: Alembic, Django migrations
- **Go**: golang-migrate, goose
- **Java**: Flyway, Liquibase

The `schema.sql` file serves as the source of truth for the database structure.

## Environment Variables

All backends should use these environment variables for database connection:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=habittracker
DB_USER=habituser
DB_PASSWORD=habitpass
DATABASE_URL=postgresql://habituser:habitpass@localhost:5432/habittracker
```

## Data Model Diagram

```mermaid
erDiagram
    USERS ||--o{ HABITS : creates
    HABITS ||--o{ COMPLETIONS : tracks

    USERS {
        uuid id PK
        varchar email UK
        varchar password_hash
        varchar name
        timestamp created_at
        timestamp updated_at
    }

    HABITS {
        uuid id PK
        uuid user_id FK
        varchar name
        text description
        varchar frequency
        int_array target_days
        varchar color
        varchar icon
        varchar status
        timestamp created_at
        timestamp updated_at
    }

    COMPLETIONS {
        uuid id PK
        uuid habit_id FK
        date date
        text notes
        timestamp created_at
    }
```

## Indexes

The schema includes indexes on:
- `users.email` - for authentication lookups
- `habits.user_id` - for user's habits queries
- `habits.status` - for filtering active/archived
- `completions.habit_id` - for habit completions
- `completions.date` - for date range queries

## Notes

- All timestamps are stored in UTC
- UUIDs are used for all primary keys
- Cascade deletes ensure data integrity
- The `updated_at` column is automatically maintained by triggers
