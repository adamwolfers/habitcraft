# HabitCraft - Vue.js Frontend

Vue.js 3 implementation of the HabitCraft UI.

## Status

📅 **Planned** - Not yet implemented

## Tech Stack

- **Framework**: Vue 3
- **Language**: TypeScript
- **State Management**: Pinia
- **Styling**: Tailwind CSS
- **Routing**: Vue Router 4
- **Forms**: VeeValidate
- **HTTP Client**: Axios
- **Build Tool**: Vite
- **Testing**: Vitest + Vue Test Utils

## Prerequisites

- Node.js 18 or higher
- npm or yarn

## Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

## Development

```bash
# Run development server
npm run dev

# Run tests
npm run test

# Run tests with coverage
npm run test:coverage

# Build for production
npm run build

# Preview production build
npm run preview

# Lint
npm run lint
```

## Environment Variables

Create a `.env` file:

```env
VITE_API_URL=http://localhost:3000/api/v1
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
frontends/vue/
├── public/
├── src/
│   ├── components/
│   │   ├── auth/
│   │   ├── habits/
│   │   ├── layout/
│   │   └── common/
│   ├── views/
│   ├── stores/         # Pinia stores
│   ├── composables/
│   ├── services/       # API calls
│   ├── types/
│   ├── utils/
│   ├── router/
│   ├── App.vue
│   └── main.ts
├── package.json
└── README.md
```

## License

MIT
