import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { asciiSafe } from '@/lib/utils/ascii-safe'
import { validateCsrfOrigin } from '@/lib/csrf'

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

interface SubscriptionData {
  status: string | null
  trial_ends_at: string | null
}

interface WorkspaceMemberRow {
  workspace_id: string
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
  const userRaw: unknown = await userRes.json().catch(() => null)
  const user = userRaw as SupabaseUser | null
  if (!user?.id) return { blocked: false }

  // Platform admins and testers are never blocked, regardless of workspace subscription.
  const adminEmail = typeof user.email === 'string' ? user.email : undefined
  if (adminEmail) {
    const adminUrl = `${supabaseUrl}/rest/v1/platform_admins`
      + `?email=eq.${encodeURIComponent(adminEmail)}`
      + `&select=role`
      + `&limit=1`
    const adminRes = await fetch(adminUrl, {
      headers: {
        Authorization: asciiSafe(`Bearer ${secretKey}`, 'Authorization', 'proxy'),
        apikey:        asciiSafe(secretKey,              'apikey',        'proxy'),
      },
      cache: 'no-store',
    })
    const adminRowsRaw: unknown = await adminRes.json().catch(() => [])
    const adminRows = adminRowsRaw as { role: string }[]
    if (Array.isArray(adminRows) && adminRows.length > 0) return { blocked: false }
  }

  // 2. Get workspace_id from workspace_members
  const memberUrl = `${supabaseUrl}/rest/v1/workspace_members`
    + `?user_id=eq.${user.id}`
    + `&select=workspace_id`
    + `&limit=1`
  const memberRes = await fetch(memberUrl, {
    headers: {
      Authorization: asciiSafe(`Bearer ${secretKey}`, 'Authorization', 'proxy'),
      apikey:        asciiSafe(secretKey,              'apikey',        'proxy'),
    },
    cache:   'no-store',
  })
  if (!memberRes.ok) return { blocked: false }
  const membersRaw: unknown = await memberRes.json().catch(() => null)
  const members = membersRaw as WorkspaceMemberRow[] | null
  const workspaceId = Array.isArray(members) ? members[0]?.workspace_id : null
  if (!workspaceId) return { blocked: false }

  // 3. Get subscription status from workspace_subscriptions
  const subUrl = `${supabaseUrl}/rest/v1/workspace_subscriptions`
    + `?workspace_id=eq.${workspaceId}`
    + `&select=status,trial_ends_at`
  const subRes = await fetch(subUrl, {
    headers: {
      Authorization: asciiSafe(`Bearer ${secretKey}`, 'Authorization', 'proxy'),
      apikey:        asciiSafe(secretKey,              'apikey',        'proxy'),
    },
    cache:   'no-store',
  })
  if (!subRes.ok) return { blocked: false }
  const subsRaw: unknown = await subRes.json().catch(() => null)
  const subs = subsRaw as SubscriptionData[] | null
  const sub = Array.isArray(subs) ? subs[0] : null
  if (!sub) return { blocked: false }

  // 4. Decide: active → never blocked. trial → check expiry.
  //    past_due / canceled / paused → blocked.
  if (sub.status === 'active')  return { blocked: false }
  if (sub.status === 'trial' && sub.trial_ends_at) {
    if (new Date(sub.trial_ends_at).getTime() < Date.now()) {
      return { blocked: true }
    }
    return { blocked: false }
  }
  if (sub.status === 'trial') return { blocked: false }

  // past_due, canceled, paused → blocked
  return { blocked: true }
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  if (request.method === 'OPTIONS') return NextResponse.next()

  // ─── CSRF origin check (mutating methods only) ─────────────────────
  const csrf = validateCsrfOrigin(request)
  if (!csrf.valid) {
    console.warn(`[csrf] Blocked: ${csrf.reason} — ${request.method} ${pathname}`)
    return NextResponse.json(
      { error: 'CSRF validation failed' },
      { status: 403 }
    )
  }

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
