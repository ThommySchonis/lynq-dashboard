-- Fix: "column reference updated_at is ambiguous" in api_list_macros
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
