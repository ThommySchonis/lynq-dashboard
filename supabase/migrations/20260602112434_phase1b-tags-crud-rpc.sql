-- Phase 1b: Tags CRUD + merge as RPC functions

------------------------------------------------------------------------
-- Helper: get the user's role in their workspace
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_user_workspace_role()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role
  FROM workspace_members
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'NO_WORKSPACE'
      USING HINT = 'User has no active workspace membership';
  END IF;

  RETURN v_role;
END;
$$;

------------------------------------------------------------------------
-- 1) api_list_tags
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_list_tags()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws   uuid := get_user_workspace_id();
  v_role text := get_user_workspace_role();
  v_result json;
BEGIN
  SELECT json_build_object(
    'tags', COALESCE(json_agg(
      json_build_object(
        'id', t.id,
        'name', t.name,
        'color', t.color,
        'description', t.description,
        'created_at', t.created_at,
        'updated_at', t.updated_at,
        'macro_count', COALESCE(mc.cnt, 0)
      ) ORDER BY t.name
    ), '[]'::json),
    'currentUserRole', v_role
  ) INTO v_result
  FROM tags t
  LEFT JOIN (
    SELECT tag_id, count(*)::int AS cnt
    FROM macro_tags
    GROUP BY tag_id
  ) mc ON mc.tag_id = t.id
  WHERE t.workspace_id = v_ws;

  RETURN v_result;
END;
$$;

------------------------------------------------------------------------
-- 2) api_create_tag
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_create_tag(
  p_name        text,
  p_color       text DEFAULT 'slate',
  p_description text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws   uuid := get_user_workspace_id();
  v_role text := get_user_workspace_role();
  v_tag  record;
BEGIN
  IF v_role NOT IN ('owner', 'admin', 'agent') THEN
    RAISE EXCEPTION 'FORBIDDEN'
      USING HINT = 'You do not have permission to create tags.';
  END IF;

  PERFORM check_write_access(v_ws);

  INSERT INTO tags (workspace_id, name, color, description, created_by)
  VALUES (v_ws, p_name, p_color, p_description, auth.uid())
  RETURNING id, name, color, description, created_at, updated_at INTO v_tag;

  RETURN json_build_object(
    'tag', json_build_object(
      'id', v_tag.id,
      'name', v_tag.name,
      'color', v_tag.color,
      'description', v_tag.description,
      'created_at', v_tag.created_at,
      'updated_at', v_tag.updated_at,
      'macro_count', 0
    )
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'A tag named "%" already exists.', p_name
      USING HINT = 'duplicate';
END;
$$;

------------------------------------------------------------------------
-- 3) api_get_tag
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_get_tag(p_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws uuid := get_user_workspace_id();
  v_result json;
BEGIN
  SELECT json_build_object(
    'tag', json_build_object(
      'id', t.id,
      'name', t.name,
      'color', t.color,
      'description', t.description,
      'created_at', t.created_at,
      'updated_at', t.updated_at,
      'macro_count', COALESCE(mc.cnt, 0)
    )
  ) INTO v_result
  FROM tags t
  LEFT JOIN (
    SELECT tag_id, count(*)::int AS cnt
    FROM macro_tags
    GROUP BY tag_id
  ) mc ON mc.tag_id = t.id
  WHERE t.id = p_id AND t.workspace_id = v_ws;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Tag not found' USING HINT = 'not_found';
  END IF;

  RETURN v_result;
END;
$$;

------------------------------------------------------------------------
-- 4) api_update_tag
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_update_tag(
  p_id          uuid,
  p_name        text DEFAULT NULL,
  p_color       text DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws   uuid := get_user_workspace_id();
  v_role text := get_user_workspace_role();
  v_tag  record;
BEGIN
  IF v_role NOT IN ('owner', 'admin', 'agent') THEN
    RAISE EXCEPTION 'FORBIDDEN'
      USING HINT = 'You do not have permission to edit tags.';
  END IF;

  PERFORM check_write_access(v_ws);

  UPDATE tags SET
    name        = COALESCE(p_name, name),
    color       = COALESCE(p_color, color),
    description = CASE WHEN p_description IS NOT NULL THEN nullif(p_description, '') ELSE description END,
    updated_at  = now()
  WHERE id = p_id AND workspace_id = v_ws
  RETURNING id, name, color, description, created_at, updated_at INTO v_tag;

  IF v_tag.id IS NULL THEN
    RAISE EXCEPTION 'Tag not found' USING HINT = 'not_found';
  END IF;

  RETURN json_build_object(
    'tag', json_build_object(
      'id', v_tag.id,
      'name', v_tag.name,
      'color', v_tag.color,
      'description', v_tag.description,
      'created_at', v_tag.created_at,
      'updated_at', v_tag.updated_at
    )
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'A tag named "%" already exists.', p_name
      USING HINT = 'duplicate';
END;
$$;

------------------------------------------------------------------------
-- 5) api_delete_tag
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_delete_tag(p_id uuid)
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
    RAISE EXCEPTION 'FORBIDDEN'
      USING HINT = 'Only owners and admins can delete tags.';
  END IF;

  PERFORM check_write_access(v_ws);

  DELETE FROM tags
  WHERE id = p_id AND workspace_id = v_ws
  RETURNING true INTO v_found;

  IF v_found IS NULL THEN
    RAISE EXCEPTION 'Tag not found' USING HINT = 'not_found';
  END IF;

  RETURN json_build_object('ok', true);
END;
$$;

------------------------------------------------------------------------
-- 6) api_merge_tags — single transaction, safer than multi-step HTTP
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_merge_tags(
  p_winner_id uuid,
  p_loser_ids uuid[]
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws          uuid := get_user_workspace_id();
  v_role        text := get_user_workspace_role();
  v_all_ids     uuid[];
  v_found_count int;
  v_reassigned  int := 0;
  v_loser_ids   uuid[];
BEGIN
  IF v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN'
      USING HINT = 'Only owners and admins can merge tags.';
  END IF;

  PERFORM check_write_access(v_ws);

  -- Filter out winner from losers
  SELECT array_agg(x) INTO v_loser_ids
  FROM unnest(p_loser_ids) x
  WHERE x <> p_winner_id;

  IF v_loser_ids IS NULL OR array_length(v_loser_ids, 1) = 0 THEN
    RAISE EXCEPTION 'winner_id and at least one loser_id required'
      USING HINT = 'invalid_input';
  END IF;

  v_all_ids := v_loser_ids || ARRAY[p_winner_id];

  -- Verify all tags belong to this workspace
  SELECT count(*)::int INTO v_found_count
  FROM tags WHERE workspace_id = v_ws AND id = ANY(v_all_ids);

  IF v_found_count <> array_length(v_all_ids, 1) THEN
    RAISE EXCEPTION 'One or more tags not found in this workspace'
      USING HINT = 'not_found';
  END IF;

  -- Reassign macro links: insert winner links for macros that don't already have one
  INSERT INTO macro_tags (macro_id, tag_id)
  SELECT DISTINCT lt.macro_id, p_winner_id
  FROM macro_tags lt
  WHERE lt.tag_id = ANY(v_loser_ids)
    AND NOT EXISTS (
      SELECT 1 FROM macro_tags wt
      WHERE wt.macro_id = lt.macro_id AND wt.tag_id = p_winner_id
    );

  GET DIAGNOSTICS v_reassigned = ROW_COUNT;

  -- Delete losers (FK cascade removes their macro_tags rows)
  DELETE FROM tags
  WHERE workspace_id = v_ws AND id = ANY(v_loser_ids);

  RETURN json_build_object(
    'ok', true,
    'winner_id', p_winner_id,
    'merged_count', array_length(v_loser_ids, 1),
    'reassigned_links', v_reassigned
  );
END;
$$;

------------------------------------------------------------------------
-- Grants
------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION get_user_workspace_role() TO authenticated;
GRANT EXECUTE ON FUNCTION api_list_tags() TO authenticated;
GRANT EXECUTE ON FUNCTION api_create_tag(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION api_get_tag(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION api_update_tag(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION api_delete_tag(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION api_merge_tags(uuid, uuid[]) TO authenticated;
