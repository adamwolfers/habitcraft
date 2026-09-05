# Shared Types

This directory contains shared type definitions used across the HabitCraft application.

## Files

- `models.ts` - TypeScript type definitions

## Usage

```typescript
import { User, Habit, Completion } from '../../../shared/types/models';

const user: User = {
  id: '123',
  email: 'user@example.com',
  name: 'John Doe',
  createdAt: new Date(),
  updatedAt: new Date()
};
```

## Type Consistency

All type definitions should:

1. Match the OpenAPI specification in `shared/api-spec/openapi.yaml`, which the
   backend integration suite enforces against real responses — so it is a
   reliable statement of the wire shape, not an aspiration
2. Match the database schema, which is defined by `db/migrations/` and readable in the generated `db/schema.sql`
3. Use consistent naming conventions (camelCase)
4. Include proper validation rules

## Validation

`models.ts` includes basic validation helpers (isValidEmail, isValidHexColor, etc.).

## Contributing

When adding new types:

1. Update `models.ts`
2. Update the OpenAPI specification
3. Update database schema if needed
4. Add validation rules where appropriate
