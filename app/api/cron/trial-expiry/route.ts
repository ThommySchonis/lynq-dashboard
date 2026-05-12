import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

// ─── Trial expiry cron ────────────────────────────────────────────────
//
// Daily 03:30 UTC. Vercel signs the request with
// `Authorization: Bearer ${CRON_SECRET}`.
//
// For each workspace_subscription where:
//   - status == 'trial'
//   - trial_ends_at <= now()
// the row is flipped to status='past_due' so the existing blocked-state
// machinery in proxy.ts kicks in (which redirects the user to
// /pricing-required for self-upgrade).
//
// Why past_due and not canceled: keeps the subscription record alive
// so when the user picks a plan + pays, we update the same row to
// 'active' without re-provisioning. After 60 days unchanged, a future
// retention cron (separate PR) schedules the workspace for deletion.
//
// Idempotent: re-running for an already-expired trial is a no-op.
// ──────────────────────────────────────────────────────────────────────

function unauthorized(reason: string): NextResponse {
  return NextResponse.json({ error: 'Unauthorized', reason }, { status: 401 })
}

async function handle(request: NextRequest): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    console.error('[cron/trial-expiry] CRON_SECRET not configured')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (token !== expected) return unauthorized('cron-secret-mismatch')

  const startedAt = Date.now()
  console.log('[cron/trial-expiry] start')

  // Find expired trials
  const { data: expired, error } = await supabaseAdmin
    .from('workspace_subscriptions')
    .select('id, workspace_id, plan_id, trial_ends_at')
    .eq('status', 'trial')
    .not('trial_ends_at', 'is', null)
    .lte('trial_ends_at', new Date().toISOString())

  if (error) {
    console.error('[cron/trial-expiry] query failed:', error.message)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  // Bulk update — single SQL statement, race-safe via the `eq('status','trial')`
  // guard (won't downgrade something that's since been upgraded).
  let updated = 0
  for (const sub of expired || []) {
    const { error: updateError } = await supabaseAdmin
      .from('workspace_subscriptions')
      .update({ status: 'past_due' })
      .eq('id', sub.id)
      .eq('status', 'trial')        // race guard

    if (updateError) {
      console.error('[cron/trial-expiry] update failed for', sub.workspace_id, updateError.message)
      continue
    }
    updated++
    console.log('[cron/trial-expiry] expired workspace', sub.workspace_id, '(trial ended', sub.trial_ends_at, ')')

    // Mirror the change onto the legacy workspaces.subscription_status
    // column so proxy.ts's existing blocked-state check (which reads
    // from workspaces, not workspace_subscriptions, until PR 2 swaps
    // it over) keeps working.
    await supabaseAdmin
      .from('workspaces')
      .update({ subscription_status: 'expired' })
      .eq('id', sub.workspace_id)
  }

  const summary = {
    ok:           true,
    started_at:   new Date(startedAt).toISOString(),
    duration_ms:  Date.now() - startedAt,
    found:        expired?.length ?? 0,
    expired:      updated,
  }
  console.log('[cron/trial-expiry] done', JSON.stringify(summary))
  return NextResponse.json(summary)
}

export const POST = handle
export const GET  = handle
