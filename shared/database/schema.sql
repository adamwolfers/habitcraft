-- Habit Tracker Database Schema
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
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'custom')),
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

-- Sample data for development (optional - comment out for production)
-- INSERT INTO users (id, email, password_hash, name) VALUES
-- ('123e4567-e89b-12d3-a456-426614174000', 'demo@example.com', '$2b$10$...', 'Demo User');

-- Comments for documentation
COMMENT ON TABLE users IS 'Stores user account information';
COMMENT ON TABLE habits IS 'Stores user habits to track';
COMMENT ON TABLE completions IS 'Records when habits are completed';

COMMENT ON COLUMN habits.frequency IS 'How often the habit should be done: daily, weekly, or custom';
COMMENT ON COLUMN habits.target_days IS 'For weekly habits: array of day numbers (0=Sunday, 6=Saturday)';
COMMENT ON COLUMN habits.color IS 'Hex color code for UI display';
COMMENT ON COLUMN habits.icon IS 'Emoji or icon identifier for UI display';
