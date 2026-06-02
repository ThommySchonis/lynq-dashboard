-- Phase 1f: Macros CRUD as RPC functions (excluding generate)

------------------------------------------------------------------------
-- Helper: ensure tags exist by name, return array of tag IDs
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ensure_tags_by_name(
  p_workspace_id uuid,
  p_tag_names    text[],
  p_created_by   uuid DEFAULT NULL
)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tag_ids uuid[];
BEGIN
  IF p_tag_names IS NULL OR array_length(p_tag_names, 1) IS NULL THEN
    RETURN ARRAY[]::uuid[];
  END IF;

  -- Create missing tags
  INSERT INTO tags (workspace_id, name, color, created_by)
  SELECT p_workspace_id, unnest, 'slate', p_created_by
  FROM unnest(p_tag_names)
  ON CONFLICT (workspace_id, lower(name)) DO NOTHING;

  -- Collect all tag IDs matching the names
  SELECT array_agg(t.id) INTO v_tag_ids
  FROM tags t
  WHERE t.workspace_id = p_workspace_id
    AND lower(t.name) = ANY(SELECT lower(unnest) FROM unnest(p_tag_names));

  RETURN COALESCE(v_tag_ids, ARRAY[]::uuid[]);
END;
$$;

------------------------------------------------------------------------
-- Helper: sync macro_tags junction table
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_macro_tags(
  p_macro_id uuid,
  p_tag_ids  uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM macro_tags WHERE macro_id = p_macro_id;

  IF p_tag_ids IS NOT NULL AND array_length(p_tag_ids, 1) > 0 THEN
    INSERT INTO macro_tags (macro_id, tag_id)
    SELECT p_macro_id, unnest
    FROM unnest(p_tag_ids);
  END IF;
END;
$$;

------------------------------------------------------------------------
-- 1) api_list_macros
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_list_macros(
  p_archived text DEFAULT 'false',
  p_search   text DEFAULT NULL,
  p_language text DEFAULT NULL,
  p_tags     text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws     uuid := get_user_workspace_id();
  v_role   text := get_user_workspace_role();
  v_result json;
  v_is_archived boolean := (p_archived = 'true');
  v_tag_list text[];
BEGIN
  IF p_tags IS NOT NULL AND p_tags <> '' THEN
    v_tag_list := string_to_array(p_tags, ',');
  END IF;

  SELECT json_build_object(
    'macros', COALESCE(json_agg(row_data ORDER BY row_data.updated_at DESC), '[]'::json),
    'currentUserRole', v_role
  ) INTO v_result
  FROM (
    SELECT
      m.id, m.name, m.body, m.language, m.tags, m.usage_count,
      m.last_used_at, m.archived_at, m.created_at, m.updated_at, m.created_by,
      COALESCE(
        (SELECT json_agg(json_build_object('id', tg.id, 'name', tg.name, 'color', tg.color))
         FROM macro_tags mt JOIN tags tg ON tg.id = mt.tag_id
         WHERE mt.macro_id = m.id),
        '[]'::json
      ) AS "tagObjects"
    FROM macros m
    WHERE m.workspace_id = v_ws
      AND (v_is_archived = true AND m.archived_at IS NOT NULL
           OR v_is_archived = false AND m.archived_at IS NULL)
      AND (p_search IS NULL OR m.name ILIKE '%' || p_search || '%')
      AND (p_language IS NULL OR p_language = '' OR m.language = p_language)
      AND (v_tag_list IS NULL OR m.tags @> v_tag_list)
    LIMIT 500
  ) row_data;

  RETURN v_result;
END;
$$;

------------------------------------------------------------------------
-- 2) api_create_macro
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_create_macro(
  p_name     text,
  p_body     text DEFAULT '',
  p_language text DEFAULT 'auto',
  p_tags     text[] DEFAULT '{}'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws      uuid := get_user_workspace_id();
  v_role    text := get_user_workspace_role();
  v_uid     uuid := auth.uid();
  v_macro   record;
  v_tag_ids uuid[];
  v_tag_objects json;
BEGIN
  IF v_role NOT IN ('owner', 'admin', 'agent') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING HINT = 'You do not have permission to create macros.';
  END IF;

  PERFORM check_write_access(v_ws);

  INSERT INTO macros (workspace_id, name, body, language, tags, created_by)
  VALUES (v_ws, trim(p_name), COALESCE(p_body, ''), COALESCE(p_language, 'auto'), COALESCE(p_tags, '{}'), v_uid)
  RETURNING * INTO v_macro;

  -- Sync tags
  IF p_tags IS NOT NULL AND array_length(p_tags, 1) > 0 THEN
    v_tag_ids := ensure_tags_by_name(v_ws, p_tags, v_uid);
    PERFORM sync_macro_tags(v_macro.id, v_tag_ids);

    SELECT COALESCE(json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color)), '[]'::json)
    INTO v_tag_objects
    FROM tags t WHERE t.id = ANY(v_tag_ids);
  ELSE
    v_tag_objects := '[]'::json;
  END IF;

  RETURN json_build_object('macro', json_build_object(
    'id', v_macro.id, 'name', v_macro.name, 'body', v_macro.body,
    'language', v_macro.language, 'tags', v_macro.tags,
    'usage_count', v_macro.usage_count, 'created_at', v_macro.created_at,
    'updated_at', v_macro.updated_at, 'tagObjects', v_tag_objects
  ));
END;
$$;

------------------------------------------------------------------------
-- 3) api_get_macro
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_get_macro(p_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws     uuid := get_user_workspace_id();
  v_result json;
BEGIN
  SELECT json_build_object('macro', json_build_object(
    'id', m.id, 'name', m.name, 'body', m.body, 'language', m.language,
    'tags', m.tags, 'usage_count', m.usage_count, 'last_used_at', m.last_used_at,
    'archived_at', m.archived_at, 'created_at', m.created_at, 'updated_at', m.updated_at,
    'created_by', m.created_by,
    'tagObjects', COALESCE(
      (SELECT json_agg(json_build_object('id', tg.id, 'name', tg.name, 'color', tg.color))
       FROM macro_tags mt JOIN tags tg ON tg.id = mt.tag_id WHERE mt.macro_id = m.id),
      '[]'::json
    )
  )) INTO v_result
  FROM macros m
  WHERE m.id = p_id AND m.workspace_id = v_ws;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Macro not found' USING HINT = 'not_found';
  END IF;

  RETURN v_result;
END;
$$;

------------------------------------------------------------------------
-- 4) api_update_macro
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_update_macro(
  p_id       uuid,
  p_name     text DEFAULT NULL,
  p_body     text DEFAULT NULL,
  p_language text DEFAULT NULL,
  p_tags     text[] DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws      uuid := get_user_workspace_id();
  v_role    text := get_user_workspace_role();
  v_uid     uuid := auth.uid();
  v_macro   record;
  v_tag_ids uuid[];
  v_tag_objects json;
BEGIN
  IF v_role NOT IN ('owner', 'admin', 'agent') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING HINT = 'You do not have permission to edit macros.';
  END IF;

  PERFORM check_write_access(v_ws);

  UPDATE macros SET
    name     = COALESCE(p_name, name),
    body     = COALESCE(p_body, body),
    language = COALESCE(p_language, language),
    tags     = COALESCE(p_tags, tags)
  WHERE id = p_id AND workspace_id = v_ws
  RETURNING * INTO v_macro;

  IF v_macro.id IS NULL THEN
    RAISE EXCEPTION 'Macro not found' USING HINT = 'not_found';
  END IF;

  -- Sync tags if provided
  IF p_tags IS NOT NULL THEN
    v_tag_ids := ensure_tags_by_name(v_ws, p_tags, v_uid);
    PERFORM sync_macro_tags(v_macro.id, v_tag_ids);
  END IF;

  -- Fetch tag objects for response
  SELECT COALESCE(json_agg(json_build_object('id', tg.id, 'name', tg.name, 'color', tg.color)), '[]'::json)
  INTO v_tag_objects
  FROM macro_tags mt JOIN tags tg ON tg.id = mt.tag_id
  WHERE mt.macro_id = v_macro.id;

  RETURN json_build_object('macro', json_build_object(
    'id', v_macro.id, 'name', v_macro.name, 'body', v_macro.body,
    'language', v_macro.language, 'tags', v_macro.tags,
    'tagObjects', v_tag_objects,
    'created_at', v_macro.created_at, 'updated_at', v_macro.updated_at
  ));
END;
$$;

------------------------------------------------------------------------
-- 5) api_delete_macro
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_delete_macro(p_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws    uuid := get_user_workspace_id();
  v_role  text := get_user_workspace_role();
  v_found boolean;
BEGIN
  IF v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING HINT = 'Only owners and admins can delete macros.';
  END IF;

  PERFORM check_write_access(v_ws);

  DELETE FROM macros WHERE id = p_id AND workspace_id = v_ws
  RETURNING true INTO v_found;

  IF v_found IS NULL THEN
    RAISE EXCEPTION 'Macro not found' USING HINT = 'not_found';
  END IF;

  RETURN json_build_object('ok', true);
END;
$$;

------------------------------------------------------------------------
-- 6) api_archive_macro
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_archive_macro(p_id uuid)
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
  IF v_role NOT IN ('owner', 'admin', 'agent') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  PERFORM check_write_access(v_ws);

  UPDATE macros SET archived_at = now()
  WHERE id = p_id AND workspace_id = v_ws AND archived_at IS NULL
  RETURNING true INTO v_found;

  IF v_found IS NULL THEN
    RAISE EXCEPTION 'Macro not found or already archived' USING HINT = 'not_found';
  END IF;

  RETURN json_build_object('ok', true);
END;
$$;

------------------------------------------------------------------------
-- 7) api_restore_macro
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_restore_macro(p_id uuid)
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
  IF v_role NOT IN ('owner', 'admin', 'agent') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  PERFORM check_write_access(v_ws);

  UPDATE macros SET archived_at = NULL
  WHERE id = p_id AND workspace_id = v_ws AND archived_at IS NOT NULL
  RETURNING true INTO v_found;

  IF v_found IS NULL THEN
    RAISE EXCEPTION 'Macro not found or not archived' USING HINT = 'not_found';
  END IF;

  RETURN json_build_object('ok', true);
END;
$$;

------------------------------------------------------------------------
-- 8) api_duplicate_macro
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_duplicate_macro(p_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws     uuid := get_user_workspace_id();
  v_role   text := get_user_workspace_role();
  v_source record;
  v_new    record;
  v_name   text;
BEGIN
  IF v_role NOT IN ('owner', 'admin', 'agent') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  PERFORM check_write_access(v_ws);

  SELECT * INTO v_source FROM macros
  WHERE id = p_id AND workspace_id = v_ws;

  IF v_source IS NULL THEN
    RAISE EXCEPTION 'Macro not found' USING HINT = 'not_found';
  END IF;

  v_name := left(v_source.name || ' (copy)', 200);

  INSERT INTO macros (workspace_id, name, body, language, tags, created_by)
  VALUES (v_ws, v_name, v_source.body, v_source.language, v_source.tags, auth.uid())
  RETURNING * INTO v_new;

  RETURN json_build_object('macro', json_build_object(
    'id', v_new.id, 'name', v_new.name, 'body', v_new.body,
    'language', v_new.language, 'tags', v_new.tags,
    'created_at', v_new.created_at, 'updated_at', v_new.updated_at
  ));
END;
$$;

------------------------------------------------------------------------
-- 9) api_get_macro_onboarding
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_get_macro_onboarding()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws     uuid := get_user_workspace_id();
  v_result json;
BEGIN
  SELECT row_to_json(mo) INTO v_result
  FROM macro_onboarding mo
  WHERE mo.workspace_id = v_ws;

  RETURN json_build_object('onboarding', v_result);
END;
$$;

------------------------------------------------------------------------
-- 10) api_save_macro_onboarding
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_save_macro_onboarding(p_answers jsonb)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws  uuid := get_user_workspace_id();
  v_uid uuid := auth.uid();
BEGIN
  PERFORM check_write_access(v_ws);

  INSERT INTO macro_onboarding (workspace_id, answers, completed_at, created_by)
  VALUES (v_ws, p_answers, now(), v_uid)
  ON CONFLICT (workspace_id)
  DO UPDATE SET answers = EXCLUDED.answers, completed_at = now();

  RETURN json_build_object('success', true);
END;
$$;

------------------------------------------------------------------------
-- Grants
------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION ensure_tags_by_name(uuid, text[], uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION sync_macro_tags(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION api_list_macros(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION api_create_macro(text, text, text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION api_get_macro(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION api_update_macro(uuid, text, text, text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION api_delete_macro(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION api_archive_macro(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION api_restore_macro(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION api_duplicate_macro(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION api_get_macro_onboarding() TO authenticated;
GRANT EXECUTE ON FUNCTION api_save_macro_onboarding(jsonb) TO authenticated;
