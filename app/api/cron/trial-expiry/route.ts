import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'
import { startCronRun, endCronRun } from '@/lib/services/cron-logger'

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

interface ExpiredSubRow {
  id:           string
  workspace_id: string
  plan_id:      string
  trial_ends_at: string | null
}

interface PastDueSubRow {
  id:           string
  workspace_id: string
}

function unauthorized(reason: string): NextResponse {
  return NextResponse.json({ error: 'Unauthorized', reason }, { status: 401 })
}

async function handle(request: NextRequest): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    logger.error('[cron/trial-expiry]', 'CRON_SECRET not configured')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (token !== expected) return unauthorized('cron-secret-mismatch')

  const runId = await startCronRun('trial-expiry', 'vercel-cron')
  const startedAt = Date.now()
  logger.info('[cron/trial-expiry]', 'start')

  try {
    // Find expired trials
    const { data: expired, error } = await supabaseAdmin
      .from('workspace_subscriptions')
      .select('id, workspace_id, plan_id, trial_ends_at')
      .eq('status', 'trial')
      .not('trial_ends_at', 'is', null)
      .lte('trial_ends_at', new Date().toISOString())

    if (error) {
      logger.error('[cron/trial-expiry]', 'query failed', { error: error.message })
      await endCronRun(runId, { status: 'failure', errorMessage: error.message })
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    // Bulk update — single SQL statement, race-safe via the `eq('status','trial')`
    // guard (won't downgrade something that's since been upgraded).
    let updated = 0
    for (const sub of (expired as unknown as ExpiredSubRow[]) || []) {
      const { error: updateError } = await supabaseAdmin
        .from('workspace_subscriptions')
        .update({ status: 'past_due' })
        .eq('id', sub.id)
        .eq('status', 'trial')        // race guard

      if (updateError) {
        logger.error('[cron/trial-expiry]', 'update failed', { workspaceId: sub.workspace_id, error: updateError.message })
        continue
      }
      updated++
      logger.info('[cron/trial-expiry]', 'expired workspace', { workspaceId: sub.workspace_id, trialEndsAt: sub.trial_ends_at })
    }

    // ── Phase 2: Auto-suspend workspaces past_due for 7+ days ──────────
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: pastDue } = await supabaseAdmin
      .from('workspace_subscriptions')
      .select('id, workspace_id')
      .eq('status', 'past_due')
      .lte('updated_at', sevenDaysAgo)

    let autoSuspended = 0
    for (const sub of (pastDue as unknown as PastDueSubRow[]) || []) {
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
        logger.error('[cron/trial-expiry]', 'auto-suspend failed', { workspaceId: sub.workspace_id, error: suspendError.message })
        continue
      }

      autoSuspended++
      logger.info('[cron/trial-expiry]', 'auto-suspended workspace', { workspaceId: sub.workspace_id })

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

    await endCronRun(runId, { status: 'success', summary })

    logger.info('[cron/trial-expiry]', 'done', summary)
    return NextResponse.json(summary)
  } catch (err) {
    await endCronRun(runId, { status: 'failure', errorMessage: err instanceof Error ? err.message : String(err) })
    throw err
  }
}

export const POST = handle
export const GET  = handle
