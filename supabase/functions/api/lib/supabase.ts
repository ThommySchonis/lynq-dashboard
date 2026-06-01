import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _adminClient: SupabaseClient | null = null
let _authClient: SupabaseClient | null = null

/** Admin client — service role key, bypasses RLS */
export function getAdminClient(): SupabaseClient {
  if (!_adminClient) {
    _adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return _adminClient
}

/** Auth client — anon key, for JWT validation only */
export function getAuthClient(): SupabaseClient {
  if (!_authClient) {
    _authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return _authClient
}

/** Validate a Bearer token and return the user, or null */
export async function getUserFromToken(token: string) {
  if (!token) return null
  const { data: { user }, error } = await getAuthClient().auth.getUser(token)
  if (error) {
    console.error('[auth] getUserFromToken error:', error.message)
    return null
  }
  return user ?? null
}
