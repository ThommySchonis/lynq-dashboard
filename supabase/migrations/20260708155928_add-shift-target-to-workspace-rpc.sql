-- Surface + edit workspaces.shift_target_seconds through the workspace-settings
-- RPCs so the General settings page can read and update the nominal shift length
-- that scales the time-tracking progress bar.
--
-- api_get_workspace: add the column to the returned row.
-- api_update_workspace: add an optional p_shift_target_seconds param, COALESCEd
--   onto the existing value like every other field. The column's own
--   CHECK (shift_target_seconds > 0) guards against non-positive values.

------------------------------------------------------------------------
-- api_get_workspace
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_get_workspace()
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
    'workspace', row_to_json(w),
    'role', v_role
  ) INTO v_result
  FROM (
    SELECT id, name, slug, logo_url, timezone, locale, date_format,
           time_format, first_day_of_week, show_order_data, auto_translate,
           allow_deletion, shift_target_seconds, created_at, updated_at
    FROM workspaces WHERE id = v_ws
  ) w;

  RETURN v_result;
END;
$$;

------------------------------------------------------------------------
-- api_update_workspace
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api_update_workspace(
  p_name                text    DEFAULT NULL,
  p_slug                text    DEFAULT NULL,
  p_logo_url            text    DEFAULT NULL,
  p_timezone            text    DEFAULT NULL,
  p_locale              text    DEFAULT NULL,
  p_date_format         text    DEFAULT NULL,
  p_time_format         text    DEFAULT NULL,
  p_first_day_of_week   text    DEFAULT NULL,
  p_show_order_data     boolean DEFAULT NULL,
  p_auto_translate      boolean DEFAULT NULL,
  p_allow_deletion      boolean DEFAULT NULL,
  p_shift_target_seconds int    DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws   uuid := get_user_workspace_id();
  v_role text := get_user_workspace_role();
  v_dup  uuid;
  v_result record;
BEGIN
  IF v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING HINT = 'Only owners and admins can update workspace settings.';
  END IF;

  PERFORM check_write_access(v_ws);

  -- Only check uniqueness for a real, non-empty slug. Empty = default URL.
  IF p_slug IS NOT NULL AND p_slug <> '' THEN
    SELECT id INTO v_dup FROM workspaces WHERE slug = p_slug AND id <> v_ws;
    IF v_dup IS NOT NULL THEN
      RAISE EXCEPTION 'Slug already taken' USING HINT = 'slug_taken';
    END IF;
  END IF;

  UPDATE workspaces SET
    name                 = COALESCE(p_name, name),
    slug                 = CASE
                             WHEN p_slug IS NULL THEN slug   -- omitted = no change
                             WHEN p_slug = ''    THEN NULL   -- cleared = default URL
                             ELSE p_slug
                           END,
    logo_url             = COALESCE(p_logo_url, logo_url),
    timezone             = COALESCE(p_timezone, timezone),
    locale               = COALESCE(p_locale, locale),
    date_format          = COALESCE(p_date_format, date_format),
    time_format          = COALESCE(p_time_format, time_format),
    first_day_of_week    = COALESCE(p_first_day_of_week, first_day_of_week),
    show_order_data      = COALESCE(p_show_order_data, show_order_data),
    auto_translate       = COALESCE(p_auto_translate, auto_translate),
    allow_deletion       = COALESCE(p_allow_deletion, allow_deletion),
    shift_target_seconds = COALESCE(p_shift_target_seconds, shift_target_seconds)
  WHERE id = v_ws
  RETURNING * INTO v_result;

  RETURN json_build_object('workspace', row_to_json(v_result));
END;
$$;
