begin;

-- Empty slug means "no custom URL" (default). It must be stored as NULL so the
-- partial unique index (workspaces_slug_idx WHERE slug IS NOT NULL) doesn't treat
-- multiple empty-string slugs as duplicates. Normalise any legacy '' rows.
update workspaces set slug = null where slug = '';

-- Recreate api_update_workspace so that:
--   * an empty-string slug is treated as "clear to default" (NULL), not a value
--   * the uniqueness check is skipped for empty/NULL slugs (no false "taken" error)
create or replace function api_update_workspace(
  p_name              text    default null,
  p_slug              text    default null,
  p_logo_url          text    default null,
  p_timezone          text    default null,
  p_locale            text    default null,
  p_date_format       text    default null,
  p_time_format       text    default null,
  p_first_day_of_week text    default null,
  p_show_order_data   boolean default null,
  p_auto_translate    boolean default null,
  p_allow_deletion    boolean default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws   uuid := get_user_workspace_id();
  v_role text := get_user_workspace_role();
  v_dup  uuid;
  v_result record;
begin
  if v_role not in ('owner', 'admin') then
    raise exception 'FORBIDDEN' using hint = 'Only owners and admins can update workspace settings.';
  end if;

  perform check_write_access(v_ws);

  -- Only check uniqueness for a real, non-empty slug. Empty = default URL.
  if p_slug is not null and p_slug <> '' then
    select id into v_dup from workspaces where slug = p_slug and id <> v_ws;
    if v_dup is not null then
      raise exception 'Slug already taken' using hint = 'slug_taken';
    end if;
  end if;

  update workspaces set
    name              = coalesce(p_name, name),
    slug              = case
                          when p_slug is null then slug   -- omitted = no change
                          when p_slug = ''    then null   -- cleared = default URL
                          else p_slug
                        end,
    logo_url          = coalesce(p_logo_url, logo_url),
    timezone          = coalesce(p_timezone, timezone),
    locale            = coalesce(p_locale, locale),
    date_format       = coalesce(p_date_format, date_format),
    time_format       = coalesce(p_time_format, time_format),
    first_day_of_week = coalesce(p_first_day_of_week, first_day_of_week),
    show_order_data   = coalesce(p_show_order_data, show_order_data),
    auto_translate    = coalesce(p_auto_translate, auto_translate),
    allow_deletion    = coalesce(p_allow_deletion, allow_deletion)
  where id = v_ws
  returning * into v_result;

  return json_build_object('workspace', row_to_json(v_result));
end;
$$;

commit;
