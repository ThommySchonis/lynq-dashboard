-- Phase 1c: Tasks CRUD as RPC functions

------------------------------------------------------------------------
-- 1) api_list_tasks
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_list_tasks(
  p_status   text DEFAULT NULL,
  p_priority text DEFAULT NULL,
  p_assignee uuid DEFAULT NULL,
  p_limit    int  DEFAULT 100,
  p_offset   int  DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws     uuid := get_user_workspace_id();
  v_result json;
  v_lim    int := LEAST(COALESCE(p_limit, 100), 200);
BEGIN
  WITH filtered AS (
    SELECT t.*,
           wmd.display_name AS member_name
    FROM tasks t
    LEFT JOIN workspace_member_details wmd ON wmd.id = t.assigned_to
    WHERE t.workspace_id = v_ws
      AND t.deleted_at IS NULL
      AND (p_status IS NULL   OR t.status = p_status)
      AND (p_priority IS NULL OR t.priority = p_priority)
      AND (p_assignee IS NULL OR t.assigned_to = p_assignee)
    ORDER BY t.created_at DESC
    LIMIT v_lim OFFSET p_offset
  )
  SELECT COALESCE(json_agg(
    json_build_object(
      'id', f.id,
      'workspaceId', f.workspace_id,
      'title', f.title,
      'description', f.description,
      'category', f.category,
      'priority', f.priority,
      'status', f.status,
      'assignedTo', f.assigned_to,
      'assignedMemberName', f.member_name,
      'pickedUpAt', f.picked_up_at,
      'completedAt', f.completed_at,
      'resultNote', f.result_note,
      'shopifyOrderId', f.shopify_order_id,
      'shopifyOrderName', f.shopify_order_name,
      'shopifyCustomerId', f.shopify_customer_id,
      'customerName', f.customer_name,
      'customerEmail', f.customer_email,
      'triggerType', f.trigger_type,
      'triggerKey', f.trigger_key,
      'createdBy', f.created_by,
      'refundCount', f.refund_count,
      'totalAmount', f.total_amount,
      'deletedAt', f.deleted_at,
      'createdAt', f.created_at,
      'updatedAt', f.updated_at
    )
  ), '[]'::json) INTO v_result
  FROM filtered f;

  RETURN json_build_object('tasks', v_result);
END;
$$;

------------------------------------------------------------------------
-- 2) api_create_task
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_create_task(
  p_title               text,
  p_description         text DEFAULT NULL,
  p_category            text DEFAULT NULL,
  p_priority            text DEFAULT 'medium',
  p_assigned_to         uuid DEFAULT NULL,
  p_shopify_order_id    text DEFAULT NULL,
  p_shopify_order_name  text DEFAULT NULL,
  p_shopify_customer_id text DEFAULT NULL,
  p_customer_name       text DEFAULT NULL,
  p_customer_email      text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws   uuid := get_user_workspace_id();
  v_role text := get_user_workspace_role();
  v_member_id uuid;
  v_task record;
BEGIN
  IF v_role NOT IN ('owner', 'admin', 'agent') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING HINT = 'You do not have permission to create tasks.';
  END IF;

  PERFORM check_write_access(v_ws);

  SELECT id INTO v_member_id
  FROM workspace_members
  WHERE user_id = auth.uid() AND workspace_id = v_ws
  LIMIT 1;

  INSERT INTO tasks (
    workspace_id, created_by, title, description, category, priority,
    assigned_to, shopify_order_id, shopify_order_name,
    shopify_customer_id, customer_name, customer_email, trigger_type
  )
  VALUES (
    v_ws, v_member_id, p_title, p_description, p_category, p_priority,
    p_assigned_to, p_shopify_order_id, p_shopify_order_name,
    p_shopify_customer_id, p_customer_name, p_customer_email, 'manual'
  )
  RETURNING * INTO v_task;

  RETURN json_build_object('task', json_build_object(
    'id', v_task.id,
    'workspaceId', v_task.workspace_id,
    'title', v_task.title,
    'description', v_task.description,
    'category', v_task.category,
    'priority', v_task.priority,
    'status', v_task.status,
    'assignedTo', v_task.assigned_to,
    'createdBy', v_task.created_by,
    'createdAt', v_task.created_at,
    'updatedAt', v_task.updated_at
  ));
END;
$$;

------------------------------------------------------------------------
-- 3) api_update_task
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_update_task(
  p_id          uuid,
  p_title       text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_category    text DEFAULT NULL,
  p_priority    text DEFAULT NULL,
  p_assigned_to uuid DEFAULT NULL,
  p_result_note text DEFAULT NULL,
  p_status      text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws   uuid := get_user_workspace_id();
  v_role text := get_user_workspace_role();
  v_task record;
BEGIN
  IF v_role NOT IN ('owner', 'admin', 'agent') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING HINT = 'You do not have permission to manage tasks.';
  END IF;

  PERFORM check_write_access(v_ws);

  UPDATE tasks SET
    title       = COALESCE(p_title, title),
    description = COALESCE(p_description, description),
    category    = COALESCE(p_category, category),
    priority    = COALESCE(p_priority, priority),
    assigned_to = COALESCE(p_assigned_to, assigned_to),
    result_note = COALESCE(p_result_note, result_note),
    status      = COALESCE(p_status, status),
    picked_up_at = CASE
      WHEN p_status = 'picked_up' THEN now()
      WHEN p_status = 'open' THEN NULL
      ELSE picked_up_at
    END,
    completed_at = CASE
      WHEN p_status = 'done' THEN now()
      WHEN p_status = 'open' THEN NULL
      ELSE completed_at
    END
  WHERE id = p_id
    AND workspace_id = v_ws
    AND deleted_at IS NULL
  RETURNING * INTO v_task;

  IF v_task.id IS NULL THEN
    RAISE EXCEPTION 'Task not found' USING HINT = 'not_found';
  END IF;

  RETURN json_build_object('task', json_build_object(
    'id', v_task.id,
    'workspaceId', v_task.workspace_id,
    'title', v_task.title,
    'description', v_task.description,
    'category', v_task.category,
    'priority', v_task.priority,
    'status', v_task.status,
    'assignedTo', v_task.assigned_to,
    'resultNote', v_task.result_note,
    'pickedUpAt', v_task.picked_up_at,
    'completedAt', v_task.completed_at,
    'createdAt', v_task.created_at,
    'updatedAt', v_task.updated_at
  ));
END;
$$;

------------------------------------------------------------------------
-- 4) api_delete_task (soft delete)
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_delete_task(p_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws   uuid := get_user_workspace_id();
  v_role text := get_user_workspace_role();
  v_found boolean;
BEGIN
  IF v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING HINT = 'Only owners and admins can delete tasks.';
  END IF;

  PERFORM check_write_access(v_ws);

  UPDATE tasks SET deleted_at = now()
  WHERE id = p_id
    AND workspace_id = v_ws
    AND deleted_at IS NULL
  RETURNING true INTO v_found;

  IF v_found IS NULL THEN
    RAISE EXCEPTION 'Task not found' USING HINT = 'not_found';
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

------------------------------------------------------------------------
-- Grants
------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION api_list_tasks(text, text, uuid, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION api_create_task(text, text, text, text, uuid, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION api_update_task(uuid, text, text, text, text, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION api_delete_task(uuid) TO authenticated;
