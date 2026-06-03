-- Audit log + idempotency journal for Shopify GDPR/compliance webhooks
-- (customers/data_request, customers/redact, shop/redact).
-- workspace_id is intentionally not a FK: shop/redact will hard-delete the
-- workspace's data, but the log must survive as the audit record.

CREATE TABLE IF NOT EXISTS public.compliance_webhook_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic               text NOT NULL,
  shop_domain         text NOT NULL,
  shopify_shop_id     bigint,
  shopify_customer_id bigint,
  customer_email      text,
  workspace_id        uuid,
  hmac_ok             boolean NOT NULL,
  hmac_secret_used    text,
  payload             jsonb NOT NULL,
  shopify_webhook_id  text,
  received_at         timestamptz NOT NULL DEFAULT now(),
  processed_at        timestamptz,
  processing_error    text,
  CONSTRAINT compliance_webhook_log_topic_check
    CHECK (topic IN ('customers/data_request','customers/redact','shop/redact')),
  CONSTRAINT compliance_webhook_log_secret_check
    CHECK (hmac_secret_used IS NULL OR hmac_secret_used IN ('pub','main'))
);

ALTER TABLE public.compliance_webhook_log OWNER TO postgres;
ALTER TABLE public.compliance_webhook_log ENABLE ROW LEVEL SECURITY;

-- Idempotency key: same (topic, shopify_webhook_id) cannot be inserted twice.
CREATE UNIQUE INDEX IF NOT EXISTS compliance_webhook_log_dedup
  ON public.compliance_webhook_log (topic, shopify_webhook_id)
  WHERE shopify_webhook_id IS NOT NULL;

-- Ops lookup: "show me all compliance events for this shop, newest first"
CREATE INDEX IF NOT EXISTS compliance_webhook_log_shop_received
  ON public.compliance_webhook_log (shop_domain, received_at DESC);

-- Find stuck/failed events (processed_at is null when worker has not finished)
CREATE INDEX IF NOT EXISTS compliance_webhook_log_unprocessed
  ON public.compliance_webhook_log (received_at)
  WHERE processed_at IS NULL;
