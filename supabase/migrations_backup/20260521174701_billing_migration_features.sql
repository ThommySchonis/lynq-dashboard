begin;

-- 1. Add features JSONB column to plans
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '{}';

-- 2. Seed feature values for each plan
UPDATE public.plans SET features = '{"academy_access": false, "email_limit": 200, "priority_support": false}' WHERE display_name = 'Starter';
UPDATE public.plans SET features = '{"academy_access": true, "email_limit": null, "priority_support": false}' WHERE display_name = 'Growth';
UPDATE public.plans SET features = '{"academy_access": true, "email_limit": null, "priority_support": true}' WHERE display_name = 'Scale';
UPDATE public.plans SET features = '{"academy_access": true, "email_limit": null, "priority_support": true}' WHERE display_name = 'Enterprise';
UPDATE public.plans SET features = '{"academy_access": true, "email_limit": null, "priority_support": true}' WHERE display_name = 'Elite';

-- 3. Add academy addon to subscription_addons catalog (needed for workspace_addons purchase flow)
INSERT INTO public.subscription_addons (id, display_name, description, status, price_eur, per_unit_price_eur, per_unit_label, sort_order)
VALUES ('academy', 'Academy', 'Access to Lynq Academy training content', 'live', 100.00, NULL, NULL, 5)
ON CONFLICT (id) DO NOTHING;

-- 4. Drop legacy subscriptions table (no live users — clean cutover)
DROP TABLE IF EXISTS public.subscriptions;

commit;
