-- Test Fixtures for Acceptance Testing
-- This file creates consistent test data for integration and E2E tests
-- Each test user has known credentials and predictable UUIDs

-- ============================================================================
-- TEST USERS
-- ============================================================================

-- Test User 1 (Primary test user)
-- Email: test@example.com / Password: Test1234!
INSERT INTO users (id, email, password_hash, name)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'test@example.com',
    '$2b$10$w1PAvb7tS9BwyRI9SEKODOpOBIftLBpYg/k1gUFqHSmTs0ips.ws.',
    'Test User'
)
ON CONFLICT (id) DO NOTHING;

-- Test User 2 (For user isolation testing)
-- Email: test2@example.com / Password: Test1234!
INSERT INTO users (id, email, password_hash, name)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    'test2@example.com',
    '$2b$10$w1PAvb7tS9BwyRI9SEKODOpOBIftLBpYg/k1gUFqHSmTs0ips.ws.',
    'Test User 2'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- TEST HABITS (for Test User 1)
-- ============================================================================

INSERT INTO habits (id, user_id, name, description, frequency, color, icon, status)
VALUES
    (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '11111111-1111-1111-1111-111111111111',
        'Morning Exercise',
        'Daily workout routine',
        'daily',
        '#3B82F6',
        '🏃',
        'active'
    ),
    (
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        '11111111-1111-1111-1111-111111111111',
        'Read Books',
        'Read for 30 minutes',
        'daily',
        '#10B981',
        '📚',
        'active'
    ),
    (
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        '11111111-1111-1111-1111-111111111111',
        'Archived Habit',
        'This habit is archived',
        'daily',
        '#6B7280',
        '📦',
        'archived'
    )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- TEST HABITS (for Test User 2 - user isolation testing)
-- ============================================================================

INSERT INTO habits (id, user_id, name, description, frequency, color, icon, status)
VALUES
    (
        'dddddddd-dddd-dddd-dddd-dddddddddddd',
        '22222222-2222-2222-2222-222222222222',
        'User 2 Habit',
        'This belongs to test user 2',
        'daily',
        '#F59E0B',
        '⭐',
        'active'
    )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- TEST COMPLETIONS (for Test User 1's habits)
-- ============================================================================

-- Note: Completions use current date minus N days for realistic testing
-- These will be relative to when the test database is created

-- Completions for "Morning Exercise" habit (last 7 days, 5 completed)
INSERT INTO completions (habit_id, date)
SELECT
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    CURRENT_DATE - days
FROM generate_series(0, 6) AS days
WHERE days NOT IN (2, 5)  -- Skip 2 and 5 days ago
ON CONFLICT (habit_id, date) DO NOTHING;

-- Completions for "Read Books" habit (last 7 days, 3 completed)
INSERT INTO completions (habit_id, date)
SELECT
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    CURRENT_DATE - days
FROM generate_series(0, 2) AS days
ON CONFLICT (habit_id, date) DO NOTHING;

-- ============================================================================
-- LOG FIXTURE CREATION
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '=== Test Fixtures Loaded ===';
    RAISE NOTICE 'Test User 1: test@example.com / Test1234! (ID: 11111111-1111-1111-1111-111111111111)';
    RAISE NOTICE 'Test User 2: test2@example.com / Test1234! (ID: 22222222-2222-2222-2222-222222222222)';
    RAISE NOTICE 'Test habits and completions created';
END $$;
