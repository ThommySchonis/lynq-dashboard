-- Phase 2: Postgres functions for atomic GDPR data handling.
--
-- compliance_redact_customer: anonymize a single customer's data in place.
-- compliance_redact_shop:     hard-delete everything referencing a shop.
--
-- Both are SECURITY DEFINER so the service-role client can invoke them.

------------------------------------------------------------------------
-- compliance_redact_customer
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION compliance_redact_customer(
  p_workspace    uuid,
  p_email        text,
  p_hashed_email text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv_count    integer := 0;
  v_msg_count     integer := 0;
  v_note_count    integer := 0;
  v_task_count    integer := 0;
  v_order_count   integer := 0;
BEGIN
  -- Anonymize messages first (they reference conversations, but the WHERE
  -- uses conversation_id IN (SELECT ...) which still uses the original email).
  WITH target_conv AS (
    SELECT id FROM email_conversations
    WHERE workspace_id = p_workspace AND customer_email = p_email
  )
  UPDATE email_messages SET
    from_email = p_hashed_email,
    from_name  = 'Redacted',
    to_email   = p_hashed_email,
    to_name    = 'Redacted',
    subject    = '[redacted]',
    body_text  = '[Content removed per GDPR request]',
    body_html  = '<p>[Content removed per GDPR request]</p>'
  WHERE workspace_id = p_workspace
    AND conversation_id IN (SELECT id FROM target_conv);
  GET DIAGNOSTICS v_msg_count = ROW_COUNT;

  -- Anonymize notes.
  WITH target_conv AS (
    SELECT id FROM email_conversations
    WHERE workspace_id = p_workspace AND customer_email = p_email
  )
  UPDATE conversation_notes SET body = '[redacted]'
  WHERE workspace_id = p_workspace
    AND conversation_id IN (SELECT id FROM target_conv);
  GET DIAGNOSTICS v_note_count = ROW_COUNT;

  -- Anonymize the conversation headers themselves.
  UPDATE email_conversations SET
    customer_email = p_hashed_email,
    customer_name  = 'Redacted Customer',
    subject        = '[redacted]',
    snippet        = '[redacted]'
  WHERE workspace_id = p_workspace AND customer_email = p_email;
  GET DIAGNOSTICS v_conv_count = ROW_COUNT;

  -- Anonymize tasks.
  UPDATE tasks SET
    customer_email = p_hashed_email,
    customer_name  = 'Redacted Customer',
    description    = NULL,
    result_note    = NULL
  WHERE workspace_id = p_workspace AND customer_email = p_email;
  GET DIAGNOSTICS v_task_count = ROW_COUNT;

  -- Anonymize shopify_orders.
  UPDATE shopify_orders SET
    customer_email = p_hashed_email,
    customer_name  = 'Redacted Customer'
  WHERE workspace_id = p_workspace AND customer_email = p_email;
  GET DIAGNOSTICS v_order_count = ROW_COUNT;

  RETURN json_build_object(
    'conversations_anonymized', v_conv_count,
    'messages_anonymized',      v_msg_count,
    'notes_anonymized',         v_note_count,
    'tasks_anonymized',         v_task_count,
    'orders_anonymized',        v_order_count
  );
END;
$$;

------------------------------------------------------------------------
-- compliance_redact_shop
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION compliance_redact_shop(
  p_workspace   uuid,
  p_shop_domain text,
  p_store_id    uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task_count   integer := 0;
  v_order_count  integer := 0;
  v_conv_count   integer := 0;
  v_acct_count   integer := 0;
  v_int_count    integer := 0;
  v_store_count  integer := 0;
BEGIN
  -- If we have no store_id we cannot reliably identify the data to delete
  -- (the orphan-then-null pattern in deleteStore leaves no shop_domain on
  -- the affected tables). Return a no-op result.
  IF p_store_id IS NULL THEN
    RETURN json_build_object(
      'skipped',     true,
      'reason',      'no store_id resolvable from shop_domain',
      'shop_domain', p_shop_domain
    );
  END IF;

  -- Delete tasks for this shop.
  DELETE FROM tasks
  WHERE workspace_id = p_workspace AND store_id = p_store_id;
  GET DIAGNOSTICS v_task_count = ROW_COUNT;

  -- Delete shopify_orders for this shop.
  DELETE FROM shopify_orders
  WHERE workspace_id = p_workspace AND store_id = p_store_id;
  GET DIAGNOSTICS v_order_count = ROW_COUNT;

  -- Delete email_conversations. FK CASCADE on email_messages and
  -- conversation_notes will clean those up automatically.
  DELETE FROM email_conversations
  WHERE workspace_id = p_workspace AND store_id = p_store_id;
  GET DIAGNOSTICS v_conv_count = ROW_COUNT;

  -- Delete email_accounts. Belt-and-suspenders: also covered by the
  -- ON DELETE CASCADE from stores in the next step.
  DELETE FROM email_accounts
  WHERE store_id = p_store_id;
  GET DIAGNOSTICS v_acct_count = ROW_COUNT;

  -- Delete integrations.
  DELETE FROM integrations
  WHERE store_id = p_store_id;
  GET DIAGNOSTICS v_int_count = ROW_COUNT;

  -- Delete the store itself.
  DELETE FROM stores
  WHERE id = p_store_id AND workspace_id = p_workspace;
  GET DIAGNOSTICS v_store_count = ROW_COUNT;

  RETURN json_build_object(
    'tasks_deleted',          v_task_count,
    'orders_deleted',         v_order_count,
    'conversations_deleted',  v_conv_count,
    'email_accounts_deleted', v_acct_count,
    'integrations_deleted',   v_int_count,
    'stores_deleted',         v_store_count
  );
END;
$$;

-- Grants: only service_role (used by supabaseAdmin) needs to call these.
GRANT EXECUTE ON FUNCTION compliance_redact_customer(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION compliance_redact_shop(uuid, text, uuid) TO service_role;
