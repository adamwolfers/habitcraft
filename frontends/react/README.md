# HabitCraft - React Frontend

React SPA implementation of the HabitCraft UI.

## Status

📅 **Planned** - Not yet implemented

## Tech Stack

- **Framework**: React 18+
- **Language**: TypeScript
- **State Management**: Redux Toolkit or Zustand
- **Styling**: Styled Components / Emotion
- **Routing**: React Router v6
- **Forms**: React Hook Form
- **HTTP Client**: Axios or React Query
- **Testing**: Jest + React Testing Library

## Prerequisites

- Node.js 18 or higher
- npm or yarn

## Installation

```bash
# Install dependencies
npm install

# Start development server
npm start
```

## Development

```bash
# Run development server
npm start

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Build for production
npm run build

# Lint
npm run lint
```

## Environment Variables

Create a `.env` file:

```env
REACT_APP_API_URL=http://localhost:3000/api/v1
```

## Planned Features

- User authentication (login/register)
- Dashboard with habit list
- Create/edit/delete habits
- Daily habit tracking
- Statistics and streak visualization
- Responsive design
- Dark mode support

## Planned Structure

```
frontends/react/
├── public/
├── src/
│   ├── components/
│   │   ├── auth/
│   │   ├── habits/
│   │   ├── layout/
│   │   └── common/
│   ├── pages/
│   ├── store/          # Redux store
│   ├── hooks/
│   ├── services/       # API calls
│   ├── types/
│   ├── utils/
│   ├── App.tsx
│   └── index.tsx
├── package.json
└── README.md
```

## License

MIT
