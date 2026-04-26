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

// Validates a user token — tries main project first (new Next.js frontend),
// falls back to Lovable project (legacy Lovable frontend still in use).
export async function getUserFromToken(token) {
  // Main project (cvrzvhnsltjubmfkcxql) — used by the new Next.js frontend
  const { data: { user: mainUser }, error: mainError } = await supabaseAdmin.auth.getUser(token)
  if (!mainError && mainUser) return mainUser

  // Lovable project (fojmainonyqhxgifuljk) — fallback for legacy sessions
  if (process.env.LOVABLE_SUPABASE_URL && process.env.LOVABLE_SUPABASE_ANON_KEY) {
    const userClient = createClient(
      process.env.LOVABLE_SUPABASE_URL,
      process.env.LOVABLE_SUPABASE_ANON_KEY,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { autoRefreshToken: false, persistSession: false }
      }
    )
    const { data: { user }, error } = await userClient.auth.getUser()
    if (!error && user) return user
  }

  return null
}
