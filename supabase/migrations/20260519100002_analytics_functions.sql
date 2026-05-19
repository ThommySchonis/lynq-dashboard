-- ============================================================
-- 1. get_response_times
-- ============================================================
create or replace function get_response_times(
  p_workspace_id uuid,
  p_agent_id     uuid        default null,
  p_date_from    timestamptz default null,
  p_date_to      timestamptz default null
)
returns table (
  avg_response_time_seconds  numeric,
  median_response_time_seconds numeric,
  total_conversations        bigint
)
language sql stable
as $$
  with per_ticket as (
    select
      conversation_id,
      min(created_at) filter (where event_type = 'message_received') as first_inbound,
      min(created_at) filter (where event_type = 'message_sent')     as first_reply,
      (array_agg(agent_id order by created_at) filter (where event_type = 'message_sent'))[1] as first_reply_agent
    from support_events
    where workspace_id = p_workspace_id
      and event_type in ('message_received', 'message_sent')
      and (p_date_from is null or created_at >= p_date_from)
      and (p_date_to   is null or created_at <= p_date_to)
    group by conversation_id
    having min(created_at) filter (where event_type = 'message_received') is not null
       and min(created_at) filter (where event_type = 'message_sent')     is not null
  ),
  filtered as (
    select
      extract(epoch from (first_reply - first_inbound)) as response_seconds
    from per_ticket
    where (p_agent_id is null or first_reply_agent = p_agent_id)
  )
  select
    coalesce(avg(response_seconds), 0)::numeric                          as avg_response_time_seconds,
    coalesce(percentile_cont(0.5) within group (order by response_seconds), 0)::numeric as median_response_time_seconds,
    count(*)                                                              as total_conversations
  from filtered;
$$;


-- ============================================================
-- 2. get_resolution_times
-- ============================================================
create or replace function get_resolution_times(
  p_workspace_id uuid,
  p_agent_id     uuid        default null,
  p_date_from    timestamptz default null,
  p_date_to      timestamptz default null
)
returns table (
  avg_resolution_time_seconds  numeric,
  median_resolution_time_seconds numeric,
  total_resolved               bigint
)
language sql stable
as $$
  with per_ticket as (
    select
      conversation_id,
      min(created_at) filter (where event_type = 'ticket_opened')   as opened_at,
      min(created_at) filter (where event_type = 'ticket_resolved') as resolved_at,
      (array_agg(agent_id order by created_at) filter (where event_type = 'ticket_resolved'))[1] as resolved_by
    from support_events
    where workspace_id = p_workspace_id
      and event_type in ('ticket_opened', 'ticket_resolved')
      and (p_date_from is null or created_at >= p_date_from)
      and (p_date_to   is null or created_at <= p_date_to)
    group by conversation_id
    having min(created_at) filter (where event_type = 'ticket_opened')   is not null
       and min(created_at) filter (where event_type = 'ticket_resolved') is not null
  ),
  filtered as (
    select
      extract(epoch from (resolved_at - opened_at)) as resolution_seconds
    from per_ticket
    where (p_agent_id is null or resolved_by = p_agent_id)
  )
  select
    coalesce(avg(resolution_seconds), 0)::numeric                            as avg_resolution_time_seconds,
    coalesce(percentile_cont(0.5) within group (order by resolution_seconds), 0)::numeric as median_resolution_time_seconds,
    count(*)                                                                  as total_resolved
  from filtered;
$$;


-- ============================================================
-- 3. get_ticket_volume
-- ============================================================
create or replace function get_ticket_volume(
  p_workspace_id uuid,
  p_agent_id     uuid        default null,
  p_date_from    timestamptz default null,
  p_date_to      timestamptz default null
)
returns table (
  date           date,
  opened_count   bigint,
  resolved_count bigint
)
language sql stable
as $$
  select
    (created_at at time zone 'UTC')::date as date,
    count(*) filter (where event_type = 'ticket_opened')   as opened_count,
    count(*) filter (where event_type = 'ticket_resolved') as resolved_count
  from support_events
  where workspace_id = p_workspace_id
    and event_type in ('ticket_opened', 'ticket_resolved')
    and (p_date_from is null or created_at >= p_date_from)
    and (p_date_to   is null or created_at <= p_date_to)
    and (p_agent_id  is null or agent_id = p_agent_id)
  group by (created_at at time zone 'UTC')::date
  order by date;
$$;


-- ============================================================
-- 4. get_agent_productivity
-- ============================================================
create or replace function get_agent_productivity(
  p_workspace_id uuid,
  p_agent_id     uuid        default null,
  p_date_from    timestamptz default null,
  p_date_to      timestamptz default null
)
returns table (
  agent_id               uuid,
  messages_sent          bigint,
  tickets_resolved       bigint,
  one_touch_count        bigint,
  one_touch_rate         numeric,
  avg_messages_per_ticket numeric
)
language sql stable
as $$
  with agent_msgs as (
    select
      agent_id,
      conversation_id,
      count(*) as msg_count
    from support_events
    where workspace_id = p_workspace_id
      and event_type = 'message_sent'
      and agent_id is not null
      and (p_date_from is null or created_at >= p_date_from)
      and (p_date_to   is null or created_at <= p_date_to)
      and (p_agent_id  is null or agent_id = p_agent_id)
    group by agent_id, conversation_id
  ),
  agent_resolved as (
    select
      agent_id,
      conversation_id
    from support_events
    where workspace_id = p_workspace_id
      and event_type = 'ticket_resolved'
      and agent_id is not null
      and (p_date_from is null or created_at >= p_date_from)
      and (p_date_to   is null or created_at <= p_date_to)
      and (p_agent_id  is null or agent_id = p_agent_id)
  ),
  one_touch as (
    select
      ar.agent_id,
      ar.conversation_id
    from agent_resolved ar
    join agent_msgs am on am.agent_id = ar.agent_id and am.conversation_id = ar.conversation_id
    where am.msg_count = 1
  )
  select
    am_agg.agent_id,
    sum(am_agg.msg_count)::bigint                                as messages_sent,
    (select count(*) from agent_resolved ar2 where ar2.agent_id = am_agg.agent_id)::bigint as tickets_resolved,
    (select count(*) from one_touch ot where ot.agent_id = am_agg.agent_id)::bigint        as one_touch_count,
    case
      when (select count(*) from agent_resolved ar3 where ar3.agent_id = am_agg.agent_id) = 0 then 0
      else round(
        (select count(*) from one_touch ot2 where ot2.agent_id = am_agg.agent_id)::numeric /
        (select count(*) from agent_resolved ar4 where ar4.agent_id = am_agg.agent_id) * 100, 1
      )
    end                                                           as one_touch_rate,
    round(avg(am_agg.msg_count), 1)::numeric                     as avg_messages_per_ticket
  from agent_msgs am_agg
  group by am_agg.agent_id;
$$;


-- ============================================================
-- 5. get_refund_reasons
-- ============================================================
create or replace function get_refund_reasons(
  p_workspace_id uuid,
  p_agent_id     uuid        default null,
  p_date_from    timestamptz default null,
  p_date_to      timestamptz default null
)
returns table (
  reason     text,
  count      bigint,
  percentage numeric
)
language sql stable
as $$
  with reasons as (
    select
      metadata->>'refund_reason' as reason
    from support_events
    where workspace_id = p_workspace_id
      and event_type = 'ticket_resolved'
      and metadata->>'refund_reason' is not null
      and (p_date_from is null or created_at >= p_date_from)
      and (p_date_to   is null or created_at <= p_date_to)
      and (p_agent_id  is null or agent_id = p_agent_id)
  ),
  counted as (
    select reason, count(*) as cnt
    from reasons
    group by reason
  )
  select
    reason,
    cnt as count,
    round(cnt::numeric / nullif((select sum(cnt) from counted), 0) * 100, 1) as percentage
  from counted
  order by cnt desc;
$$;
