import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { asciiSafe } from '@/lib/utils/ascii-safe'

// ─── Auth bypass (geen Bearer-token vereist) ────────────────────────
const AUTH_BYPASS_PREFIXES = [
  '/api/auth/',
  '/api/webhooks/',
  // Invite flow: GET metadata + POST signup zijn pre-session.
  // De /accept sub-route enforced zelf nog Bearer auth in zijn handler.
  '/api/invites/',
  // Vercel Cron jobs — geen user session, eigen CRON_SECRET check
  // gebeurt in elke handler.
  '/api/cron/',
]

// ─── Blocked-state bypass (Bearer wel vereist, maar mag door bij
// expired trial zodat de gebruiker zichzelf kan upgraden) ───────────
const BLOCKED_BYPASS_PREFIXES = [
  ...AUTH_BYPASS_PREFIXES,
  '/api/onboarding/status',  // BlockedStateGuard moet status kunnen ophalen
  '/api/profile',            // banner/checklist dismiss + profile read
  '/api/billing/',           // billing routes — a trial-expired user MUST be able to call
                             // /api/billing/subscription/change-plan to upgrade
                             // themselves out of the blocked state.
  '/api/workspaces/current', // basis workspace info voor billing page
]

function startsWithAny(pathname: string, list: string[]): boolean {
  return list.some(prefix => pathname.startsWith(prefix))
}

// ─── Supabase response interfaces ────────────────────────────────────

interface SupabaseUser {
  id: string
  [key: string]: unknown
}

interface WorkspaceData {
  subscription_status: string | null
  trial_ends_at: string | null
}

interface WorkspaceMemberRow {
  workspaces: WorkspaceData | null
}

interface BlockedState {
  blocked: boolean
}

// ─── checkBlockedState — direct fetch tegen Supabase REST API ────────
// Geen @supabase/supabase-js import zodat dit overal werkt
// (Edge / Node / Fluid Compute). Twee korte HTTP roundtrips per
// niet-bypass API request — acceptabel voor v1, optimaliseren later.
async function checkBlockedState(token: string): Promise<BlockedState> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const secretKey   = process.env.SUPABASE_SECRET_KEY
  if (!supabaseUrl || !anonKey || !secretKey) return { blocked: false }

  // 1. User uit Bearer token
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: asciiSafe(`Bearer ${token}`, 'Authorization', 'proxy'),
      apikey:        asciiSafe(anonKey,            'apikey',        'proxy'),
    },
    cache:   'no-store',
  })
  if (!userRes.ok) return { blocked: false }
  const user = await userRes.json().catch(() => null) as SupabaseUser | null
  if (!user?.id) return { blocked: false }

  // 2. Workspace via workspace_members → workspaces (service-role
  // request, bypassed RLS). Embedded select met PostgREST syntax.
  const wsUrl = `${supabaseUrl}/rest/v1/workspace_members`
    + `?user_id=eq.${user.id}`
    + `&select=workspaces(subscription_status,trial_ends_at)`
    + `&limit=1`
  const wsRes = await fetch(wsUrl, {
    headers: {
      Authorization: asciiSafe(`Bearer ${secretKey}`, 'Authorization', 'proxy'),
      apikey:        asciiSafe(secretKey,              'apikey',        'proxy'),
    },
    cache:   'no-store',
  })
  if (!wsRes.ok) return { blocked: false }
  const rows = await wsRes.json().catch(() => null) as WorkspaceMemberRow[] | null
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

export async function proxy(request: NextRequest): Promise<NextResponse> {
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

export const config: { matcher: string[] } = {
  matcher: ['/api/:path*'],
}
