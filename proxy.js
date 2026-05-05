import { NextResponse } from 'next/server'

// ─── Auth bypass (geen Bearer-token vereist) ────────────────────────
const AUTH_BYPASS_PREFIXES = [
  '/api/auth/',
  '/api/webhooks/',
  '/api/whop/webhook',
  // Invite flow: GET metadata + POST signup zijn pre-session.
  // De /accept sub-route enforced zelf nog Bearer auth in zijn handler.
  '/api/invites/',
]

// ─── Blocked-state bypass (Bearer wel vereist, maar mag door bij
// expired trial zodat de gebruiker zichzelf kan upgraden) ───────────
const BLOCKED_BYPASS_PREFIXES = [
  ...AUTH_BYPASS_PREFIXES,
  '/api/onboarding/status',  // BlockedStateGuard moet status kunnen ophalen
  '/api/profile',            // banner/checklist dismiss + profile read
  '/api/subscription/',      // /settings/billing flow + Whop sync
  '/api/workspaces/current', // basis workspace info voor billing page
]

function startsWithAny(pathname, list) {
  return list.some(prefix => pathname.startsWith(prefix))
}

// ─── checkBlockedState — direct fetch tegen Supabase REST API ────────
// Geen @supabase/supabase-js import zodat dit overal werkt
// (Edge / Node / Fluid Compute). Twee korte HTTP roundtrips per
// niet-bypass API request — acceptabel voor v1, optimaliseren later.
async function checkBlockedState(token) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const secretKey   = process.env.SUPABASE_SECRET_KEY
  if (!supabaseUrl || !anonKey || !secretKey) return { blocked: false }

  // 1. User uit Bearer token
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    cache:   'no-store',
  })
  if (!userRes.ok) return { blocked: false }
  const user = await userRes.json().catch(() => null)
  if (!user?.id) return { blocked: false }

  // 2. Workspace via workspace_members → workspaces (service-role
  // request, bypassed RLS). Embedded select met PostgREST syntax.
  const wsUrl = `${supabaseUrl}/rest/v1/workspace_members`
    + `?user_id=eq.${user.id}`
    + `&select=workspaces(subscription_status,trial_ends_at)`
    + `&limit=1`
  const wsRes = await fetch(wsUrl, {
    headers: { Authorization: `Bearer ${secretKey}`, apikey: secretKey },
    cache:   'no-store',
  })
  if (!wsRes.ok) return { blocked: false }
  const rows = await wsRes.json().catch(() => null)
  const ws   = Array.isArray(rows) ? rows[0]?.workspaces : null
  if (!ws) return { blocked: false }

  // 3. Beslis: paying → nooit blocked. Expired status of trial-met-
  // verlopen-trial_ends_at → blocked.
  if (ws.subscription_status === 'paying')  return { blocked: false }
  if (ws.subscription_status === 'expired') return { blocked: true }
  if (ws.subscription_status === 'trial' && ws.trial_ends_at) {
    if (new Date(ws.trial_ends_at).getTime() < Date.now()) {
      return { blocked: true }
    }
  }
  return { blocked: false }
}

export async function proxy(request) {
  const { pathname } = request.nextUrl

  if (request.method === 'OPTIONS') return NextResponse.next()

  // Pre-session paths door
  if (startsWithAny(pathname, AUTH_BYPASS_PREFIXES)) {
    return NextResponse.next()
  }

  const authHeader = request.headers.get('authorization') || ''
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Self-rescue endpoints (zelfs blocked users moeten hier kunnen komen)
  if (startsWithAny(pathname, BLOCKED_BYPASS_PREFIXES)) {
    return NextResponse.next()
  }

  // Trial-expired check
  const token = authHeader.slice(7).trim()
  try {
    const { blocked } = await checkBlockedState(token)
    if (blocked) {
      return NextResponse.json(
        {
          error: 'Trial expired. Pick a plan to continue.',
          code:  'TRIAL_EXPIRED',
        },
        { status: 402 }
      )
    }
  } catch {
    // Fail-open bij netwerkfout — ondervangt /api niet als
    // Supabase even traag is. BlockedStateGuard pakt het wel client-side.
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*'],
}
