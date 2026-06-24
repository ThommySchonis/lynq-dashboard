-- Real EUR base prices for the 3 public Shopify plans (display/teaser values).
-- These are the canonical EUR base; Shopify localizes the actual charge per merchant.
-- NOTE: shopify_handle stays at the placeholder values until the real Managed Pricing
-- handles are confirmed from the Partners dashboard / dev-store subscription.
update public.plans set price_eur = 59.00  where id = 'starter';
update public.plans set price_eur = 149.00 where id = 'growth';
update public.plans set price_eur = 399.00 where id = 'scale';
