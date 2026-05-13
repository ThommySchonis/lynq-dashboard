import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import * as whop from '../../../../lib/whop'

// ─── Billing period rollover cron ─────────────────────────────────────
//
// Daily 04:00 UTC (after trial-expiry at 03:30). Vercel signs the
// request with `Authorization: Bearer ${CRON_SECRET}`.
//
// For each subscription whose `current_period_end` is in the past:
//   1. Generate a draft invoice for the just-ended period
//   2. Advance the subscription's period (start = old end, end = +30d)
//   3. Create a fresh usage_counters row for the new period
//   4. Stub a Whop charge (logs only — Whop integration pending)
//
// Idempotent: re-running on the same day for a workspace that already
// rolled over is a no-op (period_end is already in the future). The
// invoice INSERT uses `next_invoice_number()` so duplicates would be
// caught by the invoice_number UNIQUE constraint.
// ──────────────────────────────────────────────────────────────────────

const PERIOD_DAYS    = 30
const OVERAGE_TICKET = 0.20      // €0.20 per ticket over limit
const OVERAGE_AI     = 0.10      // €0.10 per AI Suggest over limit

interface LineItem {
  description: string
  quantity:    number
  unit_price:  number
  total:       number
}

interface SubscriptionRow {
  id:                    string
  workspace_id:          string
  plan_id:               string
  status:                string
  current_period_start:  string
  current_period_end:    string
  cancel_at_period_end:  boolean
  whop_subscription_id:  string | null
}

interface PlanRow {
  id:               string
  display_name:     string
  price_eur:        number | null
  ticket_limit:     number | null
  ai_suggest_limit: number | null
  is_custom:        boolean
}

interface RolloverResult {
  ok:           boolean
  workspace_id: string
  reason?:      string
  error?:       string
  invoice_id?:  string | null
  subtotal_eur?: number
}

function unauthorized(reason: string): NextResponse {
  return NextResponse.json({ error: 'Unauthorized', reason }, { status: 401 })
}

async function rolloverOne(sub: SubscriptionRow): Promise<RolloverResult> {
  // 1. Fetch plan + the period that just ended
  const [{ data: plan }, { data: oldCounter }] = await Promise.all([
    supabaseAdmin.from('plans').select('*').eq('id', sub.plan_id).single(),
    supabaseAdmin
      .from('usage_counters')
      .select('*')
      .eq('workspace_id', sub.workspace_id)
      .eq('period_start', sub.current_period_start)
      .maybeSingle(),
  ])

  if (!plan) {
    return { ok: false, reason: 'plan_not_found', workspace_id: sub.workspace_id }
  }

  const planRow = plan as PlanRow

  // 2. Build invoice line items + totals
  const lineItems: LineItem[] = []
  let   subtotal = 0

  // Base subscription line — only billed if not custom (Elite) and not trial
  if (!planRow.is_custom && planRow.price_eur != null && sub.status !== 'trial') {
    lineItems.push({
      description: `${planRow.display_name} subscription`,
      quantity:    1,
      unit_price:  Number(planRow.price_eur),
      total:       Number(planRow.price_eur),
    })
    subtotal += Number(planRow.price_eur)
  }

  // Overage lines
  const ticketOverage = oldCounter?.tickets_overage ?? 0
  if (ticketOverage > 0) {
    const total = +(ticketOverage * OVERAGE_TICKET).toFixed(2)
    lineItems.push({
      description: `Ticket overage (${ticketOverage} extra)`,
      quantity:    ticketOverage,
      unit_price:  OVERAGE_TICKET,
      total,
    })
    subtotal += total
  }

  const aiOverage = oldCounter?.ai_suggest_overage ?? 0
  if (aiOverage > 0) {
    const total = +(aiOverage * OVERAGE_AI).toFixed(2)
    lineItems.push({
      description: `AI Suggest overage (${aiOverage} extra)`,
      quantity:    aiOverage,
      unit_price:  OVERAGE_AI,
      total,
    })
    subtotal += total
  }

  // 3. Get billing snapshot
  const { data: billing } = await supabaseAdmin
    .from('billing_info')
    .select('*')
    .eq('workspace_id', sub.workspace_id)
    .maybeSingle()

  // 4. Create invoice row — skip entirely if subtotal is 0 (trial period
  // with no usage = no invoice). Don't waste invoice numbers on €0 docs.
  let invoiceId: string | null = null
  if (subtotal > 0) {
    const { data: numberResult } = await supabaseAdmin.rpc('next_invoice_number')
    const invoiceNumber = numberResult as string

    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .insert({
        workspace_id:      sub.workspace_id,
        invoice_number:    invoiceNumber,
        status:            'open',
        period_start:      sub.current_period_start,
        period_end:        sub.current_period_end,
        subtotal_eur:      subtotal,
        vat_amount_eur:    0,
        total_eur:         subtotal,
        amount_due_eur:    subtotal,
        description:       `${planRow.display_name} for the period from ${sub.current_period_start.slice(0,10)} to ${sub.current_period_end.slice(0,10)}`,
        line_items:        lineItems,
        billing_email:     billing?.billing_email ?? null,
        billing_org_name:  billing?.organization_name ?? null,
        billing_address:   billing
          ? {
              line1:       billing.address_line1,
              line2:       billing.address_line2,
              city:        billing.city,
              postal_code: billing.postal_code,
              country:     billing.country,
              state:       billing.state,
            }
          : null,
        vat_number:        billing?.vat_number ?? null,
      })
      .select('id')
      .single()

    if (invoiceError) {
      console.error('[cron/rollover] invoice insert failed for', sub.workspace_id, invoiceError.message)
      return { ok: false, reason: 'invoice_insert_failed', workspace_id: sub.workspace_id, error: invoiceError.message }
    }
    invoiceId = (invoice as { id: string }).id

    // 5. Stub Whop charge — real implementation will trigger payment
    if (sub.whop_subscription_id) {
      await whop.chargeOverage({
        membershipId: sub.whop_subscription_id,
        amountEur:    subtotal,
        description:  `Period invoice ${invoiceNumber}`,
        invoiceId,
      })
    }
  }

  // 6. Advance subscription period
  const newPeriodStart = sub.current_period_end
  const newPeriodEnd   = new Date(new Date(sub.current_period_end).getTime() + PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString()

  // Trial → active on first rollover (if not canceled)
  const newStatus = sub.status === 'trial' && !sub.cancel_at_period_end
    ? 'active'
    : sub.status

  const { error: subError } = await supabaseAdmin
    .from('workspace_subscriptions')
    .update({
      status:               newStatus,
      current_period_start: newPeriodStart,
      current_period_end:   newPeriodEnd,
    })
    .eq('id', sub.id)

  if (subError) {
    console.error('[cron/rollover] subscription update failed for', sub.workspace_id, subError.message)
    return { ok: false, reason: 'sub_update_failed', workspace_id: sub.workspace_id, error: subError.message }
  }

  // 7. Create the new period's usage_counters row
  await supabaseAdmin
    .from('usage_counters')
    .insert({
      workspace_id: sub.workspace_id,
      period_start: newPeriodStart,
      period_end:   newPeriodEnd,
    })

  return { ok: true, workspace_id: sub.workspace_id, invoice_id: invoiceId, subtotal_eur: subtotal }
}

async function handle(request: NextRequest): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    console.error('[cron/rollover] CRON_SECRET not configured')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (token !== expected) return unauthorized('cron-secret-mismatch')

  const startedAt = Date.now()
  console.log('[cron/rollover] start')

  // Find all subscriptions whose period has ended (excludes canceled)
  const { data: due, error } = await supabaseAdmin
    .from('workspace_subscriptions')
    .select('*')
    .in('status', ['trial', 'active', 'past_due'])
    .lte('current_period_end', new Date().toISOString())

  if (error) {
    console.error('[cron/rollover] query failed:', error.message)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const results: RolloverResult[] = []
  for (const sub of (due as SubscriptionRow[]) || []) {
    try {
      results.push(await rolloverOne(sub))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[cron/rollover] unhandled error for', sub.workspace_id, msg)
      results.push({ ok: false, workspace_id: sub.workspace_id, reason: 'exception', error: msg })
    }
  }

  const summary = {
    ok:           true,
    started_at:   new Date(startedAt).toISOString(),
    duration_ms:  Date.now() - startedAt,
    processed:    results.length,
    succeeded:    results.filter(r => r.ok).length,
    failed:       results.filter(r => !r.ok).length,
    results,
  }
  console.log('[cron/rollover] done', JSON.stringify({ ...summary, results: undefined }))
  return NextResponse.json(summary)
}

export const POST = handle
export const GET  = handle
