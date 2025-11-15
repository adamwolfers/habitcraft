# Habit Tracker - Python Backend

Python + FastAPI implementation of the Habit Tracker API.

## Status

📅 **Planned** - Not yet implemented

## Tech Stack

- **Language**: Python 3.10+
- **Framework**: FastAPI
- **Database**: PostgreSQL with SQLAlchemy
- **Testing**: pytest + httpx
- **Validation**: Pydantic
- **Authentication**: python-jose (JWT) + passlib

## Prerequisites

- Python 3.10 or higher
- pip or poetry
- PostgreSQL 14+ (or use Docker)

## Installation

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start development server
uvicorn main:app --reload --port 3001
```

## Development

```bash
# Run in development mode
uvicorn main:app --reload --port 3001

# Run tests
pytest

# Run tests with coverage
pytest --cov=app tests/

# Format code
black .

# Lint
flake8
```

## Environment Variables

Create a `.env` file:

```env
ENVIRONMENT=development
PORT=3001
DATABASE_URL=postgresql://habituser:habitpass@localhost:5432/habittracker
JWT_SECRET=your-secret-key-change-in-production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080
```

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:3001/docs
- ReDoc: http://localhost:3001/redoc

## Planned Structure

```
backends/python/
├── app/
│   ├── api/
│   │   ├── auth.py
│   │   ├── habits.py
│   │   ├── completions.py
│   │   └── statistics.py
│   ├── core/
│   │   ├── config.py
│   │   ├── security.py
│   │   └── database.py
│   ├── models/
│   │   ├── user.py
│   │   ├── habit.py
│   │   └── completion.py
│   ├── schemas/       # Pydantic models
│   └── main.py
├── tests/
├── alembic/          # Database migrations
├── requirements.txt
└── README.md
```

## License

MIT
