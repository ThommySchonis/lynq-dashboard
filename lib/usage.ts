// Usage tracking for the billing system.
//
// All writes go through supabaseAdmin (RLS bypass) because they are
// called from API routes that have already validated the caller via
// getAuthContext. The workspace_id is passed in explicitly so this
// module never needs to re-derive auth context.
//
// Period model:
//   - Each workspace has at most one "current" usage_counters row,
//     identified by period_start matching the active subscription's
//     current_period_start.
//   - The billing-period-rollover cron creates the next row when a
//     period ends. If a counter is missing (e.g. brand-new trial),
//     ensureCurrentPeriod() lazily creates one — keeps the increment
//     path simple.
//   - All counters are atomic Postgres increments to avoid races
//     under concurrent requests.

import { supabaseAdmin } from './supabaseAdmin'
import { logger } from '@/lib/logger'

const MS_PER_DAY = 24 * 60 * 60 * 1000

// ─── Types ────────────────────────────────────────────────────────────

export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'canceled' | 'paused'

export interface WorkspaceSubscription {
  id:                   string
  plan_id:              string
  status:               SubscriptionStatus
  trial_ends_at:        string | null
  current_period_start: string
  current_period_end:   string
  cancel_at_period_end: boolean
}

export interface Plan {
  id:               string
  display_name:     string
  price_eur:        number | null
  ticket_limit:     number | null
  ai_suggest_limit: number | null
  is_custom:        boolean
}

export interface UsageCounter {
  id:                   string
  workspace_id:         string
  period_start:         string
  period_end:           string
  tickets_used:         number
  ai_suggest_used:      number
  ai_resolutions_used:  number
  tickets_overage:      number
  ai_suggest_overage:   number
  notified_80_at:       string | null
  notified_100_at:      string | null
}

export interface UsageBundle {
  subscription: WorkspaceSubscription
  plan:         Plan
  counter:      UsageCounter
  percentages: {
    tickets:    number
    ai_suggest: number
  }
  limits: {
    tickets_reached:    boolean
    ai_suggest_reached: boolean
    tickets_at_80:      boolean
    ai_suggest_at_80:   boolean
  }
  trial_days_remaining: number | null
}

export interface IncrementResult {
  counted: boolean
  overage: boolean
}

export interface CheckLimitsResult {
  ticketLimitReached:    boolean
  aiSuggestLimitReached: boolean
  percentages: {
    tickets:    number
    ai_suggest: number
  }
}

// ============================================================
// Reads
// ============================================================

/**
 * Returns the active subscription row for a workspace, or null. Used
 * by the limit-check helpers below + by the cron jobs.
 */
export async function getSubscription(workspaceId: string): Promise<WorkspaceSubscription | null> {
  const { data, error } = await supabaseAdmin
    .from('workspace_subscriptions')
    .select('id, plan_id, status, trial_ends_at, current_period_start, current_period_end, cancel_at_period_end')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (error) {
    logger.error('[usage]', 'getSubscription failed', { error: error.message })
    return null
  }
  return data as WorkspaceSubscription | null
}

/**
 * Returns the plan definition for a plan_id, including limits + pricing.
 */
export async function getPlan(planId: string): Promise<Plan | null> {
  const { data, error } = await supabaseAdmin
    .from('plans')
    .select('id, display_name, price_eur, ticket_limit, ai_suggest_limit, is_custom')
    .eq('id', planId)
    .maybeSingle()

  if (error) {
    logger.error('[usage]', 'getPlan failed', { error: error.message })
    return null
  }
  return data as Plan | null
}

/**
 * Returns the current period's usage_counters row for a workspace.
 * Creates one if missing (lazy init for new trials).
 *
 * Returns null if the workspace has no subscription at all (shouldn't
 * happen for provisioned workspaces but defended against).
 */
export async function ensureCurrentPeriod(workspaceId: string): Promise<UsageCounter | null> {
  const sub = await getSubscription(workspaceId)
  if (!sub) {
    logger.error('[usage]', 'ensureCurrentPeriod: no subscription', { workspaceId })
    return null
  }

  const existingResult = await supabaseAdmin
    .from('usage_counters')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('period_start', sub.current_period_start)
    .maybeSingle()

  if (existingResult.data) return existingResult.data as UsageCounter

  // Lazy-create. Race-safe via the (workspace_id, period_start) unique
  // index — concurrent inserts will conflict; we re-fetch on conflict.
  const createResult = await supabaseAdmin
    .from('usage_counters')
    .insert({
      workspace_id:  workspaceId,
      period_start:  sub.current_period_start,
      period_end:    sub.current_period_end,
    })
    .select('*')
    .single()

  if (createResult.error) {
    const insertError = createResult.error
    // Conflict → another request just created it. Re-fetch.
    if (insertError.code === '23505') {
      const refetchResult = await supabaseAdmin
        .from('usage_counters')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('period_start', sub.current_period_start)
        .single()
      return refetchResult.data as UsageCounter | null
    }
    logger.error('[usage]', 'ensureCurrentPeriod insert failed', { error: insertError.message })
    return null
  }
  return createResult.data as UsageCounter
}

/**
 * Bundle returned by getCurrentUsage — the shape every UI surface uses.
 */
export async function getCurrentUsage(workspaceId: string): Promise<UsageBundle | null> {
  const sub = await getSubscription(workspaceId)
  if (!sub) return null

  const [plan, counter] = await Promise.all([
    getPlan(sub.plan_id),
    ensureCurrentPeriod(workspaceId),
  ])

  if (!plan || !counter) return null

  // Custom/null limits (Elite, or trial with no enforcement) → 0% used
  // for display purposes but never "reached".
  const ticketLimit    = plan.ticket_limit
  const aiSuggestLimit = plan.ai_suggest_limit

  const ticketsPct    = ticketLimit    ? Math.min(100, Math.round((counter.tickets_used    / ticketLimit)    * 100)) : 0
  const aiSuggestPct  = aiSuggestLimit ? Math.min(100, Math.round((counter.ai_suggest_used / aiSuggestLimit) * 100)) : 0

  const trialDays = sub.trial_ends_at && sub.status === 'trial'
    ? Math.max(0, Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / MS_PER_DAY))
    : null

  return {
    subscription: sub,
    plan,
    counter,
    percentages: {
      tickets:    ticketsPct,
      ai_suggest: aiSuggestPct,
    },
    limits: {
      tickets_reached:    ticketLimit    ? counter.tickets_used    >= ticketLimit    : false,
      ai_suggest_reached: aiSuggestLimit ? counter.ai_suggest_used >= aiSuggestLimit : false,
      tickets_at_80:      ticketLimit    ? counter.tickets_used    >= ticketLimit    * 0.8 : false,
      ai_suggest_at_80:   aiSuggestLimit ? counter.ai_suggest_used >= aiSuggestLimit * 0.8 : false,
    },
    trial_days_remaining: trialDays,
  }
}

/**
 * Lightweight version of getCurrentUsage — returns just the flags,
 * no plan or subscription bundle. For pre-flight checks before
 * triggering an expensive operation.
 */
export async function checkLimits(workspaceId: string): Promise<CheckLimitsResult> {
  const usage = await getCurrentUsage(workspaceId)
  if (!usage) {
    return {
      ticketLimitReached:    false,
      aiSuggestLimitReached: false,
      percentages:           { tickets: 0, ai_suggest: 0 },
    }
  }
  return {
    ticketLimitReached:    usage.limits.tickets_reached,
    aiSuggestLimitReached: usage.limits.ai_suggest_reached,
    percentages:           usage.percentages,
  }
}

// ============================================================
// Writes — atomic increments
// ============================================================

/**
 * Increment the ticket counter for a workspace's current period.
 * Returns { counted, overage } so callers can surface state to the UI.
 *
 * NB: This is the low-level increment. The reactivation rules from
 * the spec (10-day window, spam exclusion, etc.) live in
 * `recordOutboundMessage()` — added in PR 3 (inbox integration).
 */
export async function incrementTicketUsage(workspaceId: string): Promise<IncrementResult> {
  const counter = await ensureCurrentPeriod(workspaceId)
  if (!counter) return { counted: false, overage: false }

  const plan = await getPlanForWorkspace(workspaceId)
  const limit = plan?.ticket_limit ?? null

  const isOverage = limit != null && counter.tickets_used >= limit

  const updates = isOverage
    ? { tickets_overage: (counter.tickets_overage ?? 0) + 1 }
    : { tickets_used:    (counter.tickets_used    ?? 0) + 1 }

  const { error } = await supabaseAdmin
    .from('usage_counters')
    .update(updates)
    .eq('id', counter.id)

  if (error) {
    logger.error('[usage]', 'incrementTicketUsage failed', { error: error.message })
    return { counted: false, overage: false }
  }

  return { counted: true, overage: isOverage }
}

/**
 * Increment the AI Suggest counter. Same pattern as tickets — overage
 * is tracked separately for separate per-unit billing (€0.10/call).
 */
export async function incrementAISuggestUsage(workspaceId: string): Promise<IncrementResult> {
  const counter = await ensureCurrentPeriod(workspaceId)
  if (!counter) return { counted: false, overage: false }

  const plan  = await getPlanForWorkspace(workspaceId)
  const limit = plan?.ai_suggest_limit ?? null

  const isOverage = limit != null && counter.ai_suggest_used >= limit

  const updates = isOverage
    ? { ai_suggest_overage: (counter.ai_suggest_overage ?? 0) + 1 }
    : { ai_suggest_used:    (counter.ai_suggest_used    ?? 0) + 1 }

  const { error } = await supabaseAdmin
    .from('usage_counters')
    .update(updates)
    .eq('id', counter.id)

  if (error) {
    logger.error('[usage]', 'incrementAISuggestUsage failed', { error: error.message })
    return { counted: false, overage: false }
  }

  return { counted: true, overage: isOverage }
}

/**
 * Increment the AI Resolutions counter. Tracked-only at launch — Emma
 * is "coming soon", so no actual code path calls this yet, but the
 * counter exists so usage data is ready the day Emma flips on.
 *
 * No overage tracking — Emma is pay-per-use (€0.15/resolution), so
 * every increment is billable; no "limit" concept.
 */
export async function incrementAIResolutionUsage(workspaceId: string): Promise<{ counted: boolean }> {
  const counter = await ensureCurrentPeriod(workspaceId)
  if (!counter) return { counted: false }

  const { error } = await supabaseAdmin
    .from('usage_counters')
    .update({ ai_resolutions_used: (counter.ai_resolutions_used ?? 0) + 1 })
    .eq('id', counter.id)

  if (error) {
    logger.error('[usage]', 'incrementAIResolutionUsage failed', { error: error.message })
    return { counted: false }
  }
  return { counted: true }
}

// ============================================================
// Internal helpers
// ============================================================

async function getPlanForWorkspace(workspaceId: string): Promise<Plan | null> {
  const sub = await getSubscription(workspaceId)
  if (!sub) return null
  return await getPlan(sub.plan_id)
}
