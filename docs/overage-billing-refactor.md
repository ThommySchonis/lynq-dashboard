# Overage Billing — Model 2 Implementation Plan

**Status:** Decisions final 2026-05-13. Cron disabled. Sprint pending.

## Chosen Model: 2 — Soft cap with overage charges

When customer exceeds plan ticket/AI Suggest limit:
- Tickets and AI Suggest keep working (no blocking)
- Counters increment overage columns
- End of billing period: Whop charges base plan + we charge accumulated overage
- Reset counters on next period

Rates (per current plans):
- €0.20 per extra ticket
- €0.10 per extra AI Suggest

## Five Design Decisions

### Decision 1 — Soft Cap Behavior: 1a + break-even info

- No blocking at 100%
- No popup warnings between 100% and 200%
- Banner shows:
  - Current overage cost (e.g. "Current overage: €15.00")
  - Break-even calculation (e.g. "At 50 more tickets, Growth costs the same. At 100 more, Growth costs less.")

### Decision 2 — Charge Timing: 2a

- Single overage charge at end of billing period
- Triggered by Whop's payment.succeeded webhook on renewal
- Customer sees one combined invoice: base plan + overage line items

### Decision 3 — Overage Cap: 3d

- No hard cap on overage amount
- In-app notification when overage cost exceeds threshold (TBD: probably 1.5x base plan)
- Customer decides whether to upgrade or keep paying overage

### Decision 4 — Counter Reset: 4a

- Counters reset when Whop fires payment.succeeded for renewal
- Single source of truth for period boundaries: Whop's payload
- No local +30 day calculation (was the period-drift bug)

### Decision 5 — Failed Charge Response: Hybrid read-only

When overage charge fails:
- Account remains accessible (login, view dashboard, view analytics, view tickets)
- Billing page remains fully functional (update card, change payment method)
- Write actions blocked: cannot send tickets, cannot use AI Suggest
- Whop's dunning system retries on its schedule (3 attempts over ~7 days)
- On successful retry: all write actions auto-resumed
- On final failure (after all retries): permanent deactivation flow (separate spec needed)

UI for blocked state:
- Top banner: "Payment failed. Update your card to resume sending tickets."
- Inline messaging on ticket creation: "Account temporarily restricted due to failed payment. [Update billing →]"
- AI Suggest UI shows disabled with same message

## Sprint Scope

Estimated: 1-2 weeks focused work.

### Backend (Day 1-4)

- Refactor payment.succeeded webhook handler:
  - Lookup previous period tickets_overage + ai_suggest_overage
  - If > 0: call chargeOverage(overage_delta_only) — not base + overage
  - Create invoice record (base from Whop's payment + overage line items)
  - Reset usage counters
  - Sync current_period_end with Whop's payload (no +30 days)
- Idempotency: protect against duplicate webhook deliveries
- Schema:
  - invoices.status enum: add 'overage_pending', 'overage_paid', 'overage_failed'
  - New table: overage_charges (parent_invoice_id, ticket_count, ai_count, amount, status, created_at)
- Failed charge flow:
  - workspace_subscriptions.write_locked column (boolean)
  - payment.failed webhook handler sets write_locked = true
  - payment.succeeded handler sets write_locked = false (on retry success)

### Middleware / Auth (Day 4-5)

- Extend proxy.ts or route handlers:
  - Check workspace_subscriptions.write_locked
  - Block POST /tickets, POST /ai-suggest, POST /reply etc when locked
  - Allow billing routes always (already in BLOCKED_BYPASS_PREFIXES)
- Return specific error code (e.g. WRITE_LOCKED_PAYMENT_FAILED) for client to display friendly message

### UI (Day 5-7)

- Restore overage rate displays:
  - usage-banner.tsx: bring back €0.20 / €0.10 rates, current overage cost
  - usage-banner.tsx: add break-even calculation
  - plan-selector-modal.tsx: bring back "Overage rates" block
  - usage-plans-tab.tsx: bring back amber-box with overage cost
- New: high-overage notification when overage cost > X (threshold TBD)
- New: write-locked state UI:
  - Persistent banner on all pages
  - Disabled state on ticket compose
  - Disabled state on AI Suggest
  - Direct link to billing/payment method update

### Webhook Coverage Extensions (Day 7)

- Add explicit handlers for:
  - dispute.created (Sentry alert, mark workspace for review)
  - refund.created (mark invoice refunded)
- Subscribe to these in Whop dashboard

### Testing (Day 8-10)

- Whop test mode end-to-end:
  - Normal upgrade flow
  - Trial → first paid period (verify no double charge)
  - Period renewal with no overage
  - Period renewal with overage (verify single combined invoice)
  - Failed charge → write_locked → resume on retry
  - Edge case: customer upgrades mid-period (prorate handling TBD)
- Sentry alerts for mismatched charges, missing webhooks, stuck memberships

## Open Questions for Sprint Start

1. High overage notification threshold — what counts as "high"?
   - Proposal: 1.5x base plan cost. E.g. Starter (€10) → notify at €15 overage.
2. Mid-period plan changes — how to prorate?
   - Whop has prorate logic built-in for plan changes. Verify behavior.
3. Final deactivation flow — what happens after all Whop dunning retries fail?
   - Out of scope for this sprint? Or include?
4. Should we email customers at 80% / 100% / high-overage thresholds?
   - Adds email infra dependency.

## What NOT to do

- Don't re-enable the cron — it's architecturally wrong for Whop's model
- Don't add overage charging logic to anywhere except payment.succeeded handler
- Don't compute period end locally — use Whop's payload
- The disabled-cron-with-503 file (app/api/cron/billing-period-rollover/route.ts) is a temporary safety state, not a permanent design. The Model 2 sprint should either delete the file entirely OR rewrite it as a monitor-only job (alert when Whop hasn't fired payment.succeeded for a workspace within 3 days of expected renewal). Decide before sprint start.

## Reference: Git History

- Original (broken) cron: commit f49c50c (PR #14)
- Hotfix disable: PR #25, commit 8e5d391
- TEMP diagnostic cleanup: PR #24, commit 857e79a
- This decisions doc: PR docs/overage-billing-decisions
