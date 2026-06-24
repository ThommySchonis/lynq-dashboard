-- Shopify billing finalization:
--  1. Allow plan_id to be NULL (pending / unmapped subscriptions have no plan).
--  2. Track when Shopify reports a plan handle we can't resolve (hard-block signal).
--  3. Store the active subscription's localized price + currency (multi-currency display).
--  4. Let the notifications table carry an internal system alert.
--  5. Reset the plan catalog to the 3 live Shopify plans with real limits + handles.

-- 1. plan_id nullable — webhook/sync legitimately write NULL for pending/unmapped state.
alter table public.workspace_subscriptions
  alter column plan_id drop not null;

-- 2. Hard-block flag: set when Shopify reports an active plan whose handle is unmapped.
alter table public.workspace_subscriptions
  add column if not exists plan_unmapped boolean not null default false;

-- 3. Localized price the merchant actually pays, from the active subscription line items.
alter table public.workspace_subscriptions
  add column if not exists shopify_price_amount numeric(10,2),
  add column if not exists shopify_price_currency text;

-- 4. Allow an internal alert category on the shared notifications table.
alter table public.notifications
  drop constraint if exists notifications_category_check;
alter table public.notifications
  add constraint notifications_category_check
  check (category in ('broadcast', 'emma_pending_draft', 'system_alert'));

-- 5a. Only Starter/Growth/Scale exist as public Shopify plans. Deactivate the rest.
update public.plans set is_active = false where id in ('enterprise', 'elite');

-- 5b. Real entitlement limits from the live Shopify plan page (currency-independent).
--     outbound emails/month -> ticket_limit ; AI agent replies -> ai_suggest_limit.
update public.plans set ticket_limit = 900,  ai_suggest_limit = 600  where id = 'starter';
update public.plans set ticket_limit = 3000, ai_suggest_limit = 2000 where id = 'growth';
update public.plans set ticket_limit = 9000, ai_suggest_limit = 6000 where id = 'scale';

-- 5c. Plan handles must match the Shopify Managed Pricing handle (lowercase slug), NOT the
--     display name. PLACEHOLDER values — replaced with the real Partners handles, and the
--     EUR base prices set, in the final task before launch.
update public.plans set shopify_handle = 'starter' where id = 'starter';
update public.plans set shopify_handle = 'growth'  where id = 'growth';
update public.plans set shopify_handle = 'scale'   where id = 'scale';
