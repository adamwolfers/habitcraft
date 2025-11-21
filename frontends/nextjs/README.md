# HabitCraft - Next.js Frontend

Next.js + React + TypeScript implementation of the HabitCraft UI.

## Status

✅ **Core features complete** - Full habit management UI with calendar view
🚧 **Next:** Authentication UI (login, registration, protected routes)

### Completed Features
- Next.js app with TypeScript and Tailwind CSS
- Comprehensive testing (Jest + React Testing Library)
- API client with full backend integration
- Habit management UI (create, update, delete)
- Calendar week view with completion tracking
- Week navigation (previous/next)
- Optimistic UI updates
- Custom hooks for state management
- TDD approach with comprehensive test coverage

### Upcoming
See [PROJECT_PLAN.md](../../PROJECT_PLAN.md) for the v1.0 roadmap including authentication UI, protected routes, and production deployment.

## Tech Stack

- **Framework:** Next.js 14+ (App Router)
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

Open [http://localhost:3000](http://localhost:3000) with your browser.

**Note:** Make sure the backend is running on port 3000 or update the `NEXT_PUBLIC_API_BASE_URL` in `.env.local`.

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
├── app/                    # Next.js app directory
│   ├── page.tsx           # Main habits page
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── AddHabitForm.tsx  # Habit creation form
│   └── HabitCard.tsx     # Habit card with calendar
├── hooks/                 # Custom React hooks
│   └── useHabits.ts      # Habit state management
├── lib/                   # Utility libraries
│   └── api.ts            # API client
├── utils/                 # Helper utilities
│   └── dateUtils.ts      # Date manipulation
└── __tests__/            # Test files
```

## Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- lib/api.test.ts
npm test -- hooks/useHabits.test.ts
npm test -- app/page.test.tsx
```

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
