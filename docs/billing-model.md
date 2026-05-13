# Billing Model — Model 3: Forced Upgrade

**Status:** Decision final 2026-05-13. Replaces previous Model 2 plan.

## Decision

When customer reaches plan limit (tickets or AI Suggest):
- Block further usage of that resource
- Show upgrade prompt with one-click flow to next plan tier
- After upgrade: customer can continue immediately
- No overage charges, no per-usage billing, no tracking beyond limits

## Why Model 3 over Model 2

- Predictable MRR for company
- Predictable monthly costs for customers (no surprise invoices)
- Simpler engineering: 2-3 days vs 1-2 weeks
- Fewer edge cases: no prorating, no period-end charging, no failed dunning
- Drives plan upgrades at the moment of value realization
- No legal/consumer-protection risks from unenforced overage claims

## Behavior Spec

### Block at 100%

When tickets_used + tickets_overage >= ticket_limit:
- All ticket-creation endpoints return WRITE_LOCKED_PLAN_LIMIT error
- UI ticket compose: disabled state with upgrade CTA
- Inbox banner: "Plan limit reached. Upgrade to continue handling tickets."

When ai_suggest_used + ai_suggest_overage >= ai_suggest_limit:
- AI Suggest endpoint returns WRITE_LOCKED_PLAN_LIMIT error
- AI Suggest UI: disabled state with upgrade CTA

### Warning at 80%

UI banner: "You're approaching your plan limit. X / Y tickets used."
- Soft messaging only, no blocking
- Includes "Upgrade plan" link

### Counter Reset

Counters reset when Whop fires payment.succeeded for renewal (single source of truth for period boundaries — no local +30 day calculation).

### Plan Upgrade Flow

Customer clicks "Upgrade" CTA → Whop checkout opens with target plan pre-selected → after successful payment → write_locked flag cleared, new limits active immediately.

## Sprint Scope (estimated 2-3 days)

### Backend (Day 1-2)

- payment.succeeded webhook handler:
  - Reset usage_counters for the workspace (zero out tickets_used, tickets_overage, ai_suggest_used, ai_suggest_overage)
  - Sync current_period_end from Whop's payload
  - Set workspace_subscriptions.write_locked = false (in case of recent block)
- New column: workspace_subscriptions.write_locked (boolean, default false)
- Limit check middleware:
  - In lib/conversationEngine.ts:sendReply / sendNewEmail: add hard check against tickets_used + tickets_overage >= ticket_limit
  - In AI Suggest route: same check against ai_suggest_*
  - Return structured error code: { error: 'PLAN_LIMIT_REACHED', current_plan: 'starter', resource: 'tickets', limit: 300, upgrade_url: '...' }
- Remove legacy checkEmailLimit (lib/emailUsage.ts) — replaced by workspace-keyed check
- Delete chargeOverage function from lib/whop.ts (dead code)
- Delete app/api/cron/billing-period-rollover/route.ts entirely

### UI (Day 2-3)

- usage-banner.tsx: keep current copy from fix/remove-overage-rates-ui-claim (already removes overage rate claims). 100%+ banner shows upgrade CTA.
- plan-selector-modal.tsx: replace overage rates block with simple message about upgrade-when-limit-reached behavior.
- usage-plans-tab.tsx: remove amber overage box.
- Ticket compose disabled state: when API returns PLAN_LIMIT_REACHED, show inline upgrade prompt in compose component.
- AI Suggest disabled state: same pattern.

### Testing (Day 3)

- Whop test mode: Starter customer reaches 300 tickets, gets blocked, upgrades to Growth, immediately unblocked
- Edge case: limit reached, customer doesn't upgrade, period rolls over via Whop renewal → counters reset → unblocked
- Edge case: customer upgrades mid-period → new higher limit immediately active (Whop handles prorating)

## Out of Scope (Future)

- Pay-as-you-go / overage billing (Model 2) — defer until customer research validates demand
- Email-as-resource pricing (vs conversation-as-resource) — current per-conversation counting model stays
- Failed payment dunning UX — Whop's default behavior is sufficient for v1

## What is now deletable

- lib/whop.ts:chargeOverage function (no callers after sprint)
- app/api/cron/billing-period-rollover/route.ts (no use case)
- lib/emailUsage.ts (legacy, replaced by workspace-keyed checks)
- usage_counters.tickets_overage and ai_suggest_overage columns (after migration to combined ticket counter)

## Reference: Git History

- Decision to switch from Model 2 to Model 3: PR #XX (this PR)
- Previous Model 2 plan: superseded by this document
- Hotfix disable broken cron: PR #25, commit 8e5d391
