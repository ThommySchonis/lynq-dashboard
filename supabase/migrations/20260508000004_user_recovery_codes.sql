-- Recovery codes + MFA timestamp for user_profiles
alter table user_profiles
  add column if not exists recovery_codes  text[]      default '{}',
  add column if not exists mfa_enabled_at  timestamptz;
