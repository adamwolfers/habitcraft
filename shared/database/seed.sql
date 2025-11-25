-- Seed Data for Development
-- This file is automatically loaded when the database is first initialized
-- It creates a demo user for testing the application

-- Insert demo user 1 (idempotent - won't fail if already exists)
-- Email: demo@example.com / Password: demo123
INSERT INTO users (id, email, password_hash, name)
VALUES (
    '123e4567-e89b-12d3-a456-426614174000',
    'demo@example.com',
    '$2b$10$IJ4ca3n669/sra/2FBKA/e3945pf1gchoCH4pMLbt2B6lucwMMLlq',
    'Demo User'
)
ON CONFLICT (id) DO NOTHING;

-- Insert demo user 2 (idempotent - won't fail if already exists)
-- Email: demo2@example.com / Password: demo1234
INSERT INTO users (id, email, password_hash, name)
VALUES (
    '223e4567-e89b-12d3-a456-426614174001',
    'demo2@example.com',
    '$2b$10$t8kIv/q/hlglbdw9jyFCt.hfFVSf8BQ3dIcPwBqJADP1GrQk0DANW',
    'Demo User 2'
)
ON CONFLICT (id) DO NOTHING;

-- Log the seed data execution
DO $$
BEGIN
    RAISE NOTICE 'Seed data loaded: Demo users created';
    RAISE NOTICE '  - Demo User 1: demo@example.com (ID: 123e4567-e89b-12d3-a456-426614174000)';
    RAISE NOTICE '  - Demo User 2: demo2@example.com (ID: 223e4567-e89b-12d3-a456-426614174001)';
END $$;

-- Sample habits for demo user 1
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

-- Sample habits for demo user 2
INSERT INTO habits (user_id, name, description, frequency, color, icon, status)
VALUES
    (
        '223e4567-e89b-12d3-a456-426614174001',
        'Learn Spanish',
        'Practice vocabulary and grammar',
        'daily',
        '#F59E0B',
        '🇪🇸',
        'active'
    ),
    (
        '223e4567-e89b-12d3-a456-426614174001',
        'Drink Water',
        'Drink 8 glasses of water',
        'daily',
        '#06B6D4',
        '💧',
        'active'
    ),
    (
        '223e4567-e89b-12d3-a456-426614174001',
        'Journal Writing',
        'Write in gratitude journal',
        'daily',
        '#EC4899',
        '✍️',
        'active'
    )
ON CONFLICT DO NOTHING;

DO $$
BEGIN
    RAISE NOTICE 'Seed data: Sample habits created for demo users';
END $$;
