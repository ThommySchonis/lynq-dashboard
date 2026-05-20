import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// ─── Usage warnings cron ──────────────────────────────────────────────
//
// Hourly. Finds counters where tickets_used or ai_suggest_used has
// crossed 80% or 100% of plan limits, sends email notification, and
// stamps `notified_80_at` / `notified_100_at` so we don't double-fire.
//
// Email delivery is a stub for v1 — logs the intent + persists the
// timestamp. PR 2 wires the actual Resend send (need template first).
// In-app notifications are deferred to a separate sprint.
// ──────────────────────────────────────────────────────────────────────

interface CounterRow {
  id:                string
  workspace_id:      string
  period_start:      string
  period_end:        string
  tickets_used:      number
  ai_suggest_used:   number
  notified_80_at:    string | null
  notified_100_at:   string | null
}

interface SubRow {
  workspace_id: string
  plan_id:      string
}

interface PlanRow {
  id:               string
  ticket_limit:     number | null
  ai_suggest_limit: number | null
  is_custom:        boolean
}

interface NotifyEvent {
  type:         'approaching_limit' | 'limit_reached'
  workspace_id: string
  tickets_pct:  number
  ai_pct:       number
}

interface OneResult {
  ok:           boolean
  workspace_id: string
  error?:       string
  events?:      NotifyEvent[]
}

function unauthorized(reason: string): NextResponse {
  return NextResponse.json({ error: 'Unauthorized', reason }, { status: 401 })
}

async function processOne({
  counter,
  sub,
  plan,
}: {
  counter: CounterRow
  sub: SubRow
  plan: PlanRow
}): Promise<OneResult> {
  const ticketLimit = plan.ticket_limit
  const aiLimit     = plan.ai_suggest_limit

  const ticketsPct = ticketLimit ? (counter.tickets_used    / ticketLimit) * 100 : 0
  const aiPct      = aiLimit     ? (counter.ai_suggest_used / aiLimit)     * 100 : 0

  const updates: { notified_80_at?: string; notified_100_at?: string } = {}
  const events: NotifyEvent[] = []

  // 100% — fires only if we haven't already notified
  if ((ticketsPct >= 100 || aiPct >= 100) && !counter.notified_100_at) {
    updates.notified_100_at = new Date().toISOString()
    events.push({
      type:        'limit_reached',
      workspace_id: sub.workspace_id,
      tickets_pct: Math.round(ticketsPct),
      ai_pct:      Math.round(aiPct),
    })
    console.log('[cron/usage-warnings] 100% reached for workspace', sub.workspace_id, 'plan', plan.id)
    // TODO PR 2: send "you've reached your plan limit" email via Resend
  }

  // 80% — fires only if we haven't already notified AND we haven't hit 100% yet
  if ((ticketsPct >= 80 || aiPct >= 80) && !counter.notified_80_at && !counter.notified_100_at) {
    updates.notified_80_at = new Date().toISOString()
    events.push({
      type:        'approaching_limit',
      workspace_id: sub.workspace_id,
      tickets_pct: Math.round(ticketsPct),
      ai_pct:      Math.round(aiPct),
    })
    console.log('[cron/usage-warnings] 80% reached for workspace', sub.workspace_id)
    // TODO PR 2: send "approaching limit" email via Resend
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await supabaseAdmin
      .from('usage_counters')
      .update(updates)
      .eq('id', counter.id)
    if (error) {
      console.error('[cron/usage-warnings] update failed for', sub.workspace_id, error.message)
      return { ok: false, workspace_id: sub.workspace_id, error: error.message }
    }
  }

  return { ok: true, workspace_id: sub.workspace_id, events }
}

async function handle(request: NextRequest): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET
  if (!expected) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (token !== expected) return unauthorized('cron-secret-mismatch')

  const startedAt = Date.now()
  console.log('[cron/usage-warnings] start')

  // Find counters in an active period (period_end in future) where we
  // haven't yet sent the 100% notification.
  const { data: counters, error } = await supabaseAdmin
    .from('usage_counters')
    .select('id, workspace_id, period_start, period_end, tickets_used, ai_suggest_used, notified_80_at, notified_100_at')
    .is('notified_100_at', null)
    .gte('period_end', new Date().toISOString())

  if (error) {
    console.error('[cron/usage-warnings] query failed:', error.message)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const counterList = (counters as CounterRow[]) || []

  // Fetch subscriptions + plans in bulk to avoid N+1
  const workspaceIds = [...new Set(counterList.map(c => c.workspace_id))]
  const [{ data: subs }, { data: plans }] = await Promise.all([
    supabaseAdmin
      .from('workspace_subscriptions')
      .select('workspace_id, plan_id')
      .in('workspace_id', workspaceIds),
    supabaseAdmin
      .from('plans')
      .select('id, ticket_limit, ai_suggest_limit, is_custom'),
  ])

  const subByWs:  Record<string, SubRow>  = Object.fromEntries(((subs  as SubRow[])  ?? []).map(s => [s.workspace_id, s]))
  const planById: Record<string, PlanRow> = Object.fromEntries(((plans as PlanRow[]) ?? []).map(p => [p.id, p]))

  const results: OneResult[] = []
  for (const counter of counterList) {
    const sub  = subByWs[counter.workspace_id]
    const plan = sub ? planById[sub.plan_id] : null
    if (!sub || !plan) continue
    // Skip custom plans (no limit to warn about)
    if (plan.is_custom || plan.ticket_limit == null) continue

    try {
      results.push(await processOne({ counter, sub, plan }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[cron/usage-warnings] unhandled error:', msg)
      results.push({ ok: false, workspace_id: counter.workspace_id, error: msg })
    }
  }

  const allEvents = results.flatMap(r => r.events || [])
  const summary = {
    ok:           true,
    started_at:   new Date(startedAt).toISOString(),
    duration_ms:  Date.now() - startedAt,
    processed:    results.length,
    notified_80:  allEvents.filter(e => e.type === 'approaching_limit').length,
    notified_100: allEvents.filter(e => e.type === 'limit_reached').length,
  }
  console.log('[cron/usage-warnings] done', JSON.stringify(summary))
  return NextResponse.json(summary)
}

export const POST = handle
export const GET  = handle
