import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

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

  // ── Phase 2: Auto-suspend workspaces past_due for 7+ days ──────────
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: pastDue } = await supabaseAdmin
    .from('workspace_subscriptions')
    .select('id, workspace_id')
    .eq('status', 'past_due')
    .lte('updated_at', sevenDaysAgo)

  let autoSuspended = 0
  for (const sub of pastDue || []) {
    // Skip if already suspended
    const { data: ws } = await supabaseAdmin
      .from('workspaces')
      .select('suspended_at, name')
      .eq('id', sub.workspace_id)
      .single()

    if (!ws || ws.suspended_at) continue

    const { error: suspendError } = await supabaseAdmin
      .from('workspaces')
      .update({
        suspended_at: new Date().toISOString(),
        suspension_reason: 'Unpaid invoice — subscription past due',
      })
      .eq('id', sub.workspace_id)

    if (suspendError) {
      console.error('[cron/trial-expiry] auto-suspend failed for', sub.workspace_id, suspendError.message)
      continue
    }

    autoSuspended++
    console.log('[cron/trial-expiry] auto-suspended workspace', sub.workspace_id)

    // Send suspension email to owner (find via workspace_members, not workspaces.owner_id)
    const { data: ownerMember } = await supabaseAdmin
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', sub.workspace_id)
      .eq('role', 'owner')
      .single()

    if (ownerMember?.user_id) {
      const userId = ownerMember.user_id as string
      const { data: { user: ownerUser } } = await supabaseAdmin.auth.admin.getUserById(userId)
      if (ownerUser?.email) {
        const { sendSuspensionEmail } = await import('@/lib/email')
        const workspaceName = (ws.name as string | null) || 'your workspace'
        await sendSuspensionEmail({
          to: ownerUser.email,
          workspaceName,
          reason: 'Unpaid invoice — subscription past due',
        })
      }
    }
  }

  const summary = {
    ok:             true,
    started_at:     new Date(startedAt).toISOString(),
    duration_ms:    Date.now() - startedAt,
    found:          expired?.length ?? 0,
    expired:        updated,
    auto_suspended: autoSuspended,
  }
  console.log('[cron/trial-expiry] done', JSON.stringify(summary))
  return NextResponse.json(summary)
}

export const POST = handle
export const GET  = handle
