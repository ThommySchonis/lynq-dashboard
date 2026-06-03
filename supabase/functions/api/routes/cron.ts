import { Hono } from 'hono'
import { getAdminClient } from '../lib/supabase.ts'
import { startCronRun, endCronRun } from '../lib/services/cron-logger.ts'
import { executeAccountDeletion } from '../lib/services/account-deletion.ts'
import { sendSuspensionEmail } from '../lib/email.ts'
import { logger } from '../lib/logger.ts'

const app = new Hono()

// ── Helper: verify CRON_SECRET ──────────────────────────────────────

function verifyCronSecret(authHeader: string | undefined): boolean {
  const secret = Deno.env.get('CRON_SECRET')
  if (!secret) return false
  return authHeader === `Bearer ${secret}`
}

// ── Helper: log workspace deletion event ────────────────────────────

async function logEvent(params: {
  workspaceId: string
  event: string
  metadata?: Record<string, unknown>
}) {
  const sb = getAdminClient()
  await sb.from('workspace_deletion_log').insert({
    workspace_id: params.workspaceId,
    event: params.event,
    metadata: params.metadata ?? null,
  })
}

// ── Helper: get owner email for a workspace ─────────────────────────

async function getOwnerEmail(workspaceId: string): Promise<string | null> {
  const sb = getAdminClient()
  const { data: ownerMember } = await sb
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .eq('role', 'owner')
    .maybeSingle()

  if (!ownerMember) return null

  const { data: userData } = await sb.auth.admin.getUserById(
    (ownerMember as { user_id: string }).user_id,
  )
  return userData?.user?.email ?? null
}

// ── POST|GET /data-retention ────────────────────────────────────────

const dataRetentionHandler = async (c: { req: { header: (name: string) => string | undefined }; json: (data: unknown, status?: number) => Response }) => {
  if (!verifyCronSecret(c.req.header('authorization'))) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const runId = await startCronRun('data-retention', 'edge-function')
  const startTime = Date.now()
  const summary: Record<string, unknown> = {}

  try {
    const sb = getAdminClient()

    // ── Phase 0: Cancel — Active subscriptions with pending deletion
    const { data: toCancel } = await sb
      .from('workspaces')
      .select('id, name, scheduled_for_deletion_at')
      .not('scheduled_for_deletion_at', 'is', null)

    const cancelledIds: string[] = []
    for (const ws of (toCancel ?? []) as { id: string; name: string; scheduled_for_deletion_at: string }[]) {
      // Check if subscription is active
      const { data: sub } = await sb
        .from('workspace_subscriptions')
        .select('status')
        .eq('workspace_id', ws.id)
        .maybeSingle()

      if ((sub as { status: string } | null)?.status === 'active') {
        await sb
          .from('workspaces')
          .update({ scheduled_for_deletion_at: null })
          .eq('id', ws.id)

        await logEvent({
          workspaceId: ws.id,
          event: 'cancelled',
          metadata: { reason: 'subscription_reactivated' },
        })

        cancelledIds.push(ws.id)
        logger.info('[data-retention]', 'Cancelled scheduled deletion (active sub)', { workspaceId: ws.id })
      }
    }
    summary.phase0_cancelled = cancelledIds.length

    // ── Phase 1: Schedule — Inactive workspaces past grace period
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()

    // Find workspaces with inactive subs and no scheduled deletion
    const { data: inactiveSubs } = await sb
      .from('workspace_subscriptions')
      .select('workspace_id, status, trial_ends_at')
      .neq('status', 'active')
      .lte('trial_ends_at', sixtyDaysAgo)

    const scheduledIds: string[] = []
    for (const sub of (inactiveSubs ?? []) as { workspace_id: string; status: string; trial_ends_at: string }[]) {
      // Check that workspace doesn't already have a scheduled deletion
      const { data: ws } = await sb
        .from('workspaces')
        .select('id, scheduled_for_deletion_at')
        .eq('id', sub.workspace_id)
        .is('scheduled_for_deletion_at', null)
        .maybeSingle()

      if (ws) {
        const scheduledFor = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        await sb
          .from('workspaces')
          .update({ scheduled_for_deletion_at: scheduledFor })
          .eq('id', (ws as { id: string }).id)

        await logEvent({
          workspaceId: (ws as { id: string }).id,
          event: 'scheduled',
          metadata: { scheduled_for: scheduledFor, reason: 'inactive_past_grace' },
        })

        scheduledIds.push((ws as { id: string }).id)
        logger.info('[data-retention]', 'Scheduled workspace for deletion', { workspaceId: (ws as { id: string }).id })
      }
    }
    summary.phase1_scheduled = scheduledIds.length

    // ── Phase 2: Delete — Workspaces past their deletion date
    const now = new Date().toISOString()

    // Find workspaces with inactive subs and deletion date in the past
    const { data: toDelete } = await sb
      .from('workspaces')
      .select('id, name, scheduled_for_deletion_at')
      .lte('scheduled_for_deletion_at', now)
      .not('scheduled_for_deletion_at', 'is', null)

    const deletedIds: string[] = []
    for (const ws of (toDelete ?? []) as { id: string; name: string; scheduled_for_deletion_at: string }[]) {
      // Verify subscription is not active
      const { data: sub } = await sb
        .from('workspace_subscriptions')
        .select('status')
        .eq('workspace_id', ws.id)
        .maybeSingle()

      if ((sub as { status: string } | null)?.status === 'active') {
        // Skip — subscription was reactivated
        continue
      }

      // Log snapshot before deletion
      await logEvent({
        workspaceId: ws.id,
        event: 'deleted',
        metadata: {
          workspace_name: ws.name,
          scheduled_for_deletion_at: ws.scheduled_for_deletion_at,
        },
      })

      // Delete workspace (CASCADE handles child records)
      const { error: deleteError } = await sb
        .from('workspaces')
        .delete()
        .eq('id', ws.id)

      if (deleteError) {
        logger.error('[data-retention]', 'Workspace delete failed', {
          workspaceId: ws.id,
          error: deleteError.message,
        })
        continue
      }

      deletedIds.push(ws.id)
      logger.info('[data-retention]', 'Deleted workspace', { workspaceId: ws.id })
    }
    summary.phase2_deleted = deletedIds.length

    // ── Phase 3: Account deletion — Users past their deletion date
    const { data: usersToDelete } = await sb
      .from('user_profiles')
      .select('user_id, scheduled_for_deletion_at')
      .lte('scheduled_for_deletion_at', now)
      .not('scheduled_for_deletion_at', 'is', null)

    const deletedAccounts: string[] = []
    const failedAccounts: string[] = []

    for (const profile of (usersToDelete ?? []) as { user_id: string; scheduled_for_deletion_at: string }[]) {
      try {
        // Look up user email before deletion
        const { data: userData } = await sb.auth.admin.getUserById(profile.user_id)
        const userEmail = userData?.user?.email ?? 'unknown'

        await executeAccountDeletion(profile.user_id, userEmail)
        deletedAccounts.push(profile.user_id)
        logger.info('[data-retention]', 'Executed account deletion', { userId: profile.user_id })
      } catch (err) {
        failedAccounts.push(profile.user_id)
        logger.error('[data-retention]', 'Account deletion failed', {
          userId: profile.user_id,
          error: err instanceof Error ? err.message : 'unknown',
        })
      }
    }
    summary.phase3_accounts_deleted = deletedAccounts.length
    summary.phase3_accounts_failed = failedAccounts.length

    summary.duration_ms = Date.now() - startTime

    const status = failedAccounts.length > 0 ? 'warning' as const : 'success' as const
    await endCronRun(runId, { status, summary })

    return c.json({ ok: true, summary })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    summary.duration_ms = Date.now() - startTime
    await endCronRun(runId, { status: 'failure', summary, errorMessage })
    logger.error('[data-retention]', 'Job failed', { error: errorMessage })
    return c.json({ error: errorMessage }, 500)
  }
}

app.post('/data-retention', dataRetentionHandler)
app.get('/data-retention', dataRetentionHandler)

// ── POST|GET /trial-expiry ──────────────────────────────────────────

const trialExpiryHandler = async (c: { req: { header: (name: string) => string | undefined }; json: (data: unknown, status?: number) => Response }) => {
  if (!verifyCronSecret(c.req.header('authorization'))) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const runId = await startCronRun('trial-expiry', 'edge-function')
  const startTime = Date.now()
  const summary: Record<string, unknown> = {}

  try {
    const sb = getAdminClient()
    const now = new Date().toISOString()

    // ── Phase 1: Expire trials
    const { data: expiredTrials, error: trialError } = await sb
      .from('workspace_subscriptions')
      .select('id, workspace_id')
      .eq('status', 'trial')
      .lte('trial_ends_at', now)

    if (trialError) {
      throw new Error(`Trial query failed: ${trialError.message}`)
    }

    const expiredIds: string[] = []
    for (const trial of (expiredTrials ?? []) as { id: string; workspace_id: string }[]) {
      const { error: updateError } = await sb
        .from('workspace_subscriptions')
        .update({ status: 'past_due' })
        .eq('id', trial.id)

      if (updateError) {
        logger.error('[trial-expiry]', 'Failed to expire trial', {
          subId: trial.id,
          error: updateError.message,
        })
        continue
      }

      expiredIds.push(trial.workspace_id)
      logger.info('[trial-expiry]', 'Trial expired', { workspaceId: trial.workspace_id })
    }
    summary.phase1_expired = expiredIds.length

    // ── Phase 2: Auto-suspend past_due workspaces after 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: pastDueSubs, error: pdError } = await sb
      .from('workspace_subscriptions')
      .select('id, workspace_id')
      .eq('status', 'past_due')
      .lte('updated_at', sevenDaysAgo)

    if (pdError) {
      throw new Error(`Past-due query failed: ${pdError.message}`)
    }

    const suspendedIds: string[] = []
    for (const sub of (pastDueSubs ?? []) as { id: string; workspace_id: string }[]) {
      // Check if workspace is already suspended
      const { data: ws } = await sb
        .from('workspaces')
        .select('id, name, suspended_at')
        .eq('id', sub.workspace_id)
        .is('suspended_at', null)
        .maybeSingle()

      if (!ws) continue

      const typedWs = ws as { id: string; name: string; suspended_at: string | null }

      const suspensionReason = 'Auto-suspended: trial expired and no active subscription after 7 days'

      const { error: suspendError } = await sb
        .from('workspaces')
        .update({
          suspended_at: now,
          suspension_reason: suspensionReason,
        })
        .eq('id', typedWs.id)

      if (suspendError) {
        logger.error('[trial-expiry]', 'Failed to suspend workspace', {
          workspaceId: typedWs.id,
          error: suspendError.message,
        })
        continue
      }

      // Send suspension email to owner
      const ownerEmail = await getOwnerEmail(typedWs.id)
      if (ownerEmail) {
        await sendSuspensionEmail({
          to: ownerEmail,
          workspaceName: typedWs.name,
          reason: suspensionReason,
        })
      }

      suspendedIds.push(typedWs.id)
      logger.info('[trial-expiry]', 'Auto-suspended workspace', { workspaceId: typedWs.id })
    }
    summary.phase2_suspended = suspendedIds.length

    summary.duration_ms = Date.now() - startTime
    await endCronRun(runId, { status: 'success', summary })

    return c.json({ ok: true, summary })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    summary.duration_ms = Date.now() - startTime
    await endCronRun(runId, { status: 'failure', summary, errorMessage })
    logger.error('[trial-expiry]', 'Job failed', { error: errorMessage })
    return c.json({ error: errorMessage }, 500)
  }
}

app.post('/trial-expiry', trialExpiryHandler)
app.get('/trial-expiry', trialExpiryHandler)

// ── POST|GET /usage-warnings ────────────────────────────────────────

const usageWarningsHandler = async (c: { req: { header: (name: string) => string | undefined }; json: (data: unknown, status?: number) => Response }) => {
  if (!verifyCronSecret(c.req.header('authorization'))) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const runId = await startCronRun('usage-warnings', 'edge-function')
  const startTime = Date.now()
  const summary: Record<string, unknown> = {}

  try {
    const sb = getAdminClient()
    const now = new Date().toISOString()

    // Find usage counters that haven't been notified at 100% and are in current period
    const { data: counters, error: counterError } = await sb
      .from('usage_counters')
      .select('*')
      .is('notified_100_at', null)
      .gte('period_end', now)

    if (counterError) {
      throw new Error(`Usage counter query failed: ${counterError.message}`)
    }

    if (!counters || counters.length === 0) {
      summary.checked = 0
      summary.notified_100 = 0
      summary.notified_80 = 0
      summary.duration_ms = Date.now() - startTime
      await endCronRun(runId, { status: 'success', summary })
      return c.json({ ok: true, summary })
    }

    const typedCounters = counters as {
      id: string
      workspace_id: string
      tickets_used: number
      ai_suggest_used: number
      notified_80_at: string | null
      notified_100_at: string | null
    }[]

    // Fetch subscriptions and plans in bulk
    const workspaceIds = [...new Set(typedCounters.map((c) => c.workspace_id))]

    const { data: subs } = await sb
      .from('workspace_subscriptions')
      .select('workspace_id, plan_id')
      .in('workspace_id', workspaceIds)

    const typedSubs = (subs ?? []) as { workspace_id: string; plan_id: string }[]
    const subByWorkspace: Record<string, string> = {}
    const planIds = new Set<string>()
    for (const sub of typedSubs) {
      subByWorkspace[sub.workspace_id] = sub.plan_id
      planIds.add(sub.plan_id)
    }

    const { data: plans } = await sb
      .from('plans')
      .select('id, ticket_limit, ai_suggest_limit')
      .in('id', [...planIds])

    const typedPlans = (plans ?? []) as { id: string; ticket_limit: number | null; ai_suggest_limit: number | null }[]
    const planById: Record<string, { ticket_limit: number | null; ai_suggest_limit: number | null }> = {}
    for (const plan of typedPlans) {
      planById[plan.id] = { ticket_limit: plan.ticket_limit, ai_suggest_limit: plan.ai_suggest_limit }
    }

    let notified100 = 0
    let notified80 = 0

    for (const counter of typedCounters) {
      const planId = subByWorkspace[counter.workspace_id]
      if (!planId) continue

      const plan = planById[planId]
      if (!plan) continue

      const ticketPct = plan.ticket_limit
        ? (counter.tickets_used / plan.ticket_limit) * 100
        : 0
      const aiPct = plan.ai_suggest_limit
        ? (counter.ai_suggest_used / plan.ai_suggest_limit) * 100
        : 0

      if (ticketPct >= 100 || aiPct >= 100) {
        // Notify at 100%
        await sb
          .from('usage_counters')
          .update({ notified_100_at: now })
          .eq('id', counter.id)

        notified100++
        logger.info('[usage-warnings]', '100% usage notification', {
          workspaceId: counter.workspace_id,
          ticketPct: Math.round(ticketPct),
          aiPct: Math.round(aiPct),
        })
      } else if ((ticketPct >= 80 || aiPct >= 80) && !counter.notified_80_at) {
        // Notify at 80%
        await sb
          .from('usage_counters')
          .update({ notified_80_at: now })
          .eq('id', counter.id)

        notified80++
        logger.info('[usage-warnings]', '80% usage notification', {
          workspaceId: counter.workspace_id,
          ticketPct: Math.round(ticketPct),
          aiPct: Math.round(aiPct),
        })
      }
    }

    summary.checked = typedCounters.length
    summary.notified_100 = notified100
    summary.notified_80 = notified80
    summary.duration_ms = Date.now() - startTime

    await endCronRun(runId, { status: 'success', summary })

    return c.json({ ok: true, summary })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    summary.duration_ms = Date.now() - startTime
    await endCronRun(runId, { status: 'failure', summary, errorMessage })
    logger.error('[usage-warnings]', 'Job failed', { error: errorMessage })
    return c.json({ error: errorMessage }, 500)
  }
}

app.post('/usage-warnings', usageWarningsHandler)
app.get('/usage-warnings', usageWarningsHandler)

export { app as cronRoutes }
