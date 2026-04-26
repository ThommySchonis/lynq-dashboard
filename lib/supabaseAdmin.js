import { createClient } from '@supabase/supabase-js'

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    }
  }
)

// Validates a user token against Lovable's Supabase project (where users actually sign in)
export async function getUserFromToken(token) {
  const userClient = createClient(
    process.env.LOVABLE_SUPABASE_URL,
    process.env.LOVABLE_SUPABASE_ANON_KEY,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false }
    }
  )
  const { data: { user }, error } = await userClient.auth.getUser()
  if (error || !user) return null
  return user
}
