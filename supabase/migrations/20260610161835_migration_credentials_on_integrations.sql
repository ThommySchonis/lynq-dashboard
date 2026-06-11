alter table integrations
  add column migration_auth_method text,
  add column migration_access_token text,
  add column migration_api_key text,
  add column migration_username text,
  add column migration_subdomain text;
