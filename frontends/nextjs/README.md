# HabitCraft - Next.js Frontend

Next.js + React + TypeScript implementation of the HabitCraft UI.

## Status

✅ **Core features complete** - Full habit management UI with authentication and calendar view

### Completed Features
- Next.js app with TypeScript and Tailwind CSS
- Comprehensive testing (Jest + React Testing Library)
- API client with full backend integration
- JWT authentication with HttpOnly cookies
- User registration and login pages
- Protected routes with authentication guards
- Logout functionality with session management
- Habit management UI (create, update, delete)
- Edit habit modal with validation
- User profile modal with name/email editing
- Calendar week view with completion tracking
- Week navigation (previous/next)
- Optimistic UI updates
- Custom hooks for state management (useHabits, useRequireAuth)
- TDD approach with comprehensive test coverage

See [PROJECT_PLAN.md](../../PROJECT_PLAN.md) for the complete project roadmap.

## Tech Stack

- **Framework:** Next.js 16+ (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Testing:** Jest + React Testing Library
- **State Management:** React Hooks (useState, useEffect, custom hooks)

## Prerequisites

- Node.js 18 or higher
- npm or yarn

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Run development server
npm run dev
```

Open [http://localhost:3100](http://localhost:3100) with your browser.

**Note:** The frontend runs on port 3100, and the backend runs on port 3000. Make sure the backend is running or update the `NEXT_PUBLIC_API_BASE_URL` in `.env.local`.

## Development

```bash
# Run development server with hot reload
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Build for production
npm run build

# Start production server
npm start
```

## Project Structure

```
frontends/nextjs/
├── app/                           # Next.js app directory
│   ├── page.tsx                  # Main habits page
│   ├── page.test.tsx            # Habits page tests
│   ├── layout.tsx               # Root layout with AuthProvider
│   ├── layout.test.tsx          # Layout tests
│   ├── login/
│   │   ├── page.tsx            # Login page
│   │   └── page.test.tsx       # Login tests
│   └── register/
│       ├── page.tsx            # Registration page
│       └── page.test.tsx       # Registration tests
├── components/                   # React components
│   ├── AddHabitForm.tsx         # Habit creation form
│   ├── AddHabitForm.test.tsx    # Form tests
│   ├── EditHabitModal.tsx       # Edit habit modal
│   ├── EditHabitModal.test.tsx  # Modal tests
│   ├── HabitCard.tsx            # Habit card with calendar
│   ├── HabitCard.test.tsx       # Card tests
│   ├── Header.tsx               # Header with logout
│   ├── Header.test.tsx          # Header tests
│   ├── HeaderWithProfile.tsx    # Header wrapper with profile modal
│   ├── ProfileModal.tsx         # User profile editing modal
│   ├── ProfileModal.test.tsx    # Profile modal tests
│   ├── ProtectedRoute.tsx       # Auth guard wrapper
│   ├── ProtectedRoute.test.tsx  # Guard tests
│   └── Footer.tsx               # Footer component
├── context/                      # React context
│   ├── AuthContext.tsx          # Authentication context
│   └── AuthContext.test.tsx     # Context tests
├── e2e/                          # Playwright E2E tests
│   ├── auth.spec.ts             # Authentication flow tests
│   ├── completions.spec.ts      # Completion tracking tests
│   ├── habits.spec.ts           # Habit management tests
│   ├── global-setup.ts          # Test database setup
│   └── global-teardown.ts       # Test cleanup
├── hooks/                        # Custom React hooks
│   ├── useHabits.ts             # Habit state management
│   ├── useHabits.test.ts        # Hook tests
│   ├── useRequireAuth.ts        # Auth redirect hook
│   └── useRequireAuth.test.ts   # Auth hook tests
├── lib/                          # Utility libraries
│   ├── api.ts                   # API client
│   └── api.test.ts              # API tests
├── utils/                        # Helper utilities
│   ├── authUtils.ts             # Registration form validation
│   ├── authUtils.test.ts        # Auth utils tests
│   ├── dateUtils.ts             # Date manipulation
│   ├── dateUtils.test.ts        # Date utils tests
│   ├── habitUtils.ts            # Habit lookup utilities
│   └── habitUtils.test.ts       # Habit utils tests
├── playwright.config.ts          # Playwright configuration
└── package.json                  # Dependencies and scripts
```

## Testing

### Unit Tests (Jest + React Testing Library)

```bash
# Run all unit tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- lib/api.test.ts
npm test -- context/AuthContext.test.tsx
npm test -- hooks/useHabits.test.ts
npm test -- hooks/useRequireAuth.test.ts
npm test -- utils/authUtils.test.ts
npm test -- utils/habitUtils.test.ts
npm test -- app/page.test.tsx
npm test -- app/login/page.test.tsx
npm test -- app/register/page.test.tsx
npm test -- components/EditHabitModal.test.tsx
npm test -- components/ProfileModal.test.tsx
```

### End-to-End Tests (Playwright)

E2E tests run against the full stack using a test database.

```bash
# Prerequisites: Start test environment
../../scripts/test-db-start.sh
docker compose -f ../../docker-compose.test.yml up -d

# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Run E2E tests in headed mode (see browser)
npm run test:e2e:headed

# View test report
npm run test:e2e:report

# Stop test environment
docker compose -f ../../docker-compose.test.yml down
../../scripts/test-db-stop.sh
```

E2E test coverage includes:
- **Authentication:** Login, registration, logout, token refresh, user isolation, profile management
- **Habit Management:** Create, update, delete habits with persistence verification
- **Completion Tracking:** Toggle completions, week navigation, persistence verification

Comprehensive test coverage includes authentication flow, API integration, state management, UI components, and user interactions.

## Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

## Docker

```bash
# Build image
docker build -t habitcraft-nextjs .

# Run container
docker run -p 3100:3000 \
  -e NEXT_PUBLIC_API_BASE_URL=http://localhost:3000 \
  habitcraft-nextjs

# Or use docker-compose from root
cd ../..
docker-compose up frontend-nextjs
```

## Development Workflow

This project follows TDD:
1. Write a failing test
2. Implement minimum code to pass the test
3. Refactor if needed

For the complete development roadmap, see [PROJECT_PLAN.md](../../PROJECT_PLAN.md).
