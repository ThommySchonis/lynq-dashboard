-- Shopify Billing integration — adds Shopify columns alongside existing Whop columns.
-- Whop columns are kept in place per the soft-deprecation decision in the spec.

------------------------------------------------------------
-- workspace_subscriptions: add Shopify state columns
------------------------------------------------------------
alter table workspace_subscriptions
  add column if not exists shopify_charge_id text,
  add column if not exists shopify_charge_status text,
  add column if not exists shopify_billing_shop_domain text,
  add column if not exists shopify_trial_ends_at timestamptz,
  add column if not exists shopify_current_period_end timestamptz,
  add column if not exists is_grandfathered boolean not null default false,
  add column if not exists grandfather_reason text;

-- Extend the existing status enum with the local "pending Shopify subscription" value.
-- Status is stored as text in workspace_subscriptions; no type change needed, just document
-- the new allowed value in code. We add a CHECK constraint to lock the vocabulary.
alter table workspace_subscriptions drop constraint if exists workspace_subscriptions_status_check;
alter table workspace_subscriptions
  add constraint workspace_subscriptions_status_check check (
    status in (
      'trial',
      'active',
      'past_due',
      'canceled',
      'paused',
      'pending_shopify_subscription'
    )
  );

------------------------------------------------------------
-- plans: add Shopify plan handle
------------------------------------------------------------
alter table plans
  add column if not exists shopify_handle text;

-- Backfill the four active plans. Names must match exactly the `name` declared
-- in shopify-app-config/shopify.app.toml [app.subscription_plans.plans] blocks.
update plans set shopify_handle = 'Starter'    where lower(display_name) = 'starter';
update plans set shopify_handle = 'Growth'     where lower(display_name) = 'growth';
update plans set shopify_handle = 'Scale'      where lower(display_name) = 'scale';
update plans set shopify_handle = 'Enterprise' where lower(display_name) = 'enterprise';

-- Soft-deactivate the Elite custom plan (dropped per Q3 of brainstorm).
update plans set is_active = false where lower(display_name) = 'elite';

------------------------------------------------------------
-- integrations: add billing-store flag with one-per-workspace constraint
------------------------------------------------------------
alter table integrations
  add column if not exists is_billing_store boolean not null default false;

create unique index if not exists one_billing_store_per_workspace
  on integrations (workspace_id) where is_billing_store = true;

------------------------------------------------------------
-- shopify_webhook_events: idempotency dedup (mirrors whop_webhook_events pattern)
------------------------------------------------------------
create table if not exists shopify_webhook_events (
  event_id text primary key,
  topic text not null,
  shop_domain text,
  received_at timestamptz not null default now()
);

-- No RLS — admin-only access via service-role key from the webhook handler.
alter table shopify_webhook_events enable row level security;

------------------------------------------------------------
-- Deprecation comments on Whop columns (no behavior change)
------------------------------------------------------------
comment on column workspace_subscriptions.whop_subscription_id is
  'DEPRECATED 2026-06-08: kept for potential future Whop reactivation; not read by active code paths.';
comment on column workspace_subscriptions.whop_customer_id is
  'DEPRECATED 2026-06-08: see workspace_subscriptions.whop_subscription_id comment.';
comment on column plans.whop_product_id is
  'DEPRECATED 2026-06-08: see workspace_subscriptions.whop_subscription_id comment.';
comment on column plans.whop_plan_id is
  'DEPRECATED 2026-06-08: see workspace_subscriptions.whop_subscription_id comment.';

------------------------------------------------------------
-- Cleanup: drop vestigial overage columns from usage_counters
-- (Already overdue per docs/billing-model.md Model 3 decision.)
------------------------------------------------------------
alter table usage_counters
  drop column if exists tickets_overage,
  drop column if exists ai_suggest_overage;
