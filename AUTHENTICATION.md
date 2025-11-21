# Authentication Implementation Plan

## Overview

This document outlines the JWT-based authentication system for HabitCraft, implemented using Test-Driven Development (TDD) principles.

## Architecture

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        Registration Flow                         │
└─────────────────────────────────────────────────────────────────┘

User → Registration Form → POST /api/v1/auth/register
                                    ↓
                         Validate email & password
                                    ↓
                         Hash password (bcrypt, 10 rounds)
                                    ↓
                         Save user to database
                                    ↓
                         Generate JWT tokens
                                    ↓
                         Return access + refresh tokens
                                    ↓
                         Store in localStorage/cookies

┌─────────────────────────────────────────────────────────────────┐
│                           Login Flow                             │
└─────────────────────────────────────────────────────────────────┘

User → Login Form → POST /api/v1/auth/login
                              ↓
                   Verify email exists
                              ↓
                   Compare password (bcrypt.compare)
                              ↓
                   Generate JWT tokens
                              ↓
                   Return access + refresh tokens
                              ↓
                   Store in localStorage/cookies

┌─────────────────────────────────────────────────────────────────┐
│                      Authenticated Request                       │
└─────────────────────────────────────────────────────────────────┘

User → Request + JWT → JWT Middleware
                              ↓
                   Verify token signature
                              ↓
                   Check expiration
                              ↓
                   Extract userId from payload
                              ↓
                   Attach to req.userId
                              ↓
                   Route Handler → Response

┌─────────────────────────────────────────────────────────────────┐
│                       Token Refresh Flow                         │
└─────────────────────────────────────────────────────────────────┘

User → Expired Access Token → POST /api/v1/auth/refresh
                                       ↓
                            Validate refresh token
                                       ↓
                            Generate new access token
                                       ↓
                            Return new access token
```

## Backend Implementation (Node.js/Express)

### Dependencies

```json
{
  "bcrypt": "^5.1.1",
  "jsonwebtoken": "^9.0.2",
  "express-validator": "^7.0.1"
}
```

### Endpoints

#### 1. User Registration
- **Endpoint:** `POST /api/v1/auth/register`
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "SecurePassword123",
    "name": "John Doe"
  }
  ```
- **Validation:**
  - Email: Valid email format, unique in database
  - Password: Min 8 chars, at least 1 uppercase, 1 lowercase, 1 number
  - Name: Required, min 2 chars, max 100 chars
- **Response (201):**
  ```json
  {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
  ```

#### 2. User Login
- **Endpoint:** `POST /api/v1/auth/login`
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "SecurePassword123"
  }
  ```
- **Response (200):**
  ```json
  {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
  ```

#### 3. Token Refresh
- **Endpoint:** `POST /api/v1/auth/refresh`
- **Request Body:**
  ```json
  {
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
  ```
- **Response (200):**
  ```json
  {
    "accessToken": "eyJhbGciOiJIUzI1NiIs..."
  }
  ```

#### 4. User Profile
- **Endpoint:** `GET /api/v1/auth/me`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Response (200):**
  ```json
  {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2025-01-15T10:30:00Z"
  }
  ```

### JWT Token Configuration

**Access Token:**
- Expiration: 15 minutes
- Payload: `{ userId, email, type: 'access' }`
- Used for: API authentication

**Refresh Token:**
- Expiration: 7 days
- Payload: `{ userId, type: 'refresh' }`
- Used for: Generating new access tokens

### Middleware

#### JWT Authentication Middleware (`jwtAuth.js`)

Replaces the current `mockAuth.js` middleware.

```javascript
// Pseudo-code structure
function jwtAuthMiddleware(req, res, next) {
  // 1. Extract token from Authorization header
  // 2. Verify token signature with JWT_SECRET
  // 3. Check token expiration
  // 4. Validate token type (must be 'access')
  // 5. Attach userId to req.userId
  // 6. Call next()

  // Error handling:
  // - Missing token: 401 Unauthorized
  // - Invalid token: 401 Unauthorized
  // - Expired token: 401 Unauthorized
}
```

### Security Features

1. **Password Hashing:** bcrypt with 10 salt rounds
2. **Token Signing:** HMAC-SHA256 (HS256) algorithm
3. **Token Expiration:** Short-lived access tokens, long-lived refresh tokens
4. **Input Validation:** express-validator for all inputs
5. **Error Handling:** Generic error messages to prevent user enumeration
6. **HTTPS Only:** Tokens should only be transmitted over HTTPS in production

## Frontend Implementation (Next.js)

### Auth Context

**Location:** `frontends/nextjs/context/AuthContext.tsx`

```typescript
interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => void
  isLoading: boolean
  isAuthenticated: boolean
}
```

### Custom Hooks

1. **useAuth()** - Access auth context
2. **useRequireAuth()** - Redirect if not authenticated

### Pages

1. **Login Page:** `/login` - Email/password form
2. **Registration Page:** `/register` - Email/password/name form

### API Client Updates

**Location:** `frontends/nextjs/lib/api.ts`

- Inject `Authorization: Bearer <token>` header on all requests
- Intercept 401 responses
- Attempt token refresh automatically
- Retry failed request with new token
- Redirect to login if refresh fails

### Protected Routes

**Wrapper Component:** `ProtectedRoute.tsx`

```typescript
// Pseudo-code
function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) return <LoadingSpinner />
  if (!isAuthenticated) return <Navigate to="/login" />

  return children
}
```

## Database Schema

**Note:** The users table already exists with all required fields.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## Environment Variables

```env
# JWT Configuration
JWT_SECRET=your-secret-key-change-in-production-min-32-chars
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# Password Requirements
PASSWORD_MIN_LENGTH=8
PASSWORD_REQUIRE_UPPERCASE=true
PASSWORD_REQUIRE_LOWERCASE=true
PASSWORD_REQUIRE_NUMBER=true
```

## Security Considerations

### Production Checklist

- [ ] Use strong JWT_SECRET (min 32 random characters)
- [ ] Store JWT_SECRET in secure environment (not in code)
- [ ] Enforce HTTPS only in production
- [ ] Use httpOnly cookies for tokens (alternative to localStorage)
- [ ] Implement rate limiting on auth endpoints
- [ ] Add CORS configuration for allowed origins
- [ ] Log authentication failures for security monitoring
- [ ] Consider adding email verification
- [ ] Consider adding password reset flow
- [ ] Consider adding 2FA for enhanced security

### Common Attacks & Mitigations

1. **Brute Force:** Rate limiting on login endpoint
2. **User Enumeration:** Generic error messages
3. **Token Theft:** Short expiration, HTTPS only, httpOnly cookies
4. **XSS:** Sanitize inputs, CSP headers
5. **CSRF:** SameSite cookies, CSRF tokens

## Related Documentation

- [Getting Started Guide](GETTING_STARTED.md)
- [API Specification](shared/api-spec/openapi.yaml)
- [Database Schema](shared/database/schema.sql)
- [Backend README](backends/node/README.md)
- [Frontend README](frontends/nextjs/README.md)

## Questions & Troubleshooting

### Common Issues

**Q: Why are access tokens so short-lived (15 min)?**
A: Short-lived access tokens minimize the risk if a token is stolen. Refresh tokens allow seamless renewal.

**Q: Should tokens be stored in localStorage or cookies?**
A: Cookies (httpOnly, secure, SameSite) are more secure against XSS. localStorage is simpler but more vulnerable.

**Q: What if a user's refresh token is stolen?**
A: The attacker can generate access tokens for 7 days. Future enhancement: token rotation and blacklisting.

**Q: How do I test JWT authentication locally?**
A: Use tools like Postman or curl with the Authorization header: `Authorization: Bearer <token>`

