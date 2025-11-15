# Shared Types

This directory contains shared type definitions that can be used across all implementations of the Habit Tracker application.

## Files

- `models.ts` - TypeScript type definitions
- `models.py` - Python Pydantic models
- `models.go` - Go struct definitions (TODO)
- `models.java` - Java class definitions (TODO)

## Usage

### TypeScript (Node.js/Next.js)

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

### Python

```python
from shared.types.models import User, Habit, Completion

user = User(
    id='123',
    email='user@example.com',
    name='John Doe',
    created_at=datetime.now(),
    updated_at=datetime.now()
)
```

## Type Consistency

All type definitions should:

1. Match the OpenAPI specification in `shared/api-spec/openapi.yaml`
2. Match the database schema in `shared/database/schema.sql`
3. Use consistent naming conventions (camelCase in TS, snake_case in Python)
4. Include proper validation rules

## Validation

Each language implementation includes basic validation helpers:

- **TypeScript**: Validation functions (isValidEmail, isValidHexColor, etc.)
- **Python**: Pydantic validators
- **Go**: Custom validation functions (TODO)
- **Java**: Bean Validation annotations (TODO)

## Contributing

When adding new types:

1. Update all language-specific type files
2. Update the OpenAPI specification
3. Update database schema if needed
4. Add validation rules where appropriate
