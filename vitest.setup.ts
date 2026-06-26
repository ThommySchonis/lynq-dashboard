// Vitest setup: provide dummy env so modules that read required env vars at
// import time (e.g. lib/encryption.ts, imported transitively via the provider
// adapters / conversationEngine) can load in the test environment. Unit tests
// mock the functions that would actually use these; this only prevents
// import-time throws.
process.env.EMAIL_ENCRYPTION_KEY ??= '0'.repeat(64) // 32-byte hex key
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://localhost:54321'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key'
process.env.SUPABASE_SECRET_KEY ??= 'test-secret-key'
