// lib/services/limit-check.ts
//
// Model 3 (forced upgrade) hard-cap checks for the helpdesk billing flow.
// See docs/billing-model.md for the decision rationale.
//
// Read functions return a uniform { allowed, used, limit, percentageUsed }
// shape — callers compare `allowed` and react. `lockWorkspace` and
// `unlockWorkspace` flip the workspace_subscriptions.write_locked flag.
//
// All writes go through supabaseAdmin (RLS bypass). Callers are expected
// to have verified the workspace context via getAuthContext before
// invoking these helpers.

import { supabaseAdmin } from '../supabaseAdmin'

export type LimitResource = 'tickets' | 'ai_suggest'

export interface LimitCheckResult {
  /** False when the workspace has reached or exceeded its plan limit. */
  allowed: boolean
  /** Current usage (used + carried-over overage from the legacy model). */
  used: number
  /** Plan limit. Null for custom/Elite plans → treated as unlimited. */
  limit: number | null
  /** Capped at 100% even when used > limit; 0 when limit is null. */
  percentageUsed: number
  /** Workspace's current plan_id — used by callers to build upgrade-error responses. */
  planId: string
}

export class LimitCheckError extends Error {
  code: string
  constructor(message: string, code: string) {
    super(message)
    this.name = 'LimitCheckError'
    this.code = code
  }
}

// ─── Internal: read subscription + plan limits in one round-trip ──────

interface PlanLimits {
  ticket_limit: number | null
  ai_suggest_limit: number | null
}

interface SubscriptionWithPlanJoin {
  plan_id: string
  write_locked: boolean
  plans: PlanLimits | PlanLimits[] | null
}

interface SubscriptionAndPlan {
  plan_id:          string
  write_locked:     boolean
  ticket_limit:     number | null
  ai_suggest_limit: number | null
}

async function readSubscriptionAndPlan(workspaceId: string): Promise<SubscriptionAndPlan> {
  const { data, error } = await supabaseAdmin
    .from('workspace_subscriptions')
    .select('plan_id, write_locked, plans:plan_id(ticket_limit, ai_suggest_limit)')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (error) {
    throw new LimitCheckError(`subscription lookup failed: ${error.message}`, 'SUBSCRIPTION_QUERY_FAILED')
  }
  if (!data) {
    throw new LimitCheckError('no subscription found for workspace', 'NO_SUBSCRIPTION')
  }

  // Supabase's PostgREST returns the joined row as an object (or null) when
  // the FK is to a unique column; the typed shape varies by codegen, so we
  // normalize here.
  const row = data as SubscriptionWithPlanJoin
  const plan = Array.isArray(row.plans) ? row.plans[0] : row.plans
  return {
    plan_id:          row.plan_id,
    write_locked:     row.write_locked,
    ticket_limit:     plan?.ticket_limit ?? null,
    ai_suggest_limit: plan?.ai_suggest_limit ?? null,
  }
}

// ─── Internal: read current-period counter for the workspace ──────────

interface CounterUsage {
  tickets_used:       number
  ai_suggest_used:    number
  tickets_overage:    number
  ai_suggest_overage: number
}

async function readCurrentPeriodUsage(workspaceId: string): Promise<CounterUsage> {
  // The current period is the row with the latest period_start (≤ now)
  // for this workspace. If a workspace has never had a counter row,
  // treat usage as zero — locks only apply after explicit usage.
  const nowIso = new Date().toISOString()
  const { data, error } = await supabaseAdmin
    .from('usage_counters')
    .select('tickets_used, ai_suggest_used, tickets_overage, ai_suggest_overage')
    .eq('workspace_id', workspaceId)
    .lte('period_start', nowIso)
    .order('period_start', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new LimitCheckError(`usage_counters lookup failed: ${error.message}`, 'USAGE_QUERY_FAILED')
  }

  return data ?? {
    tickets_used:       0,
    ai_suggest_used:    0,
    tickets_overage:    0,
    ai_suggest_overage: 0,
  }
}

// ─── Public: limit checks ─────────────────────────────────────────────

function buildResult(used: number, limit: number | null, planId: string): LimitCheckResult {
  if (limit === null) {
    return { allowed: true, used, limit: null, percentageUsed: 0, planId }
  }
  const safeLimit = limit > 0 ? limit : 1   // guard against /0; limit=0 is malformed but shouldn't crash
  const percentageUsed = Math.min(100, Math.round((used / safeLimit) * 100))
  return { allowed: used < limit, used, limit, percentageUsed, planId }
}

export async function checkTicketLimit(workspaceId: string): Promise<LimitCheckResult> {
  const [sub, usage] = await Promise.all([
    readSubscriptionAndPlan(workspaceId),
    readCurrentPeriodUsage(workspaceId),
  ])
  const used = usage.tickets_used + usage.tickets_overage
  return buildResult(used, sub.ticket_limit, sub.plan_id)
}

export async function checkAiSuggestLimit(workspaceId: string): Promise<LimitCheckResult> {
  const [sub, usage] = await Promise.all([
    readSubscriptionAndPlan(workspaceId),
    readCurrentPeriodUsage(workspaceId),
  ])
  const used = usage.ai_suggest_used + usage.ai_suggest_overage
  return buildResult(used, sub.ai_suggest_limit, sub.plan_id)
}

// ─── Public: lock / unlock ────────────────────────────────────────────

/**
 * Sets workspace_subscriptions.write_locked = true. Idempotent: calling
 * on an already-locked workspace succeeds without error.
 */
export async function lockWorkspace(workspaceId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('workspace_subscriptions')
    .update({ write_locked: true })
    .eq('workspace_id', workspaceId)
  if (error) {
    throw new LimitCheckError(`lockWorkspace failed: ${error.message}`, 'LOCK_FAILED')
  }
}

/**
 * Clears the write_locked flag. Called by payment.succeeded webhook
 * after an upgrade or renewal. Idempotent.
 */
export async function unlockWorkspace(workspaceId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('workspace_subscriptions')
    .update({ write_locked: false })
    .eq('workspace_id', workspaceId)
  if (error) {
    throw new LimitCheckError(`unlockWorkspace failed: ${error.message}`, 'UNLOCK_FAILED')
  }
}
