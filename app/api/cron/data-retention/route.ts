import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { executeAccountDeletion } from '@/lib/services/account-deletion'
import { logger } from '@/lib/logger'

// ─── Data retention cleanup job ───────────────────────────────────────
//
// Vercel Cron triggers POST /api/cron/data-retention daily at 03:00 UTC.
// Vercel signs the request with `Authorization: Bearer ${CRON_SECRET}` —
// elke andere caller wordt 401'd.
//
// Drie fases (idempotent — re-runs zijn safe):
//
//   Phase 0 — Cancel: workspace was scheduled, maar user heeft betaald
//             → scheduled_for_deletion_at = null, event 'cancelled'.
//
//   Phase 1 — Schedule: trial verlopen + 60 dagen, nog niet ingepland
//             → scheduled_for_deletion_at = now() + 7 days,
//               event 'scheduled' (triggert email waarschuwing).
//
//   Phase 2 — Delete: scheduled_for_deletion_at is in het verleden
//             EN status is niet 'active'
//             → harde DELETE op workspaces (cascade via FK).
//               Snapshot wordt eerst gelogd als event 'deleted'.
//
// Zie supabase/migrations/20260513_workspace_deletion_log.sql.
// Voor Phase 2 cascade: verify FK ON DELETE CASCADE eerst draaien
// (query staat in de PR description).
// ──────────────────────────────────────────────────────────────────────

const TRIAL_RETENTION_DAYS = 60   // dagen na trial-end voordat deletion gepland wordt
const GRACE_DAYS           = 7    // dagen tussen 'scheduled' en 'deleted'

// ─── Types ────────────────────────────────────────────────────────────

type DeletionEvent = 'scheduled' | 'deleted' | 'cancelled' | 'error'

interface WorkspaceRow {
  id:                         string
  name:                       string | null
  scheduled_for_deletion_at:  string | null
  workspace_subscriptions:    {
    status:        string | null
    trial_ends_at: string | null
  }
}

interface LogEventInput {
  workspaceId:   string
  workspaceName: string | null
  ownerEmail:    string | null
  event:         DeletionEvent
  trialEndsAt:   string | null
  scheduledAt:   string | null
  details:       Record<string, unknown>
}

interface PhaseSummary {
  cancelled?: number
  scheduled?: number
  deleted?:   number
  errors:     number
}

// ─── Helpers ──────────────────────────────────────────────────────────

function unauthorized(reason: string): NextResponse {
  return NextResponse.json({ error: 'Unauthorized', reason }, { status: 401 })
}

async function logEvent({
  workspaceId,
  workspaceName,
  ownerEmail,
  event,
  trialEndsAt,
  scheduledAt,
  details,
}: LogEventInput): Promise<void> {
  const { error } = await supabaseAdmin
    .from('workspace_deletion_log')
    .insert({
      workspace_id:               workspaceId,
      workspace_name:             workspaceName ?? null,
      owner_email:                ownerEmail ?? null,
      event,
      trial_ends_at:              trialEndsAt ?? null,
      scheduled_for_deletion_at:  scheduledAt ?? null,
      details:                    details ?? {},
    })

  if (error) {
    logger.error('[cron/data-retention]', 'log insert failed', { event, workspaceId, error: error.message })
  }
}

async function getOwnerEmail(workspaceId: string): Promise<string | null> {
  try {
    const { data: ownerRow } = await supabaseAdmin
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', workspaceId)
      .eq('role', 'owner')
      .single()
    if (!ownerRow) return null
    const { data, error } = await supabaseAdmin.auth.admin.getUserById((ownerRow as { user_id: string }).user_id)
    if (error) return null
    return data?.user?.email ?? null
  } catch {
    return null
  }
}

// ─── Phase 0 — Cancel scheduled deletions for paying workspaces ──────

async function runCancelPhase(): Promise<PhaseSummary> {
  const { data, error } = await supabaseAdmin
    .from('workspaces')
    .select('id, name, scheduled_for_deletion_at, workspace_subscriptions!inner(status, trial_ends_at)')
    .eq('workspace_subscriptions.status', 'active')
    .not('scheduled_for_deletion_at', 'is', null)

  if (error) {
    logger.error('[cron/data-retention]', 'phase 0 query failed', { error: error.message })
    return { cancelled: 0, errors: 1 }
  }

  let cancelled = 0
  let errors    = 0

  for (const ws of (data as unknown as WorkspaceRow[]) || []) {
    const { error: updateError } = await supabaseAdmin
      .from('workspaces')
      .update({ scheduled_for_deletion_at: null })
      .eq('id', ws.id)

    if (updateError) {
      errors++
      logger.error('[cron/data-retention]', 'phase 0 update failed', { workspaceId: ws.id, error: updateError.message })
      await logEvent({
        workspaceId:   ws.id,
        workspaceName: ws.name,
        ownerEmail:    await getOwnerEmail(ws.id),
        event:         'error',
        trialEndsAt:   ws.workspace_subscriptions.trial_ends_at,
        scheduledAt:   ws.scheduled_for_deletion_at,
        details:       { phase: 'cancel', message: updateError.message },
      })
      continue
    }

    cancelled++
    await logEvent({
      workspaceId:   ws.id,
      workspaceName: ws.name,
      ownerEmail:    await getOwnerEmail(ws.id),
      event:         'cancelled',
      trialEndsAt:   ws.workspace_subscriptions.trial_ends_at,
      scheduledAt:   ws.scheduled_for_deletion_at,
      details:       { phase: 'cancel', reason: 'status=active' },
    })
  }

  return { cancelled, errors }
}

// ─── Phase 1 — Schedule expired-60d workspaces for deletion ──────────

async function runSchedulePhase(): Promise<PhaseSummary> {
  const cutoffIso  = new Date(Date.now() - TRIAL_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const scheduleAt = new Date(Date.now() + GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString()

  // Niet 'active', niet al ingepland, trial >60 dagen voorbij.
  const { data, error } = await supabaseAdmin
    .from('workspaces')
    .select('id, name, scheduled_for_deletion_at, workspace_subscriptions!inner(status, trial_ends_at)')
    .neq('workspace_subscriptions.status', 'active')
    .is('scheduled_for_deletion_at', null)
    .not('workspace_subscriptions.trial_ends_at', 'is', null)
    .lte('workspace_subscriptions.trial_ends_at', cutoffIso)

  if (error) {
    logger.error('[cron/data-retention]', 'phase 1 query failed', { error: error.message })
    return { scheduled: 0, errors: 1 }
  }

  let scheduled = 0
  let errors    = 0

  for (const ws of (data as unknown as WorkspaceRow[]) || []) {
    const { error: updateError } = await supabaseAdmin
      .from('workspaces')
      .update({ scheduled_for_deletion_at: scheduleAt })
      .eq('id', ws.id)
      .is('scheduled_for_deletion_at', null)  // race-safe

    if (updateError) {
      errors++
      logger.error('[cron/data-retention]', 'phase 1 update failed', { workspaceId: ws.id, error: updateError.message })
      await logEvent({
        workspaceId:   ws.id,
        workspaceName: ws.name,
        ownerEmail:    await getOwnerEmail(ws.id),
        event:         'error',
        trialEndsAt:   ws.workspace_subscriptions.trial_ends_at,
        scheduledAt:   null,
        details:       { phase: 'schedule', message: updateError.message },
      })
      continue
    }

    scheduled++
    await logEvent({
      workspaceId:   ws.id,
      workspaceName: ws.name,
      ownerEmail:    await getOwnerEmail(ws.id),
      event:         'scheduled',
      trialEndsAt:   ws.workspace_subscriptions.trial_ends_at,
      scheduledAt:   scheduleAt,
      details:       {
        phase:               'schedule',
        retention_days:      TRIAL_RETENTION_DAYS,
        grace_days:          GRACE_DAYS,
        subscription_status: ws.workspace_subscriptions.status,
      },
    })
  }

  return { scheduled, errors }
}

// ─── Phase 2 — Delete workspaces past their grace window ─────────────

async function runDeletePhase(): Promise<PhaseSummary> {
  const nowIso = new Date().toISOString()

  // scheduled_for_deletion_at is verleden + niet 'active' (laatste safety net,
  // hoewel Phase 0 dit normaal al opruimt).
  const { data, error } = await supabaseAdmin
    .from('workspaces')
    .select('id, name, scheduled_for_deletion_at, workspace_subscriptions!inner(status, trial_ends_at)')
    .neq('workspace_subscriptions.status', 'active')
    .not('scheduled_for_deletion_at', 'is', null)
    .lte('scheduled_for_deletion_at', nowIso)

  if (error) {
    logger.error('[cron/data-retention]', 'phase 2 query failed', { error: error.message })
    return { deleted: 0, errors: 1 }
  }

  let deleted = 0
  let errors  = 0

  for (const ws of (data as unknown as WorkspaceRow[]) || []) {
    const ownerEmail = await getOwnerEmail(ws.id)

    // 1. Log eerst (met snapshot) — daarna delete. Workspace_id staat
    //    los in de log dus blijft leesbaar nadat de row weg is.
    await logEvent({
      workspaceId:   ws.id,
      workspaceName: ws.name,
      ownerEmail,
      event:         'deleted',
      trialEndsAt:   ws.workspace_subscriptions.trial_ends_at,
      scheduledAt:   ws.scheduled_for_deletion_at,
      details:       {
        phase:               'delete',
        subscription_status: ws.workspace_subscriptions.status,
      },
    })

    // 2. Cascade delete via FK ON DELETE CASCADE.
    const { error: deleteError } = await supabaseAdmin
      .from('workspaces')
      .delete()
      .eq('id', ws.id)

    if (deleteError) {
      errors++
      logger.error('[cron/data-retention]', 'phase 2 delete failed', { workspaceId: ws.id, error: deleteError.message })
      await logEvent({
        workspaceId:   ws.id,
        workspaceName: ws.name,
        ownerEmail,
        event:         'error',
        trialEndsAt:   ws.workspace_subscriptions.trial_ends_at,
        scheduledAt:   ws.scheduled_for_deletion_at,
        details:       { phase: 'delete', message: deleteError.message },
      })
      continue
    }

    // 3. Owner auth.users cleanup is bewust niet onderdeel van deze job —
    //    een user kan op meerdere workspaces zitten. Workspace_members
    //    cascade ruimt zijn membership in deze workspace al op.

    deleted++
  }

  return { deleted, errors }
}

// ─── Handler ─────────────────────────────────────────────────────────

async function handle(request: NextRequest): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    logger.error('[cron/data-retention]', 'CRON_SECRET not configured')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (token !== expected) {
    return unauthorized('cron-secret-mismatch')
  }

  const startedAt = Date.now()
  logger.info('[cron/data-retention]', 'start')

  const cancel   = await runCancelPhase()
  const schedule = await runSchedulePhase()
  const del      = await runDeletePhase()

  // Phase 3 — Account Deletion
  const accountPhase: PhaseSummary = { deleted: 0, errors: 0 }

  const { data: accountsToDelete, error: accountFetchError } = await supabaseAdmin
    .from('user_profiles')
    .select('user_id')
    .not('scheduled_for_deletion_at', 'is', null)
    .lte('scheduled_for_deletion_at', new Date().toISOString())

  if (accountFetchError) {
    logger.error('[cron/data-retention]', 'Phase 3 fetch error', { error: accountFetchError.message })
    accountPhase.errors++
  } else {
    for (const account of accountsToDelete ?? []) {
      const userId = (account as { user_id: string }).user_id
      try {
        // Look up email before deletion
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId)
        const email = authUser?.user?.email ?? 'unknown'

        await executeAccountDeletion(userId, email)
        accountPhase.deleted = (accountPhase.deleted ?? 0) + 1
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        logger.error('[cron/data-retention]', 'Phase 3 error for user', { userId, error: message })

        // Log error to account_deletion_log
        await supabaseAdmin.from('account_deletion_log').insert({
          user_id:    userId,
          user_email: 'unknown',
          event:      'error',
          metadata:   { error: message },
        })

        accountPhase.errors++
      }
    }
  }

  const summary = {
    ok:          true,
    started_at:  new Date(startedAt).toISOString(),
    duration_ms: Date.now() - startedAt,
    phases: {
      cancel,
      schedule,
      delete:        del,
      accountDelete: accountPhase,
    },
  }

  logger.info('[cron/data-retention]', 'done', summary)
  return NextResponse.json(summary)
}

// Vercel Cron stuurt POST. GET wordt ondersteund voor handmatige tests
// (curl met Bearer ${CRON_SECRET}).
export const POST = handle
export const GET  = handle
