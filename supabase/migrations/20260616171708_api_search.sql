-- ============================================================
-- api_search — global search with facet filters.
-- Workspace-scoped via explicit p_workspace_id (called by the
-- /search Hono route using the admin client). Returns raw-ish
-- rows; the service layer builds message snippets and dedupes
-- contacts (reusing existing tested TS helpers).
--
-- Status filter values are OR'd and heterogeneous:
--   'open'|'pending'|'resolved' -> email_conversations.status
--   'spam'                      -> email_conversations.is_spam
--   'ai_staged'                 -> EXISTS pending ai_drafts row
-- Assignee values are OR'd: workspace_members.id uuids, plus the
-- 'unassigned' sentinel (assigned_to IS NULL). 'me' is resolved
-- to a member id on the client before the call.
-- Facets apply to conversations + messages only. Contacts are
-- text-only and return [] when there is no query.
-- ============================================================
create or replace function public.api_search(
  p_workspace_id uuid,
  p_q            text default null,
  p_types        text[] default array['conversations','messages','contacts'],
  p_status       text[] default '{}',
  p_assignee     text[] default '{}',
  p_date_from    timestamptz default null,
  p_date_to      timestamptz default null,
  p_limit        int default 5
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_q       text := nullif(btrim(coalesce(p_q, '')), '');
  v_pattern text := '%' ||
    replace(replace(replace(coalesce(v_q,''), '\', '\\'), '%', '\%'), '_', '\_') || '%';

  v_enum_statuses   text[] := array(
    select s from unnest(p_status) s where s in ('open','pending','resolved'));
  v_want_spam       boolean := 'spam'      = any(p_status);
  v_want_staged     boolean := 'ai_staged' = any(p_status);
  v_has_status      boolean := array_length(p_status, 1) is not null;

  -- Regex-guard the cast: any non-uuid value (incl. the 'unassigned' sentinel,
  -- or an unresolved 'me') is dropped rather than raising and aborting the call.
  v_assignee_ids    uuid[] := array(
    select x::uuid from unnest(p_assignee) x
    where x ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
  v_want_unassigned boolean := 'unassigned' = any(p_assignee);
  v_has_assignee    boolean := array_length(p_assignee, 1) is not null;

  v_conversations json := '[]'::json;
  v_messages      json := '[]'::json;
  v_contacts      json := '[]'::json;
begin
  if 'conversations' = any(p_types) then
    select coalesce(json_agg(row_to_json(t)), '[]'::json) into v_conversations
    from (
      select c.id, c.subject, c.snippet, c.customer_email, c.customer_name,
             c.last_message_at, c.status
      from email_conversations c
      where c.workspace_id = p_workspace_id
        and (v_q is null
             or c.subject ilike v_pattern or c.snippet ilike v_pattern
             or c.customer_email ilike v_pattern or c.customer_name ilike v_pattern)
        and (not v_has_status
             or c.status = any(v_enum_statuses)
             or (v_want_spam and c.is_spam = true)
             or (v_want_staged and exists (
                   select 1 from ai_drafts d
                   where d.conversation_id = c.id
                     and d.workspace_id = p_workspace_id
                     and d.status = 'pending')))
        and (not v_has_assignee
             or c.assigned_to = any(v_assignee_ids)
             or (v_want_unassigned and c.assigned_to is null))
        and (p_date_from is null or c.last_message_at >= p_date_from)
        and (p_date_to   is null or c.last_message_at <= p_date_to)
      order by c.last_message_at desc nulls last
      limit p_limit
    ) t;
  end if;

  if 'messages' = any(p_types) then
    select coalesce(json_agg(row_to_json(t)), '[]'::json) into v_messages
    from (
      select m.id, m.conversation_id, m.body_text, m.from_email, m.from_name,
             m.is_outbound, m.created_at
      from email_messages m
      join email_conversations c on c.id = m.conversation_id
      where m.workspace_id = p_workspace_id
        and (v_q is null
             or m.body_text ilike v_pattern or m.from_email ilike v_pattern
             or m.from_name ilike v_pattern)
        and (not v_has_status
             or c.status = any(v_enum_statuses)
             or (v_want_spam and c.is_spam = true)
             or (v_want_staged and exists (
                   select 1 from ai_drafts d
                   where d.conversation_id = c.id
                     and d.workspace_id = p_workspace_id
                     and d.status = 'pending')))
        and (not v_has_assignee
             or c.assigned_to = any(v_assignee_ids)
             or (v_want_unassigned and c.assigned_to is null))
        and (p_date_from is null or c.last_message_at >= p_date_from)
        and (p_date_to   is null or c.last_message_at <= p_date_to)
      order by m.created_at desc nulls last
      limit p_limit
    ) t;
  end if;

  -- Contacts: text-only (no facets). Over-fetch for client-side dedupe.
  if 'contacts' = any(p_types) and v_q is not null then
    select coalesce(json_agg(row_to_json(t)), '[]'::json) into v_contacts
    from (
      select c.customer_email, c.customer_name, c.last_message_at
      from email_conversations c
      where c.workspace_id = p_workspace_id
        and (c.customer_email ilike v_pattern or c.customer_name ilike v_pattern)
      order by c.last_message_at desc nulls last
      limit p_limit * 4
    ) t;
  end if;

  return json_build_object(
    'conversations', v_conversations,
    'messages',      v_messages,
    'contacts',      v_contacts
  );
end;
$$;

grant execute on function public.api_search(
  uuid, text, text[], text[], text[], timestamptz, timestamptz, int
) to authenticated, service_role;
