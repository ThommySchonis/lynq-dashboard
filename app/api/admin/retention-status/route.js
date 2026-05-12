import { NextResponse } from 'next/server'
import { supabaseAdmin, getUserFromToken } from '../../../../lib/supabaseAdmin'

const ADMIN_EMAIL = 'info@lynqagency.com'
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
export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = authHeader.replace('Bearer ', '')
  const user  = await getUserFromToken(token)
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now      = Date.now()
  const cutoffIso = new Date(now - TRIAL_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const last30Iso = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [scheduledRes, retentionRes, recentLogRes, counterRes] = await Promise.all([
    // 1. Currently scheduled for deletion (binnen 7-day grace window)
    supabaseAdmin
      .from('workspaces')
      .select('id, name, owner_id, subscription_status, trial_ends_at, scheduled_for_deletion_at, created_at')
      .not('scheduled_for_deletion_at', 'is', null)
      .order('scheduled_for_deletion_at', { ascending: true }),

    // 2. In retention window (trial expired, niet 'paying', nog niet ingepland)
    supabaseAdmin
      .from('workspaces')
      .select('id, name, owner_id, subscription_status, trial_ends_at, created_at')
      .neq('subscription_status', 'paying')
      .is('scheduled_for_deletion_at', null)
      .not('trial_ends_at', 'is', null)
      .lte('trial_ends_at', new Date(now).toISOString())
      .order('trial_ends_at', { ascending: true }),

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

  const counters = { scheduled: 0, deleted: 0, cancelled: 0, error: 0 }
  for (const row of counterRes.data || []) {
    if (counters[row.event] !== undefined) counters[row.event]++
  }

  // Annoteer scheduled-list met "days_until_deletion" en "days_in_retention"
  const scheduled = (scheduledRes.data || []).map(ws => {
    const msUntil = new Date(ws.scheduled_for_deletion_at).getTime() - now
    return {
      ...ws,
      days_until_deletion: Math.ceil(msUntil / (24 * 60 * 60 * 1000)),
    }
  })

  const retention = (retentionRes.data || []).map(ws => {
    const trialEndMs = new Date(ws.trial_ends_at).getTime()
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
    recent_log: recentLogRes.data || [],
    counters_30d: counters,
  })
}
