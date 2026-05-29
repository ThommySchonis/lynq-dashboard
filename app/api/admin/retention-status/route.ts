import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { supabaseAdmin, getUserFromToken } from '@/lib/supabaseAdmin'
import { isPlatformAdmin } from '@/lib/platformAdmin'

const TRIAL_RETENTION_DAYS = 60

// GET /api/admin/retention-status
//
// Super-admin only (info@lynqagency.com). Geeft een dashboard-friendly
// snapshot van de retentie pipeline:
//
//   - workspaces in elke fase (active, trial-expiring, in retention, scheduled)
//   - recent log events (laatste 50)
//   - simpele counters per event type (laatste 30 dagen)
//
// Bedoeld voor admin panel "Data retention" tab + ad-hoc debugging.
//
// NB: Following the existing super-admin route pattern on main
// (app/api/admin/finance/route.ts etc.) we use `getUserFromToken` +
// hardcoded email check rather than `getAuthContext`. Migrating all
// 13 admin routes to `is_current_user_lynq_admin()` is tracked as
// audit item #18 — out of scope for this PR.

// --- Types ---

type DeletionEvent = 'scheduled' | 'deleted' | 'cancelled' | 'error'

interface WorkspaceRow {
  id:                         string
  name:                       string | null
  scheduled_for_deletion_at?: string | null
  created_at:                 string
  workspace_subscriptions:    {
    status:        string | null
    trial_ends_at: string | null
  }
}

interface LogRow {
  id:                         string
  workspace_id:               string
  workspace_name:             string | null
  owner_email:                string | null
  event:                      DeletionEvent
  trial_ends_at:              string | null
  scheduled_for_deletion_at:  string | null
  details:                    Record<string, unknown>
  created_at:                 string
}

interface CounterRow {
  event: DeletionEvent
}

interface ScheduledAnnotated extends WorkspaceRow {
  days_until_deletion: number
}

interface RetentionAnnotated extends WorkspaceRow {
  days_since_trial_end:  number
  days_until_scheduling: number
}

// --- Handler ---

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = authHeader.replace('Bearer ', '')
  const user  = await getUserFromToken(token)
  const isAdmin = await isPlatformAdmin(user?.email)
  if (!user || !isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now       = Date.now()
  const cutoffIso = new Date(now - TRIAL_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const last30Iso = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [scheduledRes, retentionRes, recentLogRes, counterRes] = await Promise.all([
    // 1. Currently scheduled for deletion (binnen 7-day grace window)
    supabaseAdmin
      .from('workspaces')
      .select('id, name, scheduled_for_deletion_at, created_at, workspace_subscriptions!inner(status, trial_ends_at)')
      .not('scheduled_for_deletion_at', 'is', null)
      .order('scheduled_for_deletion_at', { ascending: true }),

    // 2. In retention window (trial expired, niet 'active', nog niet ingepland)
    supabaseAdmin
      .from('workspaces')
      .select('id, name, created_at, workspace_subscriptions!inner(status, trial_ends_at)')
      .neq('workspace_subscriptions.status', 'active')
      .is('scheduled_for_deletion_at', null)
      .not('workspace_subscriptions.trial_ends_at', 'is', null)
      .lte('workspace_subscriptions.trial_ends_at', new Date(now).toISOString())
      .order('workspace_subscriptions.trial_ends_at', { ascending: true }),

    // 3. Recent log events
    supabaseAdmin
      .from('workspace_deletion_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50),

    // 4. Counters laatste 30 dagen
    supabaseAdmin
      .from('workspace_deletion_log')
      .select('event')
      .gte('created_at', last30Iso),
  ])

  const counters: Record<DeletionEvent, number> = { scheduled: 0, deleted: 0, cancelled: 0, error: 0 }
  for (const row of (counterRes.data as CounterRow[]) || []) {
    if (counters[row.event] !== undefined) counters[row.event]++
  }

  // Annoteer scheduled-list met "days_until_deletion"
  const scheduled: ScheduledAnnotated[] = ((scheduledRes.data as unknown as WorkspaceRow[]) || []).map(ws => {
    const msUntil = ws.scheduled_for_deletion_at
      ? new Date(ws.scheduled_for_deletion_at).getTime() - now
      : 0
    return {
      ...ws,
      days_until_deletion: Math.ceil(msUntil / (24 * 60 * 60 * 1000)),
    }
  })

  const retention: RetentionAnnotated[] = ((retentionRes.data as unknown as WorkspaceRow[]) || []).map(ws => {
    const trialEndMs = ws.workspace_subscriptions.trial_ends_at ? new Date(ws.workspace_subscriptions.trial_ends_at).getTime() : now
    const msPast     = now - trialEndMs
    const daysPast   = Math.floor(msPast / (24 * 60 * 60 * 1000))
    return {
      ...ws,
      days_since_trial_end:  daysPast,
      days_until_scheduling: Math.max(0, TRIAL_RETENTION_DAYS - daysPast),
    }
  })

  // Eerstvolgende geplande deletion (handig voor "next run effect" preview)
  const nextDeletion = scheduled[0] ?? null

  return NextResponse.json({
    now: new Date(now).toISOString(),
    config: {
      trial_retention_days: TRIAL_RETENTION_DAYS,
      grace_days:           7,
      cutoff:               cutoffIso,
    },
    scheduled,
    retention,
    next_deletion: nextDeletion,
    recent_log:    (recentLogRes.data as LogRow[]) || [],
    counters_30d:  counters,
  })
}
