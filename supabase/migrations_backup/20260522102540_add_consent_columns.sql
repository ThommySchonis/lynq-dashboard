-- Add cookie consent tracking columns to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS consent_level text CHECK (consent_level IN ('essential', 'all')),
  ADD COLUMN IF NOT EXISTS consented_at timestamptz;
