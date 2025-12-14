-- HabitCraft Database Schema
-- PostgreSQL Version 14+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on email for faster lookups
CREATE INDEX idx_users_email ON users(email);

-- Habits table
CREATE TABLE habits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('daily', 'weekly')),
    target_days INTEGER[] DEFAULT '{}',  -- Array of integers (0-6 for days of week)
    color VARCHAR(7) DEFAULT '#3B82F6',
    icon VARCHAR(10) DEFAULT '⭐',
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_habits_user_id ON habits(user_id);
CREATE INDEX idx_habits_status ON habits(status);
CREATE INDEX idx_habits_user_status ON habits(user_id, status);

-- Completions table
CREATE TABLE completions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(habit_id, date)  -- Ensure one completion per habit per day
);

-- Create indexes for completions
CREATE INDEX idx_completions_habit_id ON completions(habit_id);
CREATE INDEX idx_completions_date ON completions(date);
CREATE INDEX idx_completions_habit_date ON completions(habit_id, date);

-- Refresh tokens table (for token rotation and revocation)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,  -- SHA256 hash of the token
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for refresh tokens
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_habits_updated_at
    BEFORE UPDATE ON habits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- View for habit statistics (optional, for performance)
CREATE OR REPLACE VIEW habit_statistics AS
SELECT
    h.id AS habit_id,
    h.user_id,
    h.name,
    COUNT(c.id) AS total_completions,
    MAX(c.date) AS last_completed_date,
    MIN(c.date) AS first_completed_date
FROM habits h
LEFT JOIN completions c ON h.id = c.habit_id
GROUP BY h.id, h.user_id, h.name;

-- Comments for documentation
COMMENT ON TABLE users IS 'Stores user account information';
COMMENT ON TABLE habits IS 'Stores user habits to track';
COMMENT ON TABLE completions IS 'Records when habits are completed';
COMMENT ON TABLE refresh_tokens IS 'Stores refresh token hashes for rotation and revocation';

COMMENT ON COLUMN refresh_tokens.token_hash IS 'SHA256 hash of the JWT refresh token';
COMMENT ON COLUMN refresh_tokens.revoked IS 'Whether this token has been revoked (logout or rotation)';

COMMENT ON COLUMN habits.frequency IS 'How often the habit should be done: daily or weekly';
COMMENT ON COLUMN habits.target_days IS 'For weekly habits: array of day numbers (0=Sunday, 6=Saturday)';
COMMENT ON COLUMN habits.color IS 'Hex color code for UI display';
COMMENT ON COLUMN habits.icon IS 'Emoji or icon identifier for UI display';
