import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

if (!process.env.SUPABASE_SECRET_KEY) {
  logger.error('[supabaseAdmin]', 'SUPABASE_SECRET_KEY is not set — admin DB operations will fail')
}

// Admin client — service role key, bypasses RLS for database operations
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

// Separate client using the anon key for JWT validation only.
// auth.getUser(token) sends the client's key as "apikey" on every request.
// Using the anon key here (NEXT_PUBLIC_* = always set) means token validation
// never depends on SUPABASE_SECRET_KEY being present.
const authClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

export async function getUserFromToken(token: string) {
  if (!token) {
    logger.warn('[auth]', 'getUserFromToken called with empty token')
    return null
  }

  const { data: { user }, error } = await authClient.auth.getUser(token)

  if (error) {
    logger.error('[auth]', 'getUserFromToken error', { error: error.message, status: error.status ?? 'n/a' })
    return null
  }

  return user ?? null
}
