-- Seed Data for Development
-- This file is automatically loaded when the database is first initialized
-- It creates a demo user for testing the application

-- Insert demo user (idempotent - won't fail if already exists)
-- Password: demo123
INSERT INTO users (id, email, password_hash, name)
VALUES (
    '123e4567-e89b-12d3-a456-426614174000',
    'demo@example.com',
    '$2b$10$IJ4ca3n669/sra/2FBKA/e3945pf1gchoCH4pMLbt2B6lucwMMLlq',
    'Demo User'
)
ON CONFLICT (id) DO NOTHING;

-- Log the seed data execution
DO $$
BEGIN
    RAISE NOTICE 'Seed data loaded: Demo user created with ID 123e4567-e89b-12d3-a456-426614174000';
END $$;

-- Optional: Insert sample habits for the demo user
INSERT INTO habits (user_id, name, description, frequency, color, icon, status)
VALUES
    (
        '123e4567-e89b-12d3-a456-426614174000',
        'Morning Exercise',
        '30 minutes of cardio',
        'daily',
        '#3B82F6',
        '🏃',
        'active'
    ),
    (
        '123e4567-e89b-12d3-a456-426614174000',
        'Read Books',
        'Read for at least 20 minutes',
        'daily',
        '#10B981',
        '📚',
        'active'
    ),
    (
        '123e4567-e89b-12d3-a456-426614174000',
        'Meditation',
        'Morning meditation practice',
        'daily',
        '#8B5CF6',
        '🧘',
        'active'
    )
ON CONFLICT DO NOTHING;

DO $$
BEGIN
    RAISE NOTICE 'Seed data: Sample habits created for demo user';
END $$;
