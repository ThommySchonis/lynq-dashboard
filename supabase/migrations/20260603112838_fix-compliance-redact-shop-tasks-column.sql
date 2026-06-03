-- Fix: compliance_redact_shop previously deleted from tasks using a non-existent
-- tasks.store_id column. tasks links to a shop only indirectly, via
-- shopify_order_id. Scope task deletion via a subquery against shopify_orders.
-- Tasks not linked to any Shopify order (e.g., manual follow-ups) are intentionally
-- not deleted by shop/redact because they have no recoverable link to the shop.

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
  IF p_store_id IS NULL THEN
    RETURN json_build_object(
      'skipped',     true,
      'reason',      'no store_id resolvable from shop_domain',
      'shop_domain', p_shop_domain
    );
  END IF;

  -- Delete tasks linked to orders from this shop. tasks has no store_id
  -- column, so we scope via shopify_order_id IN (orders for this store).
  -- Must run before the shopify_orders DELETE so the subquery still
  -- finds the matching order IDs.
  DELETE FROM tasks
  WHERE workspace_id = p_workspace
    AND shopify_order_id IN (
      SELECT id::text FROM shopify_orders
      WHERE workspace_id = p_workspace AND store_id = p_store_id
    );
  GET DIAGNOSTICS v_task_count = ROW_COUNT;

  DELETE FROM shopify_orders
  WHERE workspace_id = p_workspace AND store_id = p_store_id;
  GET DIAGNOSTICS v_order_count = ROW_COUNT;

  DELETE FROM email_conversations
  WHERE workspace_id = p_workspace AND store_id = p_store_id;
  GET DIAGNOSTICS v_conv_count = ROW_COUNT;

  DELETE FROM email_accounts
  WHERE store_id = p_store_id;
  GET DIAGNOSTICS v_acct_count = ROW_COUNT;

  DELETE FROM integrations
  WHERE store_id = p_store_id;
  GET DIAGNOSTICS v_int_count = ROW_COUNT;

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

GRANT EXECUTE ON FUNCTION compliance_redact_shop(uuid, text, uuid) TO service_role;
