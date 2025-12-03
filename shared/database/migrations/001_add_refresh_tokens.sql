-- Migration: Add refresh_tokens table for token rotation and revocation
-- Run this migration on existing databases

-- Refresh tokens table (for token rotation and revocation)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,  -- SHA256 hash of the token
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for refresh tokens (IF NOT EXISTS is implicit for CREATE INDEX)
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- Add documentation comments
COMMENT ON TABLE refresh_tokens IS 'Stores refresh token hashes for rotation and revocation';
COMMENT ON COLUMN refresh_tokens.token_hash IS 'SHA256 hash of the JWT refresh token';
COMMENT ON COLUMN refresh_tokens.revoked IS 'Whether this token has been revoked (logout or rotation)';
