


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."accept_ownership_transfer"("p_transfer_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_transfer RECORD;
BEGIN
  -- Lock the transfer row
  SELECT * INTO v_transfer
  FROM ownership_transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer not found';
  END IF;

  IF v_transfer.status <> 'pending' THEN
    RAISE EXCEPTION 'Transfer is not pending (status: %)', v_transfer.status;
  END IF;

  -- Check expiration — mark expired and exit
  IF v_transfer.expires_at <= now() THEN
    UPDATE ownership_transfers
    SET status = 'expired', resolved_at = now()
    WHERE id = p_transfer_id;
    RAISE EXCEPTION 'Transfer has expired';
  END IF;

  -- Demote old owner
  UPDATE workspace_members
  SET role = v_transfer.new_role_for_old_owner
  WHERE workspace_id = v_transfer.workspace_id
    AND user_id = v_transfer.from_user_id;

  -- Promote new owner
  UPDATE workspace_members
  SET role = 'owner'
  WHERE workspace_id = v_transfer.workspace_id
    AND user_id = v_transfer.to_user_id;

  -- Mark transfer as accepted
  UPDATE ownership_transfers
  SET status = 'accepted', resolved_at = now()
  WHERE id = p_transfer_id;
END;
$$;


ALTER FUNCTION "public"."accept_ownership_transfer"("p_transfer_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_workspace_invite"("p_token" "text", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_invite     record;
  v_user       record;
  v_member_id  uuid;
begin
  -- Step 1: lock the invite row
  select * into v_invite
    from workspace_invites
    where token = p_token
    for update;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  -- Step 2: expiry
  if v_invite.expires_at < now() then
    return jsonb_build_object('error', 'expired');
  end if;

  -- Step 3: idempotent — already accepted
  if v_invite.accepted_at is not null then
    return jsonb_build_object('ok', true, 'workspace_id', v_invite.workspace_id);
  end if;

  -- Step 4 (NEW): email-match check — case-insensitive
  select id, email into v_user
    from auth.users
    where id = p_user_id;

  if not found then
    return jsonb_build_object('error', 'user_not_found');
  end if;

  if lower(v_user.email) <> lower(v_invite.email) then
    return jsonb_build_object(
      'error',        'email_mismatch',
      'invite_email', v_invite.email,
      'user_email',   v_user.email
    );
  end if;

  -- Step 5: insert membership (idempotent against unique violation)
  begin
    insert into workspace_members (workspace_id, user_id, role)
      values (v_invite.workspace_id, p_user_id, v_invite.role)
      returning id into v_member_id;
  exception when unique_violation then
    null;  -- already a member; still mark invite accepted and return OK
  end;

  -- Step 6: mark invite accepted
  update workspace_invites
    set accepted_at = now()
    where id = v_invite.id;

  -- Step 7: return success
  return jsonb_build_object(
    'ok',           true,
    'workspace_id', v_invite.workspace_id,
    'member_id',    v_member_id
  );
end;
$$;


ALTER FUNCTION "public"."accept_workspace_invite"("p_token" "text", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."anonymize_workspace_member"("p_user_id" "uuid", "p_workspace_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_member_id uuid;
BEGIN
  -- Look up the workspace_members row for this user
  SELECT id INTO v_member_id FROM public.workspace_members
    WHERE user_id = p_user_id AND workspace_id = p_workspace_id;

  IF v_member_id IS NOT NULL THEN
    -- Nullify task references (tasks.assigned_to and created_by reference workspace_members.id)
    UPDATE public.tasks SET assigned_to = NULL WHERE assigned_to = v_member_id AND workspace_id = p_workspace_id;
    UPDATE public.tasks SET created_by = NULL WHERE created_by = v_member_id AND workspace_id = p_workspace_id;

    -- Nullify support event references (agent_id references workspace_members.id)
    UPDATE public.support_events SET agent_id = NULL WHERE agent_id = v_member_id AND workspace_id = p_workspace_id;

    -- Nullify conversation assignments (assigned_to references workspace_members.id)
    UPDATE public.email_conversations SET assigned_to = NULL WHERE assigned_to = v_member_id AND workspace_id = p_workspace_id;
  END IF;

  -- Nullify references that use auth.users(id) directly
  UPDATE public.macros SET created_by = NULL WHERE created_by = p_user_id AND workspace_id = p_workspace_id;
  UPDATE public.macro_onboarding SET created_by = NULL WHERE created_by = p_user_id AND workspace_id = p_workspace_id;

  -- Remove membership
  DELETE FROM public.workspace_members WHERE user_id = p_user_id AND workspace_id = p_workspace_id;

  -- Audit trail
  INSERT INTO public.anonymized_members (workspace_id, original_user_id, anonymized_at)
  VALUES (p_workspace_id, p_user_id, now());
END;
$$;


ALTER FUNCTION "public"."anonymize_workspace_member"("p_user_id" "uuid", "p_workspace_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finance_monthly_trend"("months_back" integer DEFAULT 12) RETURNS TABLE("month_start" "date", "revenue_cents" bigint, "costs_cents" bigint, "margin_cents" bigint, "margin_percent" numeric)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  return query
  with months as (
    select
      date_trunc('month', now() - (n || ' months')::interval)::date as m_start,
      date_trunc('month', now() - ((n - 1) || ' months')::interval)::date as m_end
    from generate_series(0, months_back - 1) as n
  ),
  rev as (
    select
      date_trunc('month', occurred_at)::date as month_start,
      sum(public.finance_to_eur(amount_cents, currency)) as total
    from public.finance_revenue_events
    where occurred_at >= date_trunc('month', now() - (months_back || ' months')::interval)
    group by 1
  ),
  cost as (
    select
      date_trunc('month', occurred_at)::date as month_start,
      sum(public.finance_to_eur(amount_cents, currency)) as total
    from public.finance_cost_events
    where occurred_at >= date_trunc('month', now() - (months_back || ' months')::interval)
    group by 1
  ),
  fixed as (
    select coalesce(sum(public.finance_to_eur(amount_cents, currency)), 0) as total
    from public.finance_fixed_subscriptions where active = true
  )
  select
    m.m_start as month_start,
    coalesce(rev.total, 0)::bigint as revenue_cents,
    (coalesce(cost.total, 0) + fixed.total)::bigint as costs_cents,
    (coalesce(rev.total, 0) - coalesce(cost.total, 0) - fixed.total)::bigint as margin_cents,
    case
      when coalesce(rev.total, 0) = 0 then 0::numeric
      else round(
        ((coalesce(rev.total, 0) - coalesce(cost.total, 0) - fixed.total)::numeric
         / rev.total::numeric) * 100,
        2
      )
    end as margin_percent
  from months m
  cross join fixed
  left join rev on rev.month_start = m.m_start
  left join cost on cost.month_start = m.m_start
  order by m.m_start asc;
end $$;


ALTER FUNCTION "public"."finance_monthly_trend"("months_back" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finance_summary"("period_start" timestamp with time zone, "period_end" timestamp with time zone) RETURNS TABLE("revenue_cents" bigint, "recurring_cents" bigint, "one_off_cents" bigint, "variable_costs_cents" bigint, "ai_costs_cents" bigint, "fixed_costs_cents" bigint, "total_costs_cents" bigint, "net_margin_cents" bigint, "margin_percent" numeric, "revenue_count" integer, "cost_count" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_revenue bigint := 0;
  v_recurring bigint := 0;
  v_one_off bigint := 0;
  v_variable bigint := 0;
  v_ai bigint := 0;
  v_fixed bigint := 0;
  v_rev_count int := 0;
  v_cost_count int := 0;
begin
  -- Revenue (normalize to EUR)
  select
    coalesce(sum(public.finance_to_eur(amount_cents, currency)), 0),
    coalesce(sum(public.finance_to_eur(amount_cents, currency)) filter (where recurring), 0),
    coalesce(sum(public.finance_to_eur(amount_cents, currency)) filter (where not recurring), 0),
    count(*)
  into v_revenue, v_recurring, v_one_off, v_rev_count
  from public.finance_revenue_events
  where occurred_at >= period_start and occurred_at < period_end;

  -- Variable costs (Anthropic, Whop fees, etc.)
  select
    coalesce(sum(public.finance_to_eur(amount_cents, currency)), 0),
    coalesce(sum(public.finance_to_eur(amount_cents, currency)) filter (where category = 'ai'), 0),
    count(*)
  into v_variable, v_ai, v_cost_count
  from public.finance_cost_events
  where occurred_at >= period_start and occurred_at < period_end;

  -- Fixed costs — pro-rated for the period
  -- Assumption: monthly subs; if period covers a full month, count once.
  -- For partial months, pro-rate by days.
  select coalesce(sum(
    public.finance_to_eur(amount_cents, currency)
    * least(1.0, extract(epoch from (period_end - period_start)) / (86400 * 30))
  )::bigint, 0)
  into v_fixed
  from public.finance_fixed_subscriptions
  where active = true;

  revenue_cents := v_revenue;
  recurring_cents := v_recurring;
  one_off_cents := v_one_off;
  variable_costs_cents := v_variable;
  ai_costs_cents := v_ai;
  fixed_costs_cents := v_fixed;
  total_costs_cents := v_variable + v_fixed;
  net_margin_cents := v_revenue - (v_variable + v_fixed);
  margin_percent := case
    when v_revenue = 0 then 0
    else round((net_margin_cents::numeric / v_revenue::numeric) * 100, 2)
  end;
  revenue_count := v_rev_count;
  cost_count := v_cost_count;

  return next;
end $$;


ALTER FUNCTION "public"."finance_summary"("period_start" timestamp with time zone, "period_end" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finance_to_eur"("amount_cents" bigint, "from_currency" "text") RETURNS bigint
    LANGUAGE "plpgsql" STABLE
    AS $$
declare
  rate numeric;
begin
  if from_currency = 'EUR' or amount_cents = 0 then
    return amount_cents;
  end if;

  select fr.rate into rate
  from public.finance_fx_rates fr
  where fr.from_currency = finance_to_eur.from_currency
    and fr.to_currency = 'EUR'
  order by fr.fetched_at desc
  limit 1;

  -- Fallback rates if no fx data yet (sane defaults)
  if rate is null then
    rate := case from_currency
      when 'USD' then 0.92
      when 'GBP' then 1.17
      else 1.0
    end;
  end if;

  return round(amount_cents * rate)::bigint;
end $$;


ALTER FUNCTION "public"."finance_to_eur"("amount_cents" bigint, "from_currency" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finance_workspace_profitability"("period_start" timestamp with time zone, "period_end" timestamp with time zone) RETURNS TABLE("workspace_id" "uuid", "workspace_name" "text", "revenue_cents" bigint, "ai_cost_cents" bigint, "other_cost_cents" bigint, "margin_cents" bigint, "margin_percent" numeric)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  return query
  with rev as (
    select
      r.workspace_id,
      sum(public.finance_to_eur(r.amount_cents, r.currency)) as total
    from public.finance_revenue_events r
    where r.occurred_at >= period_start and r.occurred_at < period_end
      and r.workspace_id is not null
    group by r.workspace_id
  ),
  cost as (
    select
      c.workspace_id,
      sum(public.finance_to_eur(c.amount_cents, c.currency))
        filter (where c.category = 'ai') as ai_total,
      sum(public.finance_to_eur(c.amount_cents, c.currency))
        filter (where c.category <> 'ai') as other_total
    from public.finance_cost_events c
    where c.occurred_at >= period_start and c.occurred_at < period_end
      and c.workspace_id is not null
    group by c.workspace_id
  )
  select
    w.id as workspace_id,
    w.name as workspace_name,
    coalesce(rev.total, 0)::bigint as revenue_cents,
    coalesce(cost.ai_total, 0)::bigint as ai_cost_cents,
    coalesce(cost.other_total, 0)::bigint as other_cost_cents,
    (coalesce(rev.total, 0) - coalesce(cost.ai_total, 0) - coalesce(cost.other_total, 0))::bigint as margin_cents,
    case
      when coalesce(rev.total, 0) = 0 then 0::numeric
      else round(
        ((coalesce(rev.total, 0) - coalesce(cost.ai_total, 0) - coalesce(cost.other_total, 0))::numeric
         / rev.total::numeric) * 100,
        2
      )
    end as margin_percent
  from public.workspaces w
  left join rev on rev.workspace_id = w.id
  left join cost on cost.workspace_id = w.id
  where rev.total is not null or cost.ai_total is not null or cost.other_total is not null
  order by margin_cents asc; -- worst margin first
end $$;


ALTER FUNCTION "public"."finance_workspace_profitability"("period_start" timestamp with time zone, "period_end" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_agent_productivity"("p_workspace_id" "uuid", "p_agent_id" "uuid" DEFAULT NULL::"uuid", "p_date_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_date_to" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("agent_id" "uuid", "messages_sent" bigint, "tickets_resolved" bigint, "one_touch_count" bigint, "one_touch_rate" numeric, "avg_messages_per_ticket" numeric)
    LANGUAGE "sql" STABLE
    AS $$
  WITH agent_msgs AS (
    SELECT
      agent_id,
      conversation_id,
      count(*) AS msg_count
    FROM support_events
    WHERE workspace_id = p_workspace_id
      AND event_type = 'message_sent'
      AND agent_id IS NOT NULL
      AND (p_date_from IS NULL OR created_at >= p_date_from)
      AND (p_date_to   IS NULL OR created_at <= p_date_to)
      AND (p_agent_id  IS NULL OR agent_id = p_agent_id)
    GROUP BY agent_id, conversation_id
  ),
  agent_resolved AS (
    SELECT
      agent_id,
      conversation_id
    FROM support_events
    WHERE workspace_id = p_workspace_id
      AND event_type = 'ticket_resolved'
      AND agent_id IS NOT NULL
      AND (p_date_from IS NULL OR created_at >= p_date_from)
      AND (p_date_to   IS NULL OR created_at <= p_date_to)
      AND (p_agent_id  IS NULL OR agent_id = p_agent_id)
  ),
  one_touch AS (
    SELECT
      ar.agent_id,
      ar.conversation_id
    FROM agent_resolved ar
    JOIN agent_msgs am ON am.agent_id = ar.agent_id AND am.conversation_id = ar.conversation_id
    WHERE am.msg_count = 1
  ),
  resolved_agg AS (
    SELECT agent_id, count(*) AS resolved_count
    FROM agent_resolved
    GROUP BY agent_id
  ),
  one_touch_agg AS (
    SELECT agent_id, count(*) AS ot_count
    FROM one_touch
    GROUP BY agent_id
  )
  SELECT
    am_agg.agent_id,
    sum(am_agg.msg_count)::bigint                          AS messages_sent,
    coalesce(ra.resolved_count, 0)::bigint                 AS tickets_resolved,
    coalesce(ota.ot_count, 0)::bigint                      AS one_touch_count,
    CASE
      WHEN coalesce(ra.resolved_count, 0) = 0 THEN 0
      ELSE round(coalesce(ota.ot_count, 0)::numeric / ra.resolved_count * 100, 1)
    END                                                     AS one_touch_rate,
    round(avg(am_agg.msg_count), 1)::numeric               AS avg_messages_per_ticket
  FROM agent_msgs am_agg
  LEFT JOIN resolved_agg ra USING (agent_id)
  LEFT JOIN one_touch_agg ota USING (agent_id)
  GROUP BY am_agg.agent_id, ra.resolved_count, ota.ot_count;
$$;


ALTER FUNCTION "public"."get_agent_productivity"("p_workspace_id" "uuid", "p_agent_id" "uuid", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_kpis"("p_workspace_id" "uuid", "p_from" "date", "p_to" "date", "p_store_id" "uuid" DEFAULT NULL::"uuid") RETURNS json
    LANGUAGE "sql" STABLE
    AS $$
  SELECT json_build_object(
    'totalOrders', count(*)::int,
    'cancelledOrders', count(*) filter (where cancel_reason is not null)::int,
    'totalRefunds', count(*) filter (where cancel_reason is null and refund_amount > 0)::int,
    'netRevenue', coalesce(sum(case when cancel_reason is null then subtotal_price - coalesce(refund_amount, 0) else 0 end), 0),
    'discounts', coalesce(sum(case when cancel_reason is null then coalesce(total_discounts, 0) else 0 end), 0),
    'returns', coalesce(sum(case when cancel_reason is null then coalesce(refund_amount, 0) else 0 end), 0)
  )
  FROM shopify_orders
  WHERE workspace_id = p_workspace_id
    AND shopify_order_date(processed_at, created_at_shopify) BETWEEN p_from AND p_to
    AND (p_store_id IS NULL OR store_id = p_store_id);
$$;


ALTER FUNCTION "public"."get_kpis"("p_workspace_id" "uuid", "p_from" "date", "p_to" "date", "p_store_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_refund_reasons"("p_workspace_id" "uuid", "p_agent_id" "uuid" DEFAULT NULL::"uuid", "p_date_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_date_to" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("reason" "text", "count" bigint, "percentage" numeric)
    LANGUAGE "sql" STABLE
    AS $$
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


ALTER FUNCTION "public"."get_refund_reasons"("p_workspace_id" "uuid", "p_agent_id" "uuid", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_resolution_times"("p_workspace_id" "uuid", "p_agent_id" "uuid" DEFAULT NULL::"uuid", "p_date_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_date_to" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("avg_resolution_time_seconds" numeric, "median_resolution_time_seconds" numeric, "total_resolved" bigint)
    LANGUAGE "sql" STABLE
    AS $$
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


ALTER FUNCTION "public"."get_resolution_times"("p_workspace_id" "uuid", "p_agent_id" "uuid", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_response_times"("p_workspace_id" "uuid", "p_agent_id" "uuid" DEFAULT NULL::"uuid", "p_date_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_date_to" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("avg_response_time_seconds" numeric, "median_response_time_seconds" numeric, "total_conversations" bigint)
    LANGUAGE "sql" STABLE
    AS $$
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


ALTER FUNCTION "public"."get_response_times"("p_workspace_id" "uuid", "p_agent_id" "uuid", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_revenue_trend"("p_workspace_id" "uuid", "p_from" "date", "p_to" "date", "p_store_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("date" "date", "revenue" numeric)
    LANGUAGE "sql" STABLE
    AS $$
  WITH daily AS (
    SELECT
      shopify_order_date(processed_at, created_at_shopify) AS d,
      sum(
        CASE WHEN cancel_reason IS NULL
          THEN subtotal_price - coalesce(refund_amount, 0)
          ELSE 0
        END
      ) AS revenue
    FROM shopify_orders
    WHERE workspace_id = p_workspace_id
      AND (p_store_id IS NULL OR store_id = p_store_id)
      AND shopify_order_date(processed_at, created_at_shopify) BETWEEN p_from AND p_to
    GROUP BY d
  )
  SELECT
    gs::date AS date,
    coalesce(daily.revenue, 0) AS revenue
  FROM generate_series(p_from::timestamp, p_to::timestamp, '1 day'::interval) gs
  LEFT JOIN daily ON daily.d = gs::date
  ORDER BY gs::date;
$$;


ALTER FUNCTION "public"."get_revenue_trend"("p_workspace_id" "uuid", "p_from" "date", "p_to" "date", "p_store_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_ticket_volume"("p_workspace_id" "uuid", "p_agent_id" "uuid" DEFAULT NULL::"uuid", "p_date_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_date_to" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("date" "date", "opened_count" bigint, "resolved_count" bigint)
    LANGUAGE "sql" STABLE
    AS $$
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


ALTER FUNCTION "public"."get_ticket_volume"("p_workspace_id" "uuid", "p_agent_id" "uuid", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_email_usage"("p_user_email" "text", "p_month" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO email_usage (user_email, month, count)
  VALUES (p_user_email, p_month, 1)
  ON CONFLICT (user_email, month)
  DO UPDATE SET count = email_usage.count + 1;
END;
$$;


ALTER FUNCTION "public"."increment_email_usage"("p_user_email" "text", "p_month" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_current_user_lynq_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
  select exists (
    select 1 from auth.users
    where id = auth.uid()
      and email in ('info@lynqagency.com')
  );
$$;


ALTER FUNCTION "public"."is_current_user_lynq_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."macro_onboarding_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."macro_onboarding_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."macros_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."macros_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."next_invoice_number"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  current_year int;
  seq_name     text;
  n            bigint;
begin
  current_year := extract(year from now() at time zone 'UTC')::int;
  seq_name     := 'invoice_seq_' || current_year::text;

  -- Create the per-year sequence on first use of a new year.
  if not exists (
    select 1 from pg_class c
    join pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname = 'public'
      and c.relname  = seq_name
      and c.relkind  = 'S'
  ) then
    execute format('create sequence if not exists public.%I start with 1 increment by 1', seq_name);
  end if;

  execute format('select nextval(%L)', 'public.' || seq_name) into n;
  return 'LF-' || current_year::text || '-' || lpad(n::text, 5, '0');
end;
$$;


ALTER FUNCTION "public"."next_invoice_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."provision_workspace"("p_user_id" "uuid", "p_workspace_name" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_workspace_id uuid;
  v_member_id    uuid;
begin
  -- Create workspace (no longer sets subscription_status or trial_ends_at)
  insert into public.workspaces (
    name,
    owner_id
  )
  values (
    p_workspace_name,
    p_user_id
  )
  returning id into v_workspace_id;

  -- Create subscription row — single source of truth for billing state
  insert into public.workspace_subscriptions (
    workspace_id,
    plan_id,
    status,
    trial_ends_at,
    current_period_start,
    current_period_end
  )
  values (
    v_workspace_id,
    'starter',
    'trial',
    now() + interval '7 days',
    now(),
    now() + interval '7 days'
  );

  -- Owner workspace_member
  insert into public.workspace_members (
    workspace_id,
    user_id,
    role
  )
  values (
    v_workspace_id,
    p_user_id,
    'owner'
  )
  returning id into v_member_id;

  -- user_profile (idempotent — UPSERT in case it exists from elsewhere)
  insert into public.user_profiles (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  return jsonb_build_object(
    'workspace_id', v_workspace_id,
    'member_id',    v_member_id
  );
end;
$$;


ALTER FUNCTION "public"."provision_workspace"("p_user_id" "uuid", "p_workspace_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."shopify_order_date"("p" timestamp with time zone, "fallback" timestamp with time zone) RETURNS "date"
    LANGUAGE "sql" IMMUTABLE
    AS $$ SELECT (COALESCE(p, fallback) AT TIME ZONE 'UTC')::date; $$;


ALTER FUNCTION "public"."shopify_order_date"("p" timestamp with time zone, "fallback" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tags_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin new.updated_at := now(); return new; end;
$$;


ALTER FUNCTION "public"."tags_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end $$;


ALTER FUNCTION "public"."touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_is_workspace_owner"("ws_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select exists(
    select 1 from public.workspace_members
    where user_id = auth.uid()
      and workspace_id = ws_id
      and role = 'owner'
  )
$$;


ALTER FUNCTION "public"."user_is_workspace_owner"("ws_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_profiles_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin new.updated_at := now(); return new; end;
$$;


ALTER FUNCTION "public"."user_profiles_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_role_in_workspace"("ws_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select role from public.workspace_members
  where user_id = auth.uid() and workspace_id = ws_id
$$;


ALTER FUNCTION "public"."user_role_in_workspace"("ws_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_workspace_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select workspace_id from public.workspace_members
  where user_id = auth.uid()
$$;


ALTER FUNCTION "public"."user_workspace_ids"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."account_deletion_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "user_email" "text" NOT NULL,
    "event" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "account_deletion_log_event_check" CHECK (("event" = ANY (ARRAY['scheduled'::"text", 'cancelled'::"text", 'deleted'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."account_deletion_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "user_email" "text",
    "full_name" "text",
    "phone" "text",
    "motivation" "text",
    "certified_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "agent_applications_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'reviewing'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."agent_applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_autonomy_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "store_id" "uuid" NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_autonomy_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_drafts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "store_id" "uuid",
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "prompt_path" "text" NOT NULL,
    "suggested_text" "text" NOT NULL,
    "model" "text",
    "prompt_tokens" integer,
    "completion_tokens" integer,
    "total_tokens" integer,
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "intent" "text",
    "confidence" numeric,
    "should_escalate" boolean,
    "escalate_reason" "text",
    CONSTRAINT "ai_drafts_confidence_check" CHECK ((("confidence" >= (0)::numeric) AND ("confidence" <= (1)::numeric))),
    CONSTRAINT "ai_drafts_intent_check" CHECK (("intent" = ANY (ARRAY['wismo'::"text", 'long_delivery'::"text", 'lost_package'::"text", 'wrong_or_damaged'::"text", 'refund_or_cancel'::"text", 'customs_fees'::"text", 'angry_or_chargeback'::"text", 'other'::"text", 'unknown'::"text"]))),
    CONSTRAINT "ai_drafts_prompt_path_check" CHECK (("prompt_path" = ANY (ARRAY['emma'::"text", 'fallback'::"text"])))
);


ALTER TABLE "public"."ai_drafts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_lessons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "store_id" "uuid" NOT NULL,
    "lesson_text" "text" NOT NULL,
    "source_type" "text" NOT NULL,
    "source_ref" "uuid",
    "applies_to_scenario" "text",
    "applies_to_policy" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    CONSTRAINT "ai_lessons_source_type_check" CHECK (("source_type" = ANY (ARRAY['edit'::"text", 'reject'::"text", 'manual'::"text"])))
);


ALTER TABLE "public"."ai_lessons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_policies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "store_id" "uuid" NOT NULL,
    "shipping_policy" "text",
    "refund_policy" "text",
    "customs_policy" "text",
    "tracking_url" "text",
    "can_decide" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "cannot_decide" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "escalate_triggers" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "brand_name" "text",
    "brand_description" "text",
    "tone_of_voice" "text",
    "sign_off" "text",
    "languages" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "website_url" "text"
);


ALTER TABLE "public"."ai_policies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_scenarios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "store_id" "uuid" NOT NULL,
    "scenario_key" "text" NOT NULL,
    "title" "text" NOT NULL,
    "approach" "text",
    "questions_to_ask" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "response_template" "text",
    "escalate_when" "text",
    "autonomy_pct" integer DEFAULT 0 NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_scenarios_autonomy_pct_check" CHECK ((("autonomy_pct" >= 0) AND ("autonomy_pct" <= 100)))
);


ALTER TABLE "public"."ai_scenarios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "system_prompt" "text",
    "brand_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "workspace_id" "uuid" NOT NULL
);


ALTER TABLE "public"."ai_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "route" "text" NOT NULL,
    "model" "text" NOT NULL,
    "input_tokens" integer DEFAULT 0 NOT NULL,
    "output_tokens" integer DEFAULT 0 NOT NULL,
    "cost_usd" numeric(10,8) DEFAULT 0 NOT NULL,
    "user_email" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ai_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analytics_actions" (
    "id" "text" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "picked_up_by" "text",
    "picked_up_at" timestamp with time zone,
    "result_note" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "workspace_id" "uuid" NOT NULL
);


ALTER TABLE "public"."analytics_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."anonymized_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "original_user_id" "uuid" NOT NULL,
    "anonymized_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."anonymized_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."billing_info" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "billing_email" "text" NOT NULL,
    "organization_name" "text" NOT NULL,
    "phone_number" "text",
    "address_line1" "text" NOT NULL,
    "address_line2" "text",
    "city" "text" NOT NULL,
    "postal_code" "text" NOT NULL,
    "country" "text" NOT NULL,
    "state" "text",
    "vat_number" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."billing_info" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."broadcasts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "type" "text" DEFAULT 'update'::"text",
    "author" "text" DEFAULT 'Lynq & Flow'::"text",
    "youtube_url" "text",
    "topic" "text"
);


ALTER TABLE "public"."broadcasts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."certificates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "issued_at" timestamp with time zone DEFAULT "now"(),
    "exam_score" numeric,
    "modules_completed" integer DEFAULT 6
);


ALTER TABLE "public"."certificates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "company_name" "text",
    "email" "text",
    "shopify_domain" "text",
    "shopify_api_key" "text",
    "status" "text" DEFAULT 'active'::"text",
    "parcel_panel_api_key" "text",
    "workspace_id" "uuid" NOT NULL
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversation_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."conversation_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cron_job_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_name" "text" NOT NULL,
    "status" "text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    "duration_ms" integer,
    "summary" "jsonb",
    "error_message" "text",
    "runtime" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cron_job_runs_runtime_check" CHECK (("runtime" = ANY (ARRAY['vercel-cron'::"text", 'edge-function'::"text"]))),
    CONSTRAINT "cron_job_runs_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'success'::"text", 'warning'::"text", 'failure'::"text"])))
);


ALTER TABLE "public"."cron_job_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."custom_email_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "email" "text",
    "imap_host" "text",
    "imap_port" integer DEFAULT 993,
    "smtp_host" "text",
    "smtp_port" integer DEFAULT 587,
    "encrypted_password" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."custom_email_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "real_email" "text",
    "display_name" "text",
    "forwarding_address" "text",
    "connected_at" timestamp with time zone DEFAULT "now"(),
    "workspace_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'connected'::"text" NOT NULL,
    "provider" "text",
    "access_token" "text",
    "refresh_token" "text",
    "encrypted_password" "text",
    "username" "text",
    "expires_at" timestamp with time zone,
    "imap_host" "text",
    "imap_port" integer,
    "smtp_host" "text",
    "smtp_port" integer,
    "is_default" boolean DEFAULT false,
    "last_sync_at" timestamp with time zone,
    "email_address" "text",
    "store_id" "uuid",
    "watch_expiry" timestamp with time zone,
    "domain_verified" boolean DEFAULT false,
    "forwarding_verified" boolean DEFAULT false,
    "resend_domain_id" "text",
    "verification_token" "text",
    "verification_token_expires_at" timestamp with time zone,
    "sender_domain" "text",
    CONSTRAINT "email_accounts_provider_check" CHECK ((("provider" IS NULL) OR ("provider" = ANY (ARRAY['gmail'::"text", 'outlook'::"text", 'imap'::"text", 'custom'::"text", 'forwarding'::"text"])))),
    CONSTRAINT "email_accounts_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'disconnected'::"text", 'error'::"text", 'pending'::"text", 'connected'::"text"])))
);


ALTER TABLE "public"."email_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "subject" "text",
    "customer_email" "text",
    "customer_name" "text",
    "status" "text" DEFAULT 'open'::"text",
    "last_message_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "workspace_id" "uuid" NOT NULL,
    "email_account_id" "uuid",
    "snippet" "text",
    "provider_thread_id" "text",
    "shopify_customer_id" "text",
    "message_count" integer DEFAULT 0,
    "is_unread" boolean DEFAULT true,
    "last_outbound_at" timestamp with time zone,
    "counted_in_usage_period" "uuid",
    "billable_event_at" timestamp with time zone,
    "is_spam" boolean DEFAULT false NOT NULL,
    "reactivated_from" "uuid",
    "store_id" "uuid",
    "assigned_to" "uuid"
);


ALTER TABLE "public"."email_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "from_email" "text",
    "from_name" "text",
    "body_html" "text",
    "body_text" "text",
    "is_outbound" boolean DEFAULT false,
    "message_id" "text",
    "in_reply_to" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "workspace_id" "uuid" NOT NULL,
    "provider_message_id" "text",
    "to_email" "text",
    "to_name" "text",
    "cc" "jsonb" DEFAULT '[]'::"jsonb",
    "bcc" "jsonb" DEFAULT '[]'::"jsonb",
    "subject" "text"
);


ALTER TABLE "public"."email_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_email" "text" NOT NULL,
    "month" "text" NOT NULL,
    "count" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."email_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exam_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "exam_type" "text" NOT NULL,
    "question_order" integer NOT NULL,
    "question_type" "text" NOT NULL,
    "question" "text" NOT NULL,
    "options" "jsonb",
    "correct_answer" "text",
    "grading_rubric" "text",
    "max_points" integer DEFAULT 10 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."exam_questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exam_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "exam_type" "text" NOT NULL,
    "answers" "jsonb" NOT NULL,
    "total_score" numeric(5,2),
    "max_possible_score" integer,
    "percentage" numeric(5,2),
    "passed" boolean DEFAULT false,
    "question_scores" "jsonb" DEFAULT '{}'::"jsonb",
    "attempt_number" integer DEFAULT 1,
    "status" "text" DEFAULT 'graded'::"text",
    "submitted_at" timestamp with time zone DEFAULT "now"(),
    "graded_at" timestamp with time zone
);


ALTER TABLE "public"."exam_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "message" "text" NOT NULL,
    "page_url" "text",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "feedback_submissions_message_check" CHECK ((("char_length"("message") >= 5) AND ("char_length"("message") <= 5000))),
    CONSTRAINT "feedback_submissions_type_check" CHECK (("type" = ANY (ARRAY['bug'::"text", 'feedback'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."feedback_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "threshold_value" numeric,
    "threshold_unit" "text",
    "channel" "text" NOT NULL,
    "channel_target" "text",
    "active" boolean DEFAULT true NOT NULL,
    "last_triggered_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "finance_alerts_channel_check" CHECK (("channel" = ANY (ARRAY['email'::"text", 'slack'::"text", 'both'::"text"]))),
    CONSTRAINT "finance_alerts_type_check" CHECK (("type" = ANY (ARRAY['margin_negative'::"text", 'daily_cap_workspace'::"text", 'hard_cap_anthropic'::"text", 'custom'::"text"])))
);


ALTER TABLE "public"."finance_alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_cost_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source" "text" NOT NULL,
    "external_id" "text",
    "amount_cents" bigint NOT NULL,
    "currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "occurred_at" timestamp with time zone NOT NULL,
    "category" "text" NOT NULL,
    "description" "text",
    "workspace_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "finance_cost_events_category_check" CHECK (("category" = ANY (ARRAY['ai'::"text", 'infra'::"text", 'tools'::"text", 'fees'::"text", 'salary'::"text", 'other'::"text"]))),
    CONSTRAINT "finance_cost_events_source_check" CHECK (("source" = ANY (ARRAY['anthropic'::"text", 'supabase'::"text", 'vercel'::"text", 'lovable'::"text", 'whop_fee'::"text", 'manual'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."finance_cost_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_fixed_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "amount_cents" bigint NOT NULL,
    "currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "billing_day" integer,
    "category" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "finance_fixed_subscriptions_billing_day_check" CHECK ((("billing_day" >= 1) AND ("billing_day" <= 31))),
    CONSTRAINT "finance_fixed_subscriptions_category_check" CHECK (("category" = ANY (ARRAY['ai'::"text", 'infra'::"text", 'tools'::"text", 'fees'::"text", 'salary'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."finance_fixed_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_fx_rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "from_currency" "text" NOT NULL,
    "to_currency" "text" NOT NULL,
    "rate" numeric NOT NULL,
    "fetched_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."finance_fx_rates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_revenue_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source" "text" NOT NULL,
    "external_id" "text",
    "amount_cents" bigint NOT NULL,
    "currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "occurred_at" timestamp with time zone NOT NULL,
    "customer_ref" "text",
    "product" "text",
    "recurring" boolean DEFAULT false NOT NULL,
    "workspace_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "finance_revenue_events_source_check" CHECK (("source" = ANY (ARRAY['whop'::"text", 'stripe'::"text", 'manual'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."finance_revenue_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gmail_tokens" (
    "email" "text" NOT NULL,
    "gmail_address" "text",
    "access_token" "text",
    "refresh_token" "text",
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid" NOT NULL
);


ALTER TABLE "public"."gmail_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."impersonation_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_user_id" "uuid" NOT NULL,
    "target_workspace_id" "uuid" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone
);


ALTER TABLE "public"."impersonation_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "client_id" "uuid",
    "platform" "text",
    "api_key" "text",
    "domain" "text",
    "status" "text" DEFAULT 'connected'::"text",
    "shopify_domain" "text",
    "shopify_access_token" "text",
    "shopify_scope" "text",
    "shopify_connected_at" timestamp with time zone,
    "parcelpanel_api_key" "text",
    "user_id" "uuid",
    "shopify_client_secret" "text",
    "store_currency" "text" DEFAULT 'EUR'::"text",
    "workspace_id" "uuid" NOT NULL,
    "store_id" "uuid",
    "parcelpanel_webhook_token" "text",
    CONSTRAINT "integrations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'connected'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."integrations" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."invoice_seq_2026"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."invoice_seq_2026" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "invoice_number" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "period_start" timestamp with time zone NOT NULL,
    "period_end" timestamp with time zone NOT NULL,
    "subtotal_eur" numeric(10,2) NOT NULL,
    "vat_amount_eur" numeric(10,2) DEFAULT 0 NOT NULL,
    "total_eur" numeric(10,2) NOT NULL,
    "amount_paid_eur" numeric(10,2) DEFAULT 0 NOT NULL,
    "amount_due_eur" numeric(10,2) NOT NULL,
    "description" "text",
    "line_items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "whop_invoice_id" "text",
    "paid_at" timestamp with time zone,
    "pdf_url" "text",
    "billing_email" "text",
    "billing_org_name" "text",
    "billing_address" "jsonb",
    "vat_number" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "invoices_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'open'::"text", 'paid'::"text", 'void'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."macro_onboarding" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "answers" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "completed_at" timestamp with time zone,
    "last_generated_at" timestamp with time zone,
    "generation_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."macro_onboarding" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."macro_tags" (
    "macro_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL
);


ALTER TABLE "public"."macro_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."macros" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "body" "text" DEFAULT ''::"text" NOT NULL,
    "language" "text" DEFAULT 'auto'::"text" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "usage_count" integer DEFAULT 0 NOT NULL,
    "last_used_at" timestamp with time zone,
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "macros_language_check" CHECK (("language" = ANY (ARRAY['auto'::"text", 'en'::"text", 'nl'::"text", 'fr'::"text", 'de'::"text", 'es'::"text", 'it'::"text"])))
);


ALTER TABLE "public"."macros" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."masterclasses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "speaker" "text",
    "scheduled_at" timestamp with time zone NOT NULL,
    "zoom_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."masterclasses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "type" "text" DEFAULT 'info'::"text",
    "read" boolean DEFAULT false
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."oauth_states" (
    "state" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "shop" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "client_id" "text",
    "client_secret" "text",
    "workspace_id" "uuid",
    "store_name" "text"
);


ALTER TABLE "public"."oauth_states" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."outlook_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "email" "text",
    "access_token" "text",
    "refresh_token" "text",
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."outlook_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ownership_transfers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "from_user_id" "uuid" NOT NULL,
    "to_user_id" "uuid" NOT NULL,
    "new_role_for_old_owner" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    "resolved_at" timestamp with time zone,
    CONSTRAINT "ownership_transfers_new_role_for_old_owner_check" CHECK (("new_role_for_old_owner" = ANY (ARRAY['admin'::"text", 'agent'::"text", 'observer'::"text"]))),
    CONSTRAINT "ownership_transfers_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text", 'cancelled'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."ownership_transfers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_methods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "last_four" "text",
    "brand" "text",
    "is_default" boolean DEFAULT false NOT NULL,
    "whop_payment_method_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payment_methods_type_check" CHECK (("type" = ANY (ARRAY['card'::"text", 'sepa'::"text", 'paypal'::"text"])))
);


ALTER TABLE "public"."payment_methods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plans" (
    "id" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "price_eur" numeric(10,2),
    "ticket_limit" integer,
    "ai_suggest_limit" integer,
    "whop_product_id" "text",
    "whop_plan_id" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "is_custom" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "features" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_admins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "platform_admins_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'tester'::"text"])))
);


ALTER TABLE "public"."platform_admins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "user_role" "text" DEFAULT 'client_employee'::"text",
    "is_certified" boolean DEFAULT false,
    "certified_at" timestamp with time zone,
    "full_name" "text",
    "phone" "text",
    "motivation" "text",
    "email" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "exam_status" "text" DEFAULT 'not_started'::"text",
    "exam_type_taken" "text",
    "exam_score" numeric(5,2),
    CONSTRAINT "profiles_user_role_check" CHECK (("user_role" = ANY (ARRAY['client_employee'::"text", 'agent_candidate'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."refunds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "client_id" "uuid",
    "order_id" "text",
    "product_name" "text",
    "reason" "text",
    "amount" numeric,
    "status" "text"
);


ALTER TABLE "public"."refunds" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_inquiries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "client_email" "text",
    "service" "text" NOT NULL,
    "message" "text",
    "status" "text" DEFAULT 'new'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "phone_number" "text",
    CONSTRAINT "service_inquiries_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'read'::"text"])))
);


ALTER TABLE "public"."service_inquiries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shipments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_number" "text",
    "tracking_number" "text",
    "carrier" "text",
    "status" "text",
    "customer_name" "text",
    "estimated_delivery" timestamp with time zone,
    "last_updated" timestamp with time zone,
    "raw_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "client_id" "uuid",
    "workspace_id" "uuid" NOT NULL
);


ALTER TABLE "public"."shipments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shopify_orders" (
    "id" bigint NOT NULL,
    "client_id" "uuid" NOT NULL,
    "order_number" "text",
    "financial_status" "text",
    "cancel_reason" "text",
    "subtotal_price" numeric DEFAULT 0,
    "total_price" numeric DEFAULT 0,
    "total_discounts" numeric DEFAULT 0,
    "refund_amount" numeric DEFAULT 0,
    "customer_email" "text",
    "customer_name" "text",
    "processed_at" timestamp with time zone,
    "created_at_shopify" timestamp with time zone,
    "updated_at_shopify" timestamp with time zone,
    "synced_at" timestamp with time zone DEFAULT "now"(),
    "source_name" "text",
    "presentment_currency" "text",
    "workspace_id" "uuid" NOT NULL,
    "store_id" "uuid"
);


ALTER TABLE "public"."shopify_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."stores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_addons" (
    "id" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'coming_soon'::"text" NOT NULL,
    "price_eur" numeric(10,2),
    "per_unit_price_eur" numeric(10,4),
    "per_unit_label" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "subscription_addons_status_check" CHECK (("status" = ANY (ARRAY['coming_soon'::"text", 'beta'::"text", 'live'::"text"])))
);


ALTER TABLE "public"."subscription_addons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."support_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "source" "text" NOT NULL,
    "agent_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."support_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" DEFAULT 'slate'::"text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "tags_color_check" CHECK (("color" = ANY (ARRAY['slate'::"text", 'red'::"text", 'orange'::"text", 'amber'::"text", 'yellow'::"text", 'lime'::"text", 'green'::"text", 'emerald'::"text", 'teal'::"text", 'cyan'::"text", 'sky'::"text", 'blue'::"text", 'indigo'::"text", 'violet'::"text", 'purple'::"text", 'fuchsia'::"text", 'pink'::"text", 'rose'::"text"])))
);


ALTER TABLE "public"."tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."talent_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "display_code" "text",
    "role" "text" NOT NULL,
    "exam_type" "text",
    "exam_score" numeric(5,2),
    "photo_url" "text",
    "experience_years" integer DEFAULT 0,
    "previous_industries" "jsonb" DEFAULT '[]'::"jsonb",
    "skills" "jsonb" DEFAULT '[]'::"jsonb",
    "languages" "jsonb" DEFAULT '["Dutch", "English"]'::"jsonb",
    "hourly_rate" numeric(8,2),
    "availability" "text" DEFAULT 'full_time'::"text",
    "tools_experience" "jsonb" DEFAULT '[]'::"jsonb",
    "about" "text",
    "visible" boolean DEFAULT false,
    "verified_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."talent_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."talent_purchases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_user_id" "uuid" NOT NULL,
    "talent_profile_id" "uuid" NOT NULL,
    "include_trainer" boolean DEFAULT false,
    "placement_fee" numeric(8,2) NOT NULL,
    "trainer_fee" numeric(8,2) DEFAULT 0,
    "total_amount" numeric(8,2) NOT NULL,
    "payment_status" "text" DEFAULT 'pending'::"text",
    "payment_ref" "text",
    "guarantee_start_at" timestamp with time zone,
    "guarantee_expires_at" timestamp with time zone,
    "guarantee_claimed" boolean DEFAULT false,
    "details_revealed" boolean DEFAULT false,
    "status" "text" DEFAULT 'pending'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."talent_purchases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "category" "text",
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "assigned_to" "uuid",
    "picked_up_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "result_note" "text",
    "shopify_order_id" "text",
    "shopify_order_name" "text",
    "shopify_customer_id" "text",
    "customer_name" "text",
    "customer_email" "text",
    "trigger_type" "text" DEFAULT 'manual'::"text" NOT NULL,
    "trigger_key" "text",
    "created_by" "uuid",
    "refund_count" integer,
    "total_amount" numeric,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tasks_priority_check" CHECK (("priority" = ANY (ARRAY['high'::"text", 'medium'::"text", 'low'::"text"]))),
    CONSTRAINT "tasks_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'picked_up'::"text", 'done'::"text"]))),
    CONSTRAINT "tasks_trigger_type_check" CHECK (("trigger_type" = ANY (ARRAY['manual'::"text", 'pattern'::"text", 'ai_insight'::"text"])))
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_members" (
    "id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" DEFAULT 'developer'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "client_id" "uuid",
    "workspace_id" "uuid" NOT NULL
);


ALTER TABLE "public"."team_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tickets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "client_id" "uuid",
    "ticket_id" "text",
    "subject" "text",
    "status" "text",
    "agent" "text",
    "channel" "text"
);


ALTER TABLE "public"."tickets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."time_session_edits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "edited_by_user_id" "uuid" NOT NULL,
    "edited_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reason" "text" NOT NULL,
    "before_json" "jsonb" NOT NULL,
    "after_json" "jsonb" NOT NULL,
    CONSTRAINT "time_session_edits_reason_check" CHECK (("char_length"(TRIM(BOTH FROM "reason")) >= 3))
);


ALTER TABLE "public"."time_session_edits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."time_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "clocked_in_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "clocked_out_at" timestamp with time zone,
    "active_seconds" integer DEFAULT 0 NOT NULL,
    "idle_seconds" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "eod_report" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "paused_seconds" integer DEFAULT 0 NOT NULL,
    "paused_at" timestamp with time zone,
    "client_id" "uuid",
    "workspace_id" "uuid" NOT NULL,
    "emails_answered" integer,
    "what_went_well" "text",
    "needs_attention" "text",
    CONSTRAINT "time_sessions_emails_answered_check" CHECK ((("emails_answered" IS NULL) OR ("emails_answered" >= 0)))
);


ALTER TABLE "public"."time_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."usage_counters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "period_start" timestamp with time zone NOT NULL,
    "period_end" timestamp with time zone NOT NULL,
    "tickets_used" integer DEFAULT 0 NOT NULL,
    "ai_suggest_used" integer DEFAULT 0 NOT NULL,
    "ai_resolutions_used" integer DEFAULT 0 NOT NULL,
    "tickets_overage" integer DEFAULT 0 NOT NULL,
    "ai_suggest_overage" integer DEFAULT 0 NOT NULL,
    "notified_80_at" timestamp with time zone,
    "notified_100_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."usage_counters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_api_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "anthropic_api_key" "text",
    "tavily_api_key" "text",
    "gemini_api_key" "text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_api_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "user_id" "uuid" NOT NULL,
    "display_name" "text",
    "bio" "text",
    "avatar_url" "text",
    "theme" "text" DEFAULT 'system'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "welcome_dismissed_at" timestamp with time zone,
    "setup_checklist_dismissed_at" timestamp with time zone,
    "recovery_codes" "text"[] DEFAULT '{}'::"text"[],
    "mfa_enabled_at" timestamp with time zone,
    "consent_level" "text",
    "consented_at" timestamp with time zone,
    "scheduled_for_deletion_at" timestamp with time zone,
    CONSTRAINT "user_profiles_consent_level_check" CHECK (("consent_level" = ANY (ARRAY['essential'::"text", 'all'::"text"]))),
    CONSTRAINT "user_profiles_theme_check" CHECK (("theme" = ANY (ARRAY['system'::"text", 'dark'::"text", 'light'::"text"])))
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."user_profiles"."scheduled_for_deletion_at" IS 'Non-null = account scheduled for deletion. Cron executes when this timestamp is in the past.';



CREATE TABLE IF NOT EXISTS "public"."webhook_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "text" NOT NULL,
    "source" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "status" "text" DEFAULT 'processing'::"text" NOT NULL,
    "error_message" "text",
    "processing_duration_ms" integer,
    "attempt_count" integer DEFAULT 1 NOT NULL,
    "next_retry_at" timestamp with time zone,
    "workspace_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "metadata" "jsonb",
    CONSTRAINT "chk_webhook_event_source" CHECK (("source" = ANY (ARRAY['shopify'::"text", 'whop'::"text", 'email'::"text", 'parcelpanel'::"text"]))),
    CONSTRAINT "chk_webhook_event_status" CHECK (("status" = ANY (ARRAY['processing'::"text", 'completed'::"text", 'failed'::"text", 'dead_letter'::"text", 'dismissed'::"text"])))
);


ALTER TABLE "public"."webhook_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspace_addons" (
    "workspace_id" "uuid" NOT NULL,
    "addon_id" "text" NOT NULL,
    "status" "text" DEFAULT 'inactive'::"text" NOT NULL,
    "activated_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "workspace_addons_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'pending'::"text"])))
);


ALTER TABLE "public"."workspace_addons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspace_deletion_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "workspace_name" "text",
    "owner_email" "text",
    "event" "text" NOT NULL,
    "trial_ends_at" timestamp with time zone,
    "scheduled_for_deletion_at" timestamp with time zone,
    "details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "workspace_deletion_log_event_check" CHECK (("event" = ANY (ARRAY['scheduled'::"text", 'deleted'::"text", 'cancelled'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."workspace_deletion_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspace_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" DEFAULT 'agent'::"text" NOT NULL,
    "token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(32), 'hex'::"text") NOT NULL,
    "invited_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    "accepted_at" timestamp with time zone,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "workspace_invites_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'agent'::"text", 'observer'::"text"])))
);


ALTER TABLE "public"."workspace_invites" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."workspace_invite_details" AS
 SELECT "wi"."id",
    "wi"."workspace_id",
    "wi"."email",
    "wi"."role",
    "wi"."token",
    "wi"."invited_by",
    "wi"."created_at",
    "wi"."sent_at",
    "wi"."expires_at",
    "wi"."accepted_at",
    "inviter"."email" AS "inviter_email",
    COALESCE(("inviter"."raw_user_meta_data" ->> 'name'::"text"), "split_part"(("inviter"."email")::"text", '@'::"text", 1)) AS "inviter_name"
   FROM ("public"."workspace_invites" "wi"
     LEFT JOIN "auth"."users" "inviter" ON (("inviter"."id" = "wi"."invited_by")));


ALTER VIEW "public"."workspace_invite_details" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspace_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'agent'::"text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "workspace_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'agent'::"text", 'observer'::"text"])))
);


ALTER TABLE "public"."workspace_members" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."workspace_member_details" AS
 SELECT "wm"."id",
    "wm"."workspace_id",
    "wm"."user_id",
    "wm"."role",
    "wm"."joined_at",
    "u"."email",
    COALESCE(("u"."raw_user_meta_data" ->> 'name'::"text"), "split_part"(("u"."email")::"text", '@'::"text", 1)) AS "display_name",
    ("u"."raw_user_meta_data" ->> 'avatar_url'::"text") AS "avatar_url",
    (("u"."raw_user_meta_data" ->> 'two_factor_enabled'::"text"))::boolean AS "two_factor_enabled"
   FROM ("public"."workspace_members" "wm"
     JOIN "auth"."users" "u" ON (("u"."id" = "wm"."user_id")));


ALTER VIEW "public"."workspace_member_details" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspace_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "plan_id" "text" NOT NULL,
    "status" "text" DEFAULT 'trial'::"text" NOT NULL,
    "trial_ends_at" timestamp with time zone,
    "current_period_start" timestamp with time zone DEFAULT "now"() NOT NULL,
    "current_period_end" timestamp with time zone NOT NULL,
    "canceled_at" timestamp with time zone,
    "cancel_at_period_end" boolean DEFAULT false NOT NULL,
    "whop_subscription_id" "text",
    "whop_customer_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "write_locked" boolean DEFAULT false NOT NULL,
    CONSTRAINT "workspace_subscriptions_status_check" CHECK (("status" = ANY (ARRAY['trial'::"text", 'active'::"text", 'past_due'::"text", 'canceled'::"text", 'paused'::"text"])))
);


ALTER TABLE "public"."workspace_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspaces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "demo_data_removed_at" timestamp with time zone,
    "scheduled_for_deletion_at" timestamp with time zone,
    "slug" "text",
    "logo_url" "text",
    "timezone" "text" DEFAULT 'Europe/Amsterdam'::"text" NOT NULL,
    "locale" "text" DEFAULT 'en'::"text" NOT NULL,
    "date_format" "text" DEFAULT 'DD/MM/YYYY'::"text" NOT NULL,
    "time_format" "text" DEFAULT '24h'::"text" NOT NULL,
    "first_day_of_week" "text" DEFAULT 'Monday'::"text" NOT NULL,
    "show_order_data" boolean DEFAULT true NOT NULL,
    "auto_translate" boolean DEFAULT false NOT NULL,
    "allow_deletion" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_tasks_generated_at" timestamp with time zone,
    "suspended_at" timestamp with time zone,
    "suspension_reason" "text"
);


ALTER TABLE "public"."workspaces" OWNER TO "postgres";


COMMENT ON COLUMN "public"."workspaces"."suspended_at" IS 'Non-null = workspace suspended. Used for read-only enforcement + 7-day sync grace period.';



COMMENT ON COLUMN "public"."workspaces"."suspension_reason" IS 'Optional admin-provided reason shown in banner/email. Cleared on unsuspend.';



ALTER TABLE ONLY "public"."account_deletion_log"
    ADD CONSTRAINT "account_deletion_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_applications"
    ADD CONSTRAINT "agent_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_autonomy_rules"
    ADD CONSTRAINT "ai_autonomy_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_autonomy_rules"
    ADD CONSTRAINT "ai_autonomy_rules_store_id_key" UNIQUE ("store_id");



ALTER TABLE ONLY "public"."ai_drafts"
    ADD CONSTRAINT "ai_drafts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_lessons"
    ADD CONSTRAINT "ai_lessons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_policies"
    ADD CONSTRAINT "ai_policies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_policies"
    ADD CONSTRAINT "ai_policies_store_id_key" UNIQUE ("store_id");



ALTER TABLE ONLY "public"."ai_scenarios"
    ADD CONSTRAINT "ai_scenarios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_scenarios"
    ADD CONSTRAINT "ai_scenarios_store_id_scenario_key_key" UNIQUE ("store_id", "scenario_key");



ALTER TABLE ONLY "public"."ai_settings"
    ADD CONSTRAINT "ai_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_settings"
    ADD CONSTRAINT "ai_settings_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."ai_settings"
    ADD CONSTRAINT "ai_settings_user_id_unique" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."ai_usage"
    ADD CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."analytics_actions"
    ADD CONSTRAINT "analytics_actions_pkey" PRIMARY KEY ("id", "client_id");



ALTER TABLE ONLY "public"."anonymized_members"
    ADD CONSTRAINT "anonymized_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_info"
    ADD CONSTRAINT "billing_info_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_info"
    ADD CONSTRAINT "billing_info_workspace_id_key" UNIQUE ("workspace_id");



ALTER TABLE ONLY "public"."broadcasts"
    ADD CONSTRAINT "broadcasts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."certificates"
    ADD CONSTRAINT "certificates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."certificates"
    ADD CONSTRAINT "certificates_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversation_notes"
    ADD CONSTRAINT "conversation_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cron_job_runs"
    ADD CONSTRAINT "cron_job_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custom_email_tokens"
    ADD CONSTRAINT "custom_email_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custom_email_tokens"
    ADD CONSTRAINT "custom_email_tokens_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."email_accounts"
    ADD CONSTRAINT "email_accounts_forwarding_address_key" UNIQUE ("forwarding_address");



ALTER TABLE ONLY "public"."email_accounts"
    ADD CONSTRAINT "email_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_conversations"
    ADD CONSTRAINT "email_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_messages"
    ADD CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_usage"
    ADD CONSTRAINT "email_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_usage"
    ADD CONSTRAINT "email_usage_user_email_month_key" UNIQUE ("user_email", "month");



ALTER TABLE ONLY "public"."exam_questions"
    ADD CONSTRAINT "exam_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exam_submissions"
    ADD CONSTRAINT "exam_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback_submissions"
    ADD CONSTRAINT "feedback_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_alerts"
    ADD CONSTRAINT "finance_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_cost_events"
    ADD CONSTRAINT "finance_cost_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_cost_events"
    ADD CONSTRAINT "finance_cost_events_source_external_id_key" UNIQUE ("source", "external_id");



ALTER TABLE ONLY "public"."finance_fixed_subscriptions"
    ADD CONSTRAINT "finance_fixed_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_fx_rates"
    ADD CONSTRAINT "finance_fx_rates_from_currency_to_currency_fetched_at_key" UNIQUE ("from_currency", "to_currency", "fetched_at");



ALTER TABLE ONLY "public"."finance_fx_rates"
    ADD CONSTRAINT "finance_fx_rates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_revenue_events"
    ADD CONSTRAINT "finance_revenue_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_revenue_events"
    ADD CONSTRAINT "finance_revenue_events_source_external_id_key" UNIQUE ("source", "external_id");



ALTER TABLE ONLY "public"."gmail_tokens"
    ADD CONSTRAINT "gmail_tokens_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."impersonation_sessions"
    ADD CONSTRAINT "impersonation_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integrations"
    ADD CONSTRAINT "integrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_invoice_number_key" UNIQUE ("invoice_number");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."macro_onboarding"
    ADD CONSTRAINT "macro_onboarding_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."macro_onboarding"
    ADD CONSTRAINT "macro_onboarding_workspace_id_key" UNIQUE ("workspace_id");



ALTER TABLE ONLY "public"."macro_tags"
    ADD CONSTRAINT "macro_tags_pkey" PRIMARY KEY ("macro_id", "tag_id");



ALTER TABLE ONLY "public"."macros"
    ADD CONSTRAINT "macros_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."masterclasses"
    ADD CONSTRAINT "masterclasses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."oauth_states"
    ADD CONSTRAINT "oauth_states_pkey" PRIMARY KEY ("state");



ALTER TABLE ONLY "public"."outlook_tokens"
    ADD CONSTRAINT "outlook_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."outlook_tokens"
    ADD CONSTRAINT "outlook_tokens_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."ownership_transfers"
    ADD CONSTRAINT "ownership_transfers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_methods"
    ADD CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plans"
    ADD CONSTRAINT "plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_admins"
    ADD CONSTRAINT "platform_admins_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."platform_admins"
    ADD CONSTRAINT "platform_admins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."refunds"
    ADD CONSTRAINT "refunds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_inquiries"
    ADD CONSTRAINT "service_inquiries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shipments"
    ADD CONSTRAINT "shipments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shopify_orders"
    ADD CONSTRAINT "shopify_orders_pkey" PRIMARY KEY ("id", "client_id");



ALTER TABLE ONLY "public"."shopify_orders"
    ADD CONSTRAINT "shopify_orders_workspace_id_id_key" UNIQUE ("workspace_id", "id");



ALTER TABLE ONLY "public"."stores"
    ADD CONSTRAINT "stores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_addons"
    ADD CONSTRAINT "subscription_addons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."support_events"
    ADD CONSTRAINT "support_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."talent_profiles"
    ADD CONSTRAINT "talent_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."talent_profiles"
    ADD CONSTRAINT "talent_profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."talent_purchases"
    ADD CONSTRAINT "talent_purchases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."time_session_edits"
    ADD CONSTRAINT "time_session_edits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."time_sessions"
    ADD CONSTRAINT "time_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integrations"
    ADD CONSTRAINT "uq_integrations_workspace_store" UNIQUE ("workspace_id", "store_id");



ALTER TABLE ONLY "public"."stores"
    ADD CONSTRAINT "uq_stores_workspace_name" UNIQUE ("workspace_id", "name");



ALTER TABLE ONLY "public"."webhook_events"
    ADD CONSTRAINT "uq_webhook_event" UNIQUE ("source", "event_id");



ALTER TABLE ONLY "public"."usage_counters"
    ADD CONSTRAINT "usage_counters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usage_counters"
    ADD CONSTRAINT "usage_counters_workspace_id_period_start_key" UNIQUE ("workspace_id", "period_start");



ALTER TABLE ONLY "public"."user_api_keys"
    ADD CONSTRAINT "user_api_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_api_keys"
    ADD CONSTRAINT "user_api_keys_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."webhook_events"
    ADD CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspace_addons"
    ADD CONSTRAINT "workspace_addons_pkey" PRIMARY KEY ("workspace_id", "addon_id");



ALTER TABLE ONLY "public"."workspace_deletion_log"
    ADD CONSTRAINT "workspace_deletion_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspace_invites"
    ADD CONSTRAINT "workspace_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspace_invites"
    ADD CONSTRAINT "workspace_invites_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_workspace_id_user_id_key" UNIQUE ("workspace_id", "user_id");



ALTER TABLE ONLY "public"."workspace_subscriptions"
    ADD CONSTRAINT "workspace_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspace_subscriptions"
    ADD CONSTRAINT "workspace_subscriptions_workspace_id_key" UNIQUE ("workspace_id");



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id");



CREATE INDEX "ai_settings_workspace_id_idx" ON "public"."ai_settings" USING "btree" ("workspace_id");



CREATE INDEX "analytics_actions_workspace_id_idx" ON "public"."analytics_actions" USING "btree" ("workspace_id");



CREATE INDEX "clients_workspace_id_idx" ON "public"."clients" USING "btree" ("workspace_id");



CREATE INDEX "email_accounts_workspace_id_idx" ON "public"."email_accounts" USING "btree" ("workspace_id");



CREATE INDEX "email_conversations_workspace_id_idx" ON "public"."email_conversations" USING "btree" ("workspace_id");



CREATE INDEX "email_messages_workspace_id_idx" ON "public"."email_messages" USING "btree" ("workspace_id");



CREATE INDEX "idx_ai_autonomy_rules_store" ON "public"."ai_autonomy_rules" USING "btree" ("store_id");



CREATE INDEX "idx_ai_autonomy_rules_workspace" ON "public"."ai_autonomy_rules" USING "btree" ("workspace_id");



CREATE INDEX "idx_ai_drafts_conversation" ON "public"."ai_drafts" USING "btree" ("conversation_id", "generated_at" DESC);



CREATE INDEX "idx_ai_drafts_workspace" ON "public"."ai_drafts" USING "btree" ("workspace_id", "generated_at" DESC);



CREATE INDEX "idx_ai_lessons_store" ON "public"."ai_lessons" USING "btree" ("store_id");



CREATE INDEX "idx_ai_lessons_workspace" ON "public"."ai_lessons" USING "btree" ("workspace_id");



CREATE INDEX "idx_ai_policies_store" ON "public"."ai_policies" USING "btree" ("store_id");



CREATE INDEX "idx_ai_policies_workspace" ON "public"."ai_policies" USING "btree" ("workspace_id");



CREATE INDEX "idx_ai_scenarios_store" ON "public"."ai_scenarios" USING "btree" ("store_id");



CREATE INDEX "idx_ai_scenarios_workspace" ON "public"."ai_scenarios" USING "btree" ("workspace_id");



CREATE INDEX "idx_conversation_notes_conversation" ON "public"."conversation_notes" USING "btree" ("conversation_id", "created_at");



CREATE INDEX "idx_cron_job_runs_job_name" ON "public"."cron_job_runs" USING "btree" ("job_name");



CREATE INDEX "idx_cron_job_runs_started_at" ON "public"."cron_job_runs" USING "btree" ("started_at" DESC);



CREATE INDEX "idx_cron_job_runs_status" ON "public"."cron_job_runs" USING "btree" ("status");



CREATE UNIQUE INDEX "idx_email_accounts_forwarding_address" ON "public"."email_accounts" USING "btree" ("forwarding_address") WHERE ("forwarding_address" IS NOT NULL);



CREATE INDEX "idx_email_accounts_store_id" ON "public"."email_accounts" USING "btree" ("store_id");



CREATE UNIQUE INDEX "idx_email_accounts_workspace_provider_email" ON "public"."email_accounts" USING "btree" ("workspace_id", "provider", "email_address");



CREATE INDEX "idx_email_conversations_assigned_to" ON "public"."email_conversations" USING "btree" ("workspace_id", "assigned_to");



CREATE INDEX "idx_email_conversations_counted_period" ON "public"."email_conversations" USING "btree" ("counted_in_usage_period") WHERE ("counted_in_usage_period" IS NOT NULL);



CREATE INDEX "idx_email_conversations_customer_email" ON "public"."email_conversations" USING "btree" ("customer_email");



CREATE INDEX "idx_email_conversations_provider_thread" ON "public"."email_conversations" USING "btree" ("provider_thread_id");



CREATE INDEX "idx_email_conversations_reactivation_lookup" ON "public"."email_conversations" USING "btree" ("workspace_id", "customer_email", "last_outbound_at" DESC) WHERE ("status" = 'closed'::"text");



CREATE INDEX "idx_email_conversations_store_id" ON "public"."email_conversations" USING "btree" ("store_id");



CREATE INDEX "idx_email_conversations_workspace_last_message" ON "public"."email_conversations" USING "btree" ("workspace_id", "last_message_at" DESC);



CREATE INDEX "idx_email_conversations_workspace_status" ON "public"."email_conversations" USING "btree" ("workspace_id", "status");



CREATE INDEX "idx_email_messages_conversation_created" ON "public"."email_messages" USING "btree" ("conversation_id", "created_at");



CREATE UNIQUE INDEX "idx_email_messages_provider_message_id" ON "public"."email_messages" USING "btree" ("provider_message_id") WHERE ("provider_message_id" IS NOT NULL);



CREATE INDEX "idx_feedback_created_at" ON "public"."feedback_submissions" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_feedback_workspace_created" ON "public"."feedback_submissions" USING "btree" ("workspace_id", "created_at" DESC);



CREATE INDEX "idx_finance_cost_category" ON "public"."finance_cost_events" USING "btree" ("category");



CREATE INDEX "idx_finance_cost_occurred_at" ON "public"."finance_cost_events" USING "btree" ("occurred_at" DESC);



CREATE INDEX "idx_finance_cost_workspace" ON "public"."finance_cost_events" USING "btree" ("workspace_id");



CREATE INDEX "idx_finance_revenue_occurred_at" ON "public"."finance_revenue_events" USING "btree" ("occurred_at" DESC);



CREATE INDEX "idx_finance_revenue_source" ON "public"."finance_revenue_events" USING "btree" ("source");



CREATE INDEX "idx_finance_revenue_workspace" ON "public"."finance_revenue_events" USING "btree" ("workspace_id");



CREATE INDEX "idx_impersonation_sessions_active" ON "public"."impersonation_sessions" USING "btree" ("admin_user_id") WHERE ("ended_at" IS NULL);



CREATE INDEX "idx_impersonation_sessions_admin" ON "public"."impersonation_sessions" USING "btree" ("admin_user_id");



CREATE INDEX "idx_integrations_store_id" ON "public"."integrations" USING "btree" ("store_id");



CREATE INDEX "idx_invoices_status" ON "public"."invoices" USING "btree" ("status") WHERE ("status" = ANY (ARRAY['open'::"text", 'failed'::"text"]));



CREATE INDEX "idx_invoices_workspace_created_at" ON "public"."invoices" USING "btree" ("workspace_id", "created_at" DESC);



CREATE UNIQUE INDEX "idx_ownership_transfers_pending_unique" ON "public"."ownership_transfers" USING "btree" ("workspace_id") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_ownership_transfers_to_user" ON "public"."ownership_transfers" USING "btree" ("to_user_id");



CREATE INDEX "idx_ownership_transfers_workspace" ON "public"."ownership_transfers" USING "btree" ("workspace_id");



CREATE INDEX "idx_payment_methods_workspace_default" ON "public"."payment_methods" USING "btree" ("workspace_id", "is_default" DESC);



CREATE INDEX "idx_shopify_orders_store" ON "public"."shopify_orders" USING "btree" ("store_id");



CREATE INDEX "idx_shopify_orders_store_id" ON "public"."shopify_orders" USING "btree" ("store_id");



CREATE INDEX "idx_shopify_orders_workspace_date" ON "public"."shopify_orders" USING "btree" ("workspace_id", "public"."shopify_order_date"("processed_at", "created_at_shopify"));



CREATE INDEX "idx_shopify_orders_workspace_processed" ON "public"."shopify_orders" USING "btree" ("workspace_id", "processed_at" DESC);



CREATE INDEX "idx_shopify_orders_workspace_store_date" ON "public"."shopify_orders" USING "btree" ("workspace_id", "store_id", "public"."shopify_order_date"("processed_at", "created_at_shopify"));



CREATE INDEX "idx_stores_workspace_id" ON "public"."stores" USING "btree" ("workspace_id");



CREATE INDEX "idx_support_events_workspace_agent" ON "public"."support_events" USING "btree" ("workspace_id", "agent_id", "event_type", "created_at");



CREATE INDEX "idx_support_events_workspace_conversation" ON "public"."support_events" USING "btree" ("workspace_id", "conversation_id", "event_type");



CREATE INDEX "idx_support_events_workspace_type_date" ON "public"."support_events" USING "btree" ("workspace_id", "event_type", "created_at");



CREATE INDEX "idx_tasks_status" ON "public"."tasks" USING "btree" ("workspace_id", "status") WHERE ("deleted_at" IS NULL);



CREATE UNIQUE INDEX "idx_tasks_trigger_key" ON "public"."tasks" USING "btree" ("workspace_id", "trigger_key") WHERE ("trigger_key" IS NOT NULL);



CREATE INDEX "idx_tasks_workspace" ON "public"."tasks" USING "btree" ("workspace_id");



CREATE INDEX "idx_time_sessions_agent" ON "public"."time_sessions" USING "btree" ("agent_id");



CREATE INDEX "idx_time_sessions_clocked_in" ON "public"."time_sessions" USING "btree" ("clocked_in_at" DESC);



CREATE INDEX "idx_usage_counters_workspace_period_end" ON "public"."usage_counters" USING "btree" ("workspace_id", "period_end" DESC);



CREATE INDEX "idx_user_profiles_deletion" ON "public"."user_profiles" USING "btree" ("scheduled_for_deletion_at") WHERE ("scheduled_for_deletion_at" IS NOT NULL);



CREATE INDEX "idx_webhook_events_created_at" ON "public"."webhook_events" USING "btree" ("created_at");



CREATE INDEX "idx_webhook_events_retry" ON "public"."webhook_events" USING "btree" ("status", "next_retry_at") WHERE ("status" <> ALL (ARRAY['completed'::"text", 'dismissed'::"text"]));



CREATE INDEX "idx_webhook_events_source_type" ON "public"."webhook_events" USING "btree" ("source", "event_type");



CREATE INDEX "idx_webhook_events_status" ON "public"."webhook_events" USING "btree" ("status") WHERE ("status" <> ALL (ARRAY['completed'::"text", 'dismissed'::"text"]));



CREATE INDEX "idx_webhook_events_workspace" ON "public"."webhook_events" USING "btree" ("workspace_id") WHERE ("workspace_id" IS NOT NULL);



CREATE INDEX "idx_workspace_addons_active" ON "public"."workspace_addons" USING "btree" ("workspace_id", "status") WHERE ("status" = 'active'::"text");



CREATE INDEX "idx_workspace_deletion_log_created_at" ON "public"."workspace_deletion_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_workspace_deletion_log_event" ON "public"."workspace_deletion_log" USING "btree" ("event", "created_at" DESC);



CREATE INDEX "idx_workspace_deletion_log_workspace_id" ON "public"."workspace_deletion_log" USING "btree" ("workspace_id");



CREATE INDEX "idx_workspace_subscriptions_period_end" ON "public"."workspace_subscriptions" USING "btree" ("current_period_end") WHERE ("status" = ANY (ARRAY['active'::"text", 'past_due'::"text"]));



CREATE INDEX "idx_workspace_subscriptions_status" ON "public"."workspace_subscriptions" USING "btree" ("status");



CREATE INDEX "idx_workspace_subscriptions_trial_ends_at" ON "public"."workspace_subscriptions" USING "btree" ("trial_ends_at") WHERE ("status" = 'trial'::"text");



CREATE INDEX "idx_workspaces_suspended_at" ON "public"."workspaces" USING "btree" ("suspended_at") WHERE ("suspended_at" IS NOT NULL);



CREATE INDEX "integrations_workspace_id_idx" ON "public"."integrations" USING "btree" ("workspace_id");



CREATE INDEX "macro_tags_macro_idx" ON "public"."macro_tags" USING "btree" ("macro_id");



CREATE INDEX "macro_tags_tag_idx" ON "public"."macro_tags" USING "btree" ("tag_id");



CREATE INDEX "macros_ws_archived_idx" ON "public"."macros" USING "btree" ("workspace_id", "archived_at");



CREATE INDEX "macros_ws_idx" ON "public"."macros" USING "btree" ("workspace_id");



CREATE INDEX "macros_ws_name_idx" ON "public"."macros" USING "btree" ("workspace_id", "lower"("name"));



CREATE INDEX "shipments_client_id_idx" ON "public"."shipments" USING "btree" ("client_id");



CREATE INDEX "shipments_workspace_id_idx" ON "public"."shipments" USING "btree" ("workspace_id");



CREATE INDEX "shopify_orders_client_id_processed_at_idx" ON "public"."shopify_orders" USING "btree" ("client_id", "processed_at");



CREATE INDEX "shopify_orders_workspace_id_idx" ON "public"."shopify_orders" USING "btree" ("workspace_id");



CREATE INDEX "tags_ws_idx" ON "public"."tags" USING "btree" ("workspace_id");



CREATE UNIQUE INDEX "tags_ws_name_lower_uniq" ON "public"."tags" USING "btree" ("workspace_id", "lower"("name"));



CREATE INDEX "team_members_client_id_idx" ON "public"."team_members" USING "btree" ("client_id");



CREATE INDEX "team_members_workspace_id_idx" ON "public"."team_members" USING "btree" ("workspace_id");



CREATE INDEX "time_session_edits_session_edited_idx" ON "public"."time_session_edits" USING "btree" ("session_id", "edited_at" DESC);



CREATE INDEX "time_sessions_client_id_idx" ON "public"."time_sessions" USING "btree" ("client_id");



CREATE INDEX "time_sessions_workspace_id_idx" ON "public"."time_sessions" USING "btree" ("workspace_id");



CREATE UNIQUE INDEX "uq_integrations_parcelpanel_webhook_token" ON "public"."integrations" USING "btree" ("parcelpanel_webhook_token") WHERE ("parcelpanel_webhook_token" IS NOT NULL);



CREATE UNIQUE INDEX "uq_shipments_workspace_tracking" ON "public"."shipments" USING "btree" ("workspace_id", "tracking_number");



CREATE UNIQUE INDEX "workspace_invites_active_unique" ON "public"."workspace_invites" USING "btree" ("workspace_id", "email") WHERE ("accepted_at" IS NULL);



CREATE INDEX "workspace_invites_email_idx" ON "public"."workspace_invites" USING "btree" ("email");



CREATE INDEX "workspace_invites_token_idx" ON "public"."workspace_invites" USING "btree" ("token");



CREATE INDEX "workspace_members_user_id_idx" ON "public"."workspace_members" USING "btree" ("user_id");



CREATE INDEX "workspace_members_ws_id_idx" ON "public"."workspace_members" USING "btree" ("workspace_id");



CREATE INDEX "workspace_members_ws_joined_id_idx" ON "public"."workspace_members" USING "btree" ("workspace_id", "joined_at", "id");



CREATE INDEX "workspace_members_ws_role_idx" ON "public"."workspace_members" USING "btree" ("workspace_id", "role");



CREATE INDEX "workspace_subscriptions_write_locked_idx" ON "public"."workspace_subscriptions" USING "btree" ("workspace_id") WHERE ("write_locked" = true);



CREATE UNIQUE INDEX "workspaces_slug_idx" ON "public"."workspaces" USING "btree" ("slug") WHERE ("slug" IS NOT NULL);



CREATE OR REPLACE TRIGGER "ai_autonomy_rules_set_updated_at" BEFORE UPDATE ON "public"."ai_autonomy_rules" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "ai_policies_set_updated_at" BEFORE UPDATE ON "public"."ai_policies" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "ai_scenarios_set_updated_at" BEFORE UPDATE ON "public"."ai_scenarios" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "billing_info_set_updated_at" BEFORE UPDATE ON "public"."billing_info" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "invoices_set_updated_at" BEFORE UPDATE ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "macro_onboarding_updated_at" BEFORE UPDATE ON "public"."macro_onboarding" FOR EACH ROW EXECUTE FUNCTION "public"."macro_onboarding_set_updated_at"();



CREATE OR REPLACE TRIGGER "macros_updated_at" BEFORE UPDATE ON "public"."macros" FOR EACH ROW EXECUTE FUNCTION "public"."macros_set_updated_at"();



CREATE OR REPLACE TRIGGER "payment_methods_set_updated_at" BEFORE UPDATE ON "public"."payment_methods" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "plans_set_updated_at" BEFORE UPDATE ON "public"."plans" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "subscription_addons_set_updated_at" BEFORE UPDATE ON "public"."subscription_addons" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "tags_updated_at" BEFORE UPDATE ON "public"."tags" FOR EACH ROW EXECUTE FUNCTION "public"."tags_set_updated_at"();



CREATE OR REPLACE TRIGGER "tasks_set_updated_at" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_touch_finance_subs" BEFORE UPDATE ON "public"."finance_fixed_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "usage_counters_set_updated_at" BEFORE UPDATE ON "public"."usage_counters" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "user_profiles_updated_at" BEFORE UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."user_profiles_set_updated_at"();



CREATE OR REPLACE TRIGGER "workspace_addons_set_updated_at" BEFORE UPDATE ON "public"."workspace_addons" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "workspace_subscriptions_set_updated_at" BEFORE UPDATE ON "public"."workspace_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "workspaces_set_updated_at" BEFORE UPDATE ON "public"."workspaces" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."agent_applications"
    ADD CONSTRAINT "agent_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."ai_autonomy_rules"
    ADD CONSTRAINT "ai_autonomy_rules_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_autonomy_rules"
    ADD CONSTRAINT "ai_autonomy_rules_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_drafts"
    ADD CONSTRAINT "ai_drafts_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."email_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_drafts"
    ADD CONSTRAINT "ai_drafts_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_drafts"
    ADD CONSTRAINT "ai_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_drafts"
    ADD CONSTRAINT "ai_drafts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_lessons"
    ADD CONSTRAINT "ai_lessons_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_lessons"
    ADD CONSTRAINT "ai_lessons_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_lessons"
    ADD CONSTRAINT "ai_lessons_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_policies"
    ADD CONSTRAINT "ai_policies_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_policies"
    ADD CONSTRAINT "ai_policies_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_scenarios"
    ADD CONSTRAINT "ai_scenarios_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_scenarios"
    ADD CONSTRAINT "ai_scenarios_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_settings"
    ADD CONSTRAINT "ai_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_settings"
    ADD CONSTRAINT "ai_settings_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."analytics_actions"
    ADD CONSTRAINT "analytics_actions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."anonymized_members"
    ADD CONSTRAINT "anonymized_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."billing_info"
    ADD CONSTRAINT "billing_info_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."certificates"
    ADD CONSTRAINT "certificates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_notes"
    ADD CONSTRAINT "conversation_notes_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."email_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custom_email_tokens"
    ADD CONSTRAINT "custom_email_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_accounts"
    ADD CONSTRAINT "email_accounts_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_accounts"
    ADD CONSTRAINT "email_accounts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_conversations"
    ADD CONSTRAINT "email_conversations_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."workspace_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."email_conversations"
    ADD CONSTRAINT "email_conversations_counted_in_usage_period_fkey" FOREIGN KEY ("counted_in_usage_period") REFERENCES "public"."usage_counters"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."email_conversations"
    ADD CONSTRAINT "email_conversations_email_account_id_fkey" FOREIGN KEY ("email_account_id") REFERENCES "public"."email_accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_conversations"
    ADD CONSTRAINT "email_conversations_reactivated_from_fkey" FOREIGN KEY ("reactivated_from") REFERENCES "public"."email_conversations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."email_conversations"
    ADD CONSTRAINT "email_conversations_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."email_conversations"
    ADD CONSTRAINT "email_conversations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_messages"
    ADD CONSTRAINT "email_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."email_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_messages"
    ADD CONSTRAINT "email_messages_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feedback_submissions"
    ADD CONSTRAINT "feedback_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feedback_submissions"
    ADD CONSTRAINT "feedback_submissions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."finance_cost_events"
    ADD CONSTRAINT "finance_cost_events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."finance_revenue_events"
    ADD CONSTRAINT "finance_revenue_events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."impersonation_sessions"
    ADD CONSTRAINT "impersonation_sessions_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."impersonation_sessions"
    ADD CONSTRAINT "impersonation_sessions_target_workspace_id_fkey" FOREIGN KEY ("target_workspace_id") REFERENCES "public"."workspaces"("id");



ALTER TABLE ONLY "public"."integrations"
    ADD CONSTRAINT "integrations_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integrations"
    ADD CONSTRAINT "integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integrations"
    ADD CONSTRAINT "integrations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."macro_onboarding"
    ADD CONSTRAINT "macro_onboarding_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."macro_onboarding"
    ADD CONSTRAINT "macro_onboarding_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."macro_tags"
    ADD CONSTRAINT "macro_tags_macro_id_fkey" FOREIGN KEY ("macro_id") REFERENCES "public"."macros"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."macro_tags"
    ADD CONSTRAINT "macro_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."macros"
    ADD CONSTRAINT "macros_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."macros"
    ADD CONSTRAINT "macros_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."outlook_tokens"
    ADD CONSTRAINT "outlook_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ownership_transfers"
    ADD CONSTRAINT "ownership_transfers_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ownership_transfers"
    ADD CONSTRAINT "ownership_transfers_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ownership_transfers"
    ADD CONSTRAINT "ownership_transfers_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_methods"
    ADD CONSTRAINT "payment_methods_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."refunds"
    ADD CONSTRAINT "refunds_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shipments"
    ADD CONSTRAINT "shipments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."shipments"
    ADD CONSTRAINT "shipments_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shopify_orders"
    ADD CONSTRAINT "shopify_orders_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."shopify_orders"
    ADD CONSTRAINT "shopify_orders_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stores"
    ADD CONSTRAINT "stores_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."support_events"
    ADD CONSTRAINT "support_events_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."workspace_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."support_events"
    ADD CONSTRAINT "support_events_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."email_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."support_events"
    ADD CONSTRAINT "support_events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."workspace_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."workspace_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_session_edits"
    ADD CONSTRAINT "time_session_edits_edited_by_user_id_fkey" FOREIGN KEY ("edited_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."time_session_edits"
    ADD CONSTRAINT "time_session_edits_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."time_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_sessions"
    ADD CONSTRAINT "time_sessions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_sessions"
    ADD CONSTRAINT "time_sessions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."time_sessions"
    ADD CONSTRAINT "time_sessions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."usage_counters"
    ADD CONSTRAINT "usage_counters_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_api_keys"
    ADD CONSTRAINT "user_api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."webhook_events"
    ADD CONSTRAINT "webhook_events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id");



ALTER TABLE ONLY "public"."workspace_addons"
    ADD CONSTRAINT "workspace_addons_addon_id_fkey" FOREIGN KEY ("addon_id") REFERENCES "public"."subscription_addons"("id");



ALTER TABLE ONLY "public"."workspace_addons"
    ADD CONSTRAINT "workspace_addons_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_invites"
    ADD CONSTRAINT "workspace_invites_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."workspace_invites"
    ADD CONSTRAINT "workspace_invites_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_subscriptions"
    ADD CONSTRAINT "workspace_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id");



ALTER TABLE ONLY "public"."workspace_subscriptions"
    ADD CONSTRAINT "workspace_subscriptions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



CREATE POLICY "Authenticated read questions" ON "public"."exam_questions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read cron_job_runs" ON "public"."cron_job_runs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Members can view transfers in their workspace" ON "public"."ownership_transfers" FOR SELECT USING (("workspace_id" IN ( SELECT "workspace_members"."workspace_id"
   FROM "public"."workspace_members"
  WHERE ("workspace_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Service role can manage tokens" ON "public"."gmail_tokens" USING (true);



CREATE POLICY "Service role full access" ON "public"."ai_usage" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access" ON "public"."email_usage" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access" ON "public"."exam_questions" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access" ON "public"."exam_submissions" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access" ON "public"."talent_profiles" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access" ON "public"."talent_purchases" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role has full access to ownership_transfers" ON "public"."ownership_transfers" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Super-admin read-only" ON "public"."account_deletion_log" FOR SELECT USING ("public"."is_current_user_lynq_admin"());



CREATE POLICY "Super-admin read-only" ON "public"."anonymized_members" FOR SELECT USING ("public"."is_current_user_lynq_admin"());



CREATE POLICY "Users can insert own application" ON "public"."agent_applications" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can manage own custom email" ON "public"."custom_email_tokens" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own outlook token" ON "public"."outlook_tokens" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own tokens" ON "public"."gmail_tokens" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own application" ON "public"."agent_applications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users manage own api keys" ON "public"."user_api_keys" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users see own certificate" ON "public"."certificates" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users see own submissions" ON "public"."exam_submissions" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."account_deletion_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_all" ON "public"."service_inquiries" USING ((("auth"."jwt"() ->> 'email'::"text") = 'info@lynqagency.com'::"text"));



CREATE POLICY "admin_all_alerts" ON "public"."finance_alerts" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "auth"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ((("u"."raw_user_meta_data" ->> 'is_admin'::"text"))::boolean = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "auth"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ((("u"."raw_user_meta_data" ->> 'is_admin'::"text"))::boolean = true)))));



CREATE POLICY "admin_all_costs" ON "public"."finance_cost_events" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "auth"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ((("u"."raw_user_meta_data" ->> 'is_admin'::"text"))::boolean = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "auth"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ((("u"."raw_user_meta_data" ->> 'is_admin'::"text"))::boolean = true)))));



CREATE POLICY "admin_all_revenue" ON "public"."finance_revenue_events" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "auth"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ((("u"."raw_user_meta_data" ->> 'is_admin'::"text"))::boolean = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "auth"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ((("u"."raw_user_meta_data" ->> 'is_admin'::"text"))::boolean = true)))));



CREATE POLICY "admin_all_subs" ON "public"."finance_fixed_subscriptions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "auth"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ((("u"."raw_user_meta_data" ->> 'is_admin'::"text"))::boolean = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "auth"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ((("u"."raw_user_meta_data" ->> 'is_admin'::"text"))::boolean = true)))));



CREATE POLICY "admin_read_fx" ON "public"."finance_fx_rates" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "auth"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ((("u"."raw_user_meta_data" ->> 'is_admin'::"text"))::boolean = true)))));



ALTER TABLE "public"."agent_applications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_autonomy_rules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_autonomy_rules_delete" ON "public"."ai_autonomy_rules" FOR DELETE USING (("workspace_id" IN ( SELECT "workspace_members"."workspace_id"
   FROM "public"."workspace_members"
  WHERE ("workspace_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "ai_autonomy_rules_insert" ON "public"."ai_autonomy_rules" FOR INSERT WITH CHECK (("workspace_id" IN ( SELECT "workspace_members"."workspace_id"
   FROM "public"."workspace_members"
  WHERE ("workspace_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "ai_autonomy_rules_select" ON "public"."ai_autonomy_rules" FOR SELECT USING (("workspace_id" IN ( SELECT "workspace_members"."workspace_id"
   FROM "public"."workspace_members"
  WHERE ("workspace_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "ai_autonomy_rules_update" ON "public"."ai_autonomy_rules" FOR UPDATE USING (("workspace_id" IN ( SELECT "workspace_members"."workspace_id"
   FROM "public"."workspace_members"
  WHERE ("workspace_members"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."ai_drafts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_drafts_insert" ON "public"."ai_drafts" FOR INSERT WITH CHECK (("workspace_id" IN ( SELECT "workspace_members"."workspace_id"
   FROM "public"."workspace_members"
  WHERE ("workspace_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "ai_drafts_select" ON "public"."ai_drafts" FOR SELECT USING (("workspace_id" IN ( SELECT "workspace_members"."workspace_id"
   FROM "public"."workspace_members"
  WHERE ("workspace_members"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."ai_lessons" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_lessons_insert" ON "public"."ai_lessons" FOR INSERT WITH CHECK (("workspace_id" IN ( SELECT "workspace_members"."workspace_id"
   FROM "public"."workspace_members"
  WHERE ("workspace_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "ai_lessons_select" ON "public"."ai_lessons" FOR SELECT USING (("workspace_id" IN ( SELECT "workspace_members"."workspace_id"
   FROM "public"."workspace_members"
  WHERE ("workspace_members"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."ai_policies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_policies_delete" ON "public"."ai_policies" FOR DELETE USING (("workspace_id" IN ( SELECT "workspace_members"."workspace_id"
   FROM "public"."workspace_members"
  WHERE ("workspace_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "ai_policies_insert" ON "public"."ai_policies" FOR INSERT WITH CHECK (("workspace_id" IN ( SELECT "workspace_members"."workspace_id"
   FROM "public"."workspace_members"
  WHERE ("workspace_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "ai_policies_select" ON "public"."ai_policies" FOR SELECT USING (("workspace_id" IN ( SELECT "workspace_members"."workspace_id"
   FROM "public"."workspace_members"
  WHERE ("workspace_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "ai_policies_update" ON "public"."ai_policies" FOR UPDATE USING (("workspace_id" IN ( SELECT "workspace_members"."workspace_id"
   FROM "public"."workspace_members"
  WHERE ("workspace_members"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."ai_scenarios" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_scenarios_delete" ON "public"."ai_scenarios" FOR DELETE USING (("workspace_id" IN ( SELECT "workspace_members"."workspace_id"
   FROM "public"."workspace_members"
  WHERE ("workspace_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "ai_scenarios_insert" ON "public"."ai_scenarios" FOR INSERT WITH CHECK (("workspace_id" IN ( SELECT "workspace_members"."workspace_id"
   FROM "public"."workspace_members"
  WHERE ("workspace_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "ai_scenarios_select" ON "public"."ai_scenarios" FOR SELECT USING (("workspace_id" IN ( SELECT "workspace_members"."workspace_id"
   FROM "public"."workspace_members"
  WHERE ("workspace_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "ai_scenarios_update" ON "public"."ai_scenarios" FOR UPDATE USING (("workspace_id" IN ( SELECT "workspace_members"."workspace_id"
   FROM "public"."workspace_members"
  WHERE ("workspace_members"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."ai_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_settings_delete_workspace_members" ON "public"."ai_settings" FOR DELETE USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "ai_settings_insert_workspace_members" ON "public"."ai_settings" FOR INSERT WITH CHECK (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "ai_settings_select_workspace_members" ON "public"."ai_settings" FOR SELECT USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "ai_settings_update_workspace_members" ON "public"."ai_settings" FOR UPDATE USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids"))) WITH CHECK (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



ALTER TABLE "public"."ai_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."analytics_actions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "analytics_actions_delete_workspace_members" ON "public"."analytics_actions" FOR DELETE USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "analytics_actions_insert_workspace_members" ON "public"."analytics_actions" FOR INSERT WITH CHECK (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "analytics_actions_select_workspace_members" ON "public"."analytics_actions" FOR SELECT USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "analytics_actions_update_workspace_members" ON "public"."analytics_actions" FOR UPDATE USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids"))) WITH CHECK (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



ALTER TABLE "public"."anonymized_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."billing_info" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "billing_info_delete_workspace_members" ON "public"."billing_info" FOR DELETE USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "billing_info_insert_workspace_members" ON "public"."billing_info" FOR INSERT WITH CHECK (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "billing_info_select_workspace_members" ON "public"."billing_info" FOR SELECT USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "billing_info_super_admin_select" ON "public"."billing_info" FOR SELECT TO "authenticated" USING ("public"."is_current_user_lynq_admin"());



CREATE POLICY "billing_info_update_workspace_members" ON "public"."billing_info" FOR UPDATE USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids"))) WITH CHECK (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



ALTER TABLE "public"."broadcasts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "broadcasts_admin_all" ON "public"."broadcasts" TO "authenticated" USING ((("auth"."jwt"() ->> 'email'::"text") = 'info@lynqagency.com'::"text")) WITH CHECK ((("auth"."jwt"() ->> 'email'::"text") = 'info@lynqagency.com'::"text"));



CREATE POLICY "broadcasts_select_all_authenticated" ON "public"."broadcasts" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."certificates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clients_delete_workspace_members" ON "public"."clients" FOR DELETE USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "clients_insert" ON "public"."service_inquiries" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "clients_insert_workspace_members" ON "public"."clients" FOR INSERT WITH CHECK (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "clients_read_own" ON "public"."service_inquiries" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "clients_select_workspace_members" ON "public"."clients" FOR SELECT USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "clients_update_workspace_members" ON "public"."clients" FOR UPDATE USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids"))) WITH CHECK (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



ALTER TABLE "public"."conversation_notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conversation_notes_insert_workspace_members" ON "public"."conversation_notes" FOR INSERT WITH CHECK (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "conversation_notes_select_workspace_members" ON "public"."conversation_notes" FOR SELECT USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



ALTER TABLE "public"."cron_job_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."custom_email_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "email_accounts_delete_workspace_members" ON "public"."email_accounts" FOR DELETE USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "email_accounts_insert_workspace_members" ON "public"."email_accounts" FOR INSERT WITH CHECK (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "email_accounts_select_workspace_members" ON "public"."email_accounts" FOR SELECT USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "email_accounts_update_workspace_members" ON "public"."email_accounts" FOR UPDATE USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids"))) WITH CHECK (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



ALTER TABLE "public"."email_conversations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "email_conversations_delete_workspace_members" ON "public"."email_conversations" FOR DELETE USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "email_conversations_insert_workspace_members" ON "public"."email_conversations" FOR INSERT WITH CHECK (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "email_conversations_select_workspace_members" ON "public"."email_conversations" FOR SELECT USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "email_conversations_update_workspace_members" ON "public"."email_conversations" FOR UPDATE USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids"))) WITH CHECK (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



ALTER TABLE "public"."email_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "email_messages_delete_workspace_members" ON "public"."email_messages" FOR DELETE USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "email_messages_insert_workspace_members" ON "public"."email_messages" FOR INSERT WITH CHECK (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "email_messages_select_workspace_members" ON "public"."email_messages" FOR SELECT USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "email_messages_update_workspace_members" ON "public"."email_messages" FOR UPDATE USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids"))) WITH CHECK (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



ALTER TABLE "public"."email_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exam_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exam_submissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "feedback_admin_delete" ON "public"."feedback_submissions" FOR DELETE TO "authenticated" USING ("public"."is_current_user_lynq_admin"());



CREATE POLICY "feedback_admin_select" ON "public"."feedback_submissions" FOR SELECT TO "authenticated" USING ("public"."is_current_user_lynq_admin"());



CREATE POLICY "feedback_admin_update" ON "public"."feedback_submissions" FOR UPDATE TO "authenticated" USING ("public"."is_current_user_lynq_admin"()) WITH CHECK ("public"."is_current_user_lynq_admin"());



CREATE POLICY "feedback_insert_own_in_workspace" ON "public"."feedback_submissions" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."workspace_members"
  WHERE (("workspace_members"."workspace_id" = "feedback_submissions"."workspace_id") AND ("workspace_members"."user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."feedback_submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_alerts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_cost_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_fixed_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_fx_rates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_revenue_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gmail_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."impersonation_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."integrations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "integrations_delete_workspace_members" ON "public"."integrations" FOR DELETE USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "integrations_insert_workspace_members" ON "public"."integrations" FOR INSERT WITH CHECK (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "integrations_select_workspace_members" ON "public"."integrations" FOR SELECT USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "integrations_update_workspace_members" ON "public"."integrations" FOR UPDATE USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids"))) WITH CHECK (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoices_delete_workspace_members" ON "public"."invoices" FOR DELETE USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "invoices_insert_workspace_members" ON "public"."invoices" FOR INSERT WITH CHECK (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "invoices_select_workspace_members" ON "public"."invoices" FOR SELECT USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "invoices_super_admin_select" ON "public"."invoices" FOR SELECT TO "authenticated" USING ("public"."is_current_user_lynq_admin"());



CREATE POLICY "invoices_update_workspace_members" ON "public"."invoices" FOR UPDATE USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids"))) WITH CHECK (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



ALTER TABLE "public"."macro_onboarding" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "macro_onboarding_delete_workspace_members" ON "public"."macro_onboarding" FOR DELETE USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "macro_onboarding_insert_workspace_members" ON "public"."macro_onboarding" FOR INSERT WITH CHECK (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "macro_onboarding_select_workspace_members" ON "public"."macro_onboarding" FOR SELECT USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "macro_onboarding_update_workspace_members" ON "public"."macro_onboarding" FOR UPDATE USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids"))) WITH CHECK (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



ALTER TABLE "public"."macro_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."macros" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "macros_delete_workspace_members" ON "public"."macros" FOR DELETE USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "macros_insert_workspace_members" ON "public"."macros" FOR INSERT WITH CHECK (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "macros_select_workspace_members" ON "public"."macros" FOR SELECT USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "macros_update_workspace_members" ON "public"."macros" FOR UPDATE USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids"))) WITH CHECK (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



ALTER TABLE "public"."masterclasses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_admin_all" ON "public"."notifications" TO "authenticated" USING ((("auth"."jwt"() ->> 'email'::"text") = 'info@lynqagency.com'::"text")) WITH CHECK ((("auth"."jwt"() ->> 'email'::"text") = 'info@lynqagency.com'::"text"));



CREATE POLICY "notifications_select_all_authenticated" ON "public"."notifications" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."oauth_states" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."outlook_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ownership_transfers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_methods" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_methods_delete_workspace_members" ON "public"."payment_methods" FOR DELETE USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "payment_methods_insert_workspace_members" ON "public"."payment_methods" FOR INSERT WITH CHECK (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "payment_methods_select_workspace_members" ON "public"."payment_methods" FOR SELECT USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "payment_methods_super_admin_select" ON "public"."payment_methods" FOR SELECT TO "authenticated" USING ("public"."is_current_user_lynq_admin"());



CREATE POLICY "payment_methods_update_workspace_members" ON "public"."payment_methods" FOR UPDATE USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids"))) WITH CHECK (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



ALTER TABLE "public"."plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "plans_select_authenticated" ON "public"."plans" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "read" ON "public"."masterclasses" FOR SELECT USING (true);



ALTER TABLE "public"."refunds" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "refunds eigen data" ON "public"."refunds" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."email" = ("auth"."jwt"() ->> 'email'::"text")))));



CREATE POLICY "service role can insert support events" ON "public"."support_events" FOR INSERT WITH CHECK (true);



ALTER TABLE "public"."service_inquiries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shipments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "shipments_delete_workspace_members" ON "public"."shipments" FOR DELETE USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "shipments_insert_workspace_members" ON "public"."shipments" FOR INSERT WITH CHECK (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "shipments_select_workspace_members" ON "public"."shipments" FOR SELECT USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "shipments_update_workspace_members" ON "public"."shipments" FOR UPDATE USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids"))) WITH CHECK (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



ALTER TABLE "public"."shopify_orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "shopify_orders_delete_workspace_members" ON "public"."shopify_orders" FOR DELETE USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "shopify_orders_insert_workspace_members" ON "public"."shopify_orders" FOR INSERT WITH CHECK (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "shopify_orders_select_workspace_members" ON "public"."shopify_orders" FOR SELECT USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "shopify_orders_update_workspace_members" ON "public"."shopify_orders" FOR UPDATE USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids"))) WITH CHECK (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



ALTER TABLE "public"."stores" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stores_workspace_read" ON "public"."stores" FOR SELECT USING (("workspace_id" IN ( SELECT "workspace_members"."workspace_id"
   FROM "public"."workspace_members"
  WHERE ("workspace_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "stores_workspace_write" ON "public"."stores" USING (("workspace_id" IN ( SELECT "workspace_members"."workspace_id"
   FROM "public"."workspace_members"
  WHERE (("workspace_members"."user_id" = "auth"."uid"()) AND ("workspace_members"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



ALTER TABLE "public"."subscription_addons" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subscription_addons_select_authenticated" ON "public"."subscription_addons" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."support_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tags_delete_workspace_members" ON "public"."tags" FOR DELETE USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "tags_insert_workspace_members" ON "public"."tags" FOR INSERT WITH CHECK (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "tags_select_workspace_members" ON "public"."tags" FOR SELECT USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "tags_update_workspace_members" ON "public"."tags" FOR UPDATE USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids"))) WITH CHECK (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



ALTER TABLE "public"."talent_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."talent_purchases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tasks_insert" ON "public"."tasks" FOR INSERT WITH CHECK (("workspace_id" IN ( SELECT "workspace_members"."workspace_id"
   FROM "public"."workspace_members"
  WHERE ("workspace_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "tasks_select" ON "public"."tasks" FOR SELECT USING (("workspace_id" IN ( SELECT "workspace_members"."workspace_id"
   FROM "public"."workspace_members"
  WHERE ("workspace_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "tasks_update" ON "public"."tasks" FOR UPDATE USING (("workspace_id" IN ( SELECT "workspace_members"."workspace_id"
   FROM "public"."workspace_members"
  WHERE ("workspace_members"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."team_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "team_members_delete_workspace_members" ON "public"."team_members" FOR DELETE USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "team_members_insert_workspace_members" ON "public"."team_members" FOR INSERT WITH CHECK (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "team_members_select_workspace_members" ON "public"."team_members" FOR SELECT USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "team_members_update_workspace_members" ON "public"."team_members" FOR UPDATE USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids"))) WITH CHECK (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



ALTER TABLE "public"."tickets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tickets eigen data" ON "public"."tickets" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."email" = ("auth"."jwt"() ->> 'email'::"text")))));



ALTER TABLE "public"."time_session_edits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "time_session_edits_insert_admin" ON "public"."time_session_edits" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."time_sessions" "ts"
     JOIN "public"."workspace_members" "wm" ON (("wm"."workspace_id" = "ts"."workspace_id")))
  WHERE (("ts"."id" = "time_session_edits"."session_id") AND ("wm"."user_id" = "auth"."uid"()) AND ("wm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "time_session_edits_select_admin_or_self" ON "public"."time_session_edits" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."time_sessions" "ts"
  WHERE (("ts"."id" = "time_session_edits"."session_id") AND (("ts"."agent_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."workspace_members" "wm"
          WHERE (("wm"."workspace_id" = "ts"."workspace_id") AND ("wm"."user_id" = "auth"."uid"()) AND ("wm"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))))))));



ALTER TABLE "public"."time_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "time_sessions_delete_workspace_members" ON "public"."time_sessions" FOR DELETE USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "time_sessions_insert_workspace_members" ON "public"."time_sessions" FOR INSERT WITH CHECK (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "time_sessions_select_workspace_members" ON "public"."time_sessions" FOR SELECT USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "time_sessions_update_workspace_members" ON "public"."time_sessions" FOR UPDATE USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids"))) WITH CHECK (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



ALTER TABLE "public"."usage_counters" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "usage_counters_delete_workspace_members" ON "public"."usage_counters" FOR DELETE USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "usage_counters_insert_workspace_members" ON "public"."usage_counters" FOR INSERT WITH CHECK (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "usage_counters_select_workspace_members" ON "public"."usage_counters" FOR SELECT USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "usage_counters_super_admin_select" ON "public"."usage_counters" FOR SELECT TO "authenticated" USING ("public"."is_current_user_lynq_admin"());



CREATE POLICY "usage_counters_update_workspace_members" ON "public"."usage_counters" FOR UPDATE USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids"))) WITH CHECK (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



ALTER TABLE "public"."user_api_keys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."webhook_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "webhook_events_super_admin_select" ON "public"."webhook_events" FOR SELECT TO "authenticated" USING ("public"."is_current_user_lynq_admin"());



CREATE POLICY "workspace members can read support events" ON "public"."support_events" FOR SELECT USING (("workspace_id" IN ( SELECT "workspace_members"."workspace_id"
   FROM "public"."workspace_members"
  WHERE ("workspace_members"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."workspace_addons" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "workspace_addons_delete_workspace_members" ON "public"."workspace_addons" FOR DELETE USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "workspace_addons_insert_workspace_members" ON "public"."workspace_addons" FOR INSERT WITH CHECK (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "workspace_addons_select_workspace_members" ON "public"."workspace_addons" FOR SELECT USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "workspace_addons_super_admin_select" ON "public"."workspace_addons" FOR SELECT TO "authenticated" USING ("public"."is_current_user_lynq_admin"());



CREATE POLICY "workspace_addons_update_workspace_members" ON "public"."workspace_addons" FOR UPDATE USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids"))) WITH CHECK (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



ALTER TABLE "public"."workspace_deletion_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "workspace_deletion_log_super_admin_select" ON "public"."workspace_deletion_log" FOR SELECT TO "authenticated" USING ("public"."is_current_user_lynq_admin"());



ALTER TABLE "public"."workspace_invites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "workspace_invites_delete_owner_admin" ON "public"."workspace_invites" FOR DELETE USING (("public"."user_role_in_workspace"("workspace_id") = ANY (ARRAY['owner'::"text", 'admin'::"text"])));



CREATE POLICY "workspace_invites_insert_owner_admin" ON "public"."workspace_invites" FOR INSERT WITH CHECK (("public"."user_role_in_workspace"("workspace_id") = ANY (ARRAY['owner'::"text", 'admin'::"text"])));



CREATE POLICY "workspace_invites_select_same_workspace" ON "public"."workspace_invites" FOR SELECT USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "workspace_invites_update_owner_admin" ON "public"."workspace_invites" FOR UPDATE USING (("public"."user_role_in_workspace"("workspace_id") = ANY (ARRAY['owner'::"text", 'admin'::"text"]))) WITH CHECK (("public"."user_role_in_workspace"("workspace_id") = ANY (ARRAY['owner'::"text", 'admin'::"text"])));



ALTER TABLE "public"."workspace_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "workspace_members_delete_owner_admin" ON "public"."workspace_members" FOR DELETE USING (("public"."user_role_in_workspace"("workspace_id") = ANY (ARRAY['owner'::"text", 'admin'::"text"])));



CREATE POLICY "workspace_members_insert_owner_admin" ON "public"."workspace_members" FOR INSERT WITH CHECK (("public"."user_role_in_workspace"("workspace_id") = ANY (ARRAY['owner'::"text", 'admin'::"text"])));



CREATE POLICY "workspace_members_select_same_workspace" ON "public"."workspace_members" FOR SELECT USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "workspace_members_update_owner_admin" ON "public"."workspace_members" FOR UPDATE USING (("public"."user_role_in_workspace"("workspace_id") = ANY (ARRAY['owner'::"text", 'admin'::"text"]))) WITH CHECK (("public"."user_role_in_workspace"("workspace_id") = ANY (ARRAY['owner'::"text", 'admin'::"text"])));



ALTER TABLE "public"."workspace_subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "workspace_subscriptions_delete_workspace_members" ON "public"."workspace_subscriptions" FOR DELETE USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "workspace_subscriptions_insert_workspace_members" ON "public"."workspace_subscriptions" FOR INSERT WITH CHECK (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "workspace_subscriptions_select_workspace_members" ON "public"."workspace_subscriptions" FOR SELECT USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "workspace_subscriptions_super_admin_select" ON "public"."workspace_subscriptions" FOR SELECT TO "authenticated" USING ("public"."is_current_user_lynq_admin"());



CREATE POLICY "workspace_subscriptions_update_workspace_members" ON "public"."workspace_subscriptions" FOR UPDATE USING (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids"))) WITH CHECK (("workspace_id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



ALTER TABLE "public"."workspaces" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "workspaces_delete_owner_only" ON "public"."workspaces" FOR DELETE USING ("public"."user_is_workspace_owner"("id"));



CREATE POLICY "workspaces_insert_authenticated" ON "public"."workspaces" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "workspaces_select_members" ON "public"."workspaces" FOR SELECT USING (("id" IN ( SELECT "public"."user_workspace_ids"() AS "user_workspace_ids")));



CREATE POLICY "workspaces_update_owner_only" ON "public"."workspaces" FOR UPDATE USING ("public"."user_is_workspace_owner"("id")) WITH CHECK ("public"."user_is_workspace_owner"("id"));



CREATE POLICY "write" ON "public"."masterclasses" USING (true);



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."accept_ownership_transfer"("p_transfer_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_ownership_transfer"("p_transfer_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_ownership_transfer"("p_transfer_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."accept_workspace_invite"("p_token" "text", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_workspace_invite"("p_token" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_workspace_invite"("p_token" "text", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."anonymize_workspace_member"("p_user_id" "uuid", "p_workspace_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."anonymize_workspace_member"("p_user_id" "uuid", "p_workspace_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."anonymize_workspace_member"("p_user_id" "uuid", "p_workspace_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."finance_monthly_trend"("months_back" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."finance_monthly_trend"("months_back" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."finance_monthly_trend"("months_back" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."finance_summary"("period_start" timestamp with time zone, "period_end" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."finance_summary"("period_start" timestamp with time zone, "period_end" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."finance_summary"("period_start" timestamp with time zone, "period_end" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."finance_to_eur"("amount_cents" bigint, "from_currency" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."finance_to_eur"("amount_cents" bigint, "from_currency" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."finance_to_eur"("amount_cents" bigint, "from_currency" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."finance_workspace_profitability"("period_start" timestamp with time zone, "period_end" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."finance_workspace_profitability"("period_start" timestamp with time zone, "period_end" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."finance_workspace_profitability"("period_start" timestamp with time zone, "period_end" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_agent_productivity"("p_workspace_id" "uuid", "p_agent_id" "uuid", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_agent_productivity"("p_workspace_id" "uuid", "p_agent_id" "uuid", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_agent_productivity"("p_workspace_id" "uuid", "p_agent_id" "uuid", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_kpis"("p_workspace_id" "uuid", "p_from" "date", "p_to" "date", "p_store_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_kpis"("p_workspace_id" "uuid", "p_from" "date", "p_to" "date", "p_store_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_kpis"("p_workspace_id" "uuid", "p_from" "date", "p_to" "date", "p_store_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_refund_reasons"("p_workspace_id" "uuid", "p_agent_id" "uuid", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_refund_reasons"("p_workspace_id" "uuid", "p_agent_id" "uuid", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_refund_reasons"("p_workspace_id" "uuid", "p_agent_id" "uuid", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_resolution_times"("p_workspace_id" "uuid", "p_agent_id" "uuid", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_resolution_times"("p_workspace_id" "uuid", "p_agent_id" "uuid", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_resolution_times"("p_workspace_id" "uuid", "p_agent_id" "uuid", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_response_times"("p_workspace_id" "uuid", "p_agent_id" "uuid", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_response_times"("p_workspace_id" "uuid", "p_agent_id" "uuid", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_response_times"("p_workspace_id" "uuid", "p_agent_id" "uuid", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_revenue_trend"("p_workspace_id" "uuid", "p_from" "date", "p_to" "date", "p_store_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_revenue_trend"("p_workspace_id" "uuid", "p_from" "date", "p_to" "date", "p_store_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_revenue_trend"("p_workspace_id" "uuid", "p_from" "date", "p_to" "date", "p_store_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_ticket_volume"("p_workspace_id" "uuid", "p_agent_id" "uuid", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_ticket_volume"("p_workspace_id" "uuid", "p_agent_id" "uuid", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_ticket_volume"("p_workspace_id" "uuid", "p_agent_id" "uuid", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_email_usage"("p_user_email" "text", "p_month" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_email_usage"("p_user_email" "text", "p_month" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_email_usage"("p_user_email" "text", "p_month" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_current_user_lynq_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_current_user_lynq_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_current_user_lynq_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."macro_onboarding_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."macro_onboarding_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."macro_onboarding_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."macros_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."macros_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."macros_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."next_invoice_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."next_invoice_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."next_invoice_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."provision_workspace"("p_user_id" "uuid", "p_workspace_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."provision_workspace"("p_user_id" "uuid", "p_workspace_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."provision_workspace"("p_user_id" "uuid", "p_workspace_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."shopify_order_date"("p" timestamp with time zone, "fallback" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."shopify_order_date"("p" timestamp with time zone, "fallback" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."shopify_order_date"("p" timestamp with time zone, "fallback" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."tags_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."tags_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tags_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."user_is_workspace_owner"("ws_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_is_workspace_owner"("ws_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_is_workspace_owner"("ws_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_profiles_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."user_profiles_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_profiles_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."user_role_in_workspace"("ws_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_role_in_workspace"("ws_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_role_in_workspace"("ws_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_workspace_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."user_workspace_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_workspace_ids"() TO "service_role";



GRANT ALL ON TABLE "public"."account_deletion_log" TO "anon";
GRANT ALL ON TABLE "public"."account_deletion_log" TO "authenticated";
GRANT ALL ON TABLE "public"."account_deletion_log" TO "service_role";



GRANT ALL ON TABLE "public"."agent_applications" TO "anon";
GRANT ALL ON TABLE "public"."agent_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_applications" TO "service_role";



GRANT ALL ON TABLE "public"."ai_autonomy_rules" TO "anon";
GRANT ALL ON TABLE "public"."ai_autonomy_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_autonomy_rules" TO "service_role";



GRANT ALL ON TABLE "public"."ai_drafts" TO "anon";
GRANT ALL ON TABLE "public"."ai_drafts" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_drafts" TO "service_role";



GRANT ALL ON TABLE "public"."ai_lessons" TO "anon";
GRANT ALL ON TABLE "public"."ai_lessons" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_lessons" TO "service_role";



GRANT ALL ON TABLE "public"."ai_policies" TO "anon";
GRANT ALL ON TABLE "public"."ai_policies" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_policies" TO "service_role";



GRANT ALL ON TABLE "public"."ai_scenarios" TO "anon";
GRANT ALL ON TABLE "public"."ai_scenarios" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_scenarios" TO "service_role";



GRANT ALL ON TABLE "public"."ai_settings" TO "anon";
GRANT ALL ON TABLE "public"."ai_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_settings" TO "service_role";



GRANT ALL ON TABLE "public"."ai_usage" TO "anon";
GRANT ALL ON TABLE "public"."ai_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_usage" TO "service_role";



GRANT ALL ON TABLE "public"."analytics_actions" TO "anon";
GRANT ALL ON TABLE "public"."analytics_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_actions" TO "service_role";



GRANT ALL ON TABLE "public"."anonymized_members" TO "anon";
GRANT ALL ON TABLE "public"."anonymized_members" TO "authenticated";
GRANT ALL ON TABLE "public"."anonymized_members" TO "service_role";



GRANT ALL ON TABLE "public"."billing_info" TO "anon";
GRANT ALL ON TABLE "public"."billing_info" TO "authenticated";
GRANT ALL ON TABLE "public"."billing_info" TO "service_role";



GRANT ALL ON TABLE "public"."broadcasts" TO "anon";
GRANT ALL ON TABLE "public"."broadcasts" TO "authenticated";
GRANT ALL ON TABLE "public"."broadcasts" TO "service_role";



GRANT ALL ON TABLE "public"."certificates" TO "anon";
GRANT ALL ON TABLE "public"."certificates" TO "authenticated";
GRANT ALL ON TABLE "public"."certificates" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."conversation_notes" TO "anon";
GRANT ALL ON TABLE "public"."conversation_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."conversation_notes" TO "service_role";



GRANT ALL ON TABLE "public"."cron_job_runs" TO "anon";
GRANT ALL ON TABLE "public"."cron_job_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."cron_job_runs" TO "service_role";



GRANT ALL ON TABLE "public"."custom_email_tokens" TO "anon";
GRANT ALL ON TABLE "public"."custom_email_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_email_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."email_accounts" TO "anon";
GRANT ALL ON TABLE "public"."email_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."email_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."email_conversations" TO "anon";
GRANT ALL ON TABLE "public"."email_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."email_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."email_messages" TO "anon";
GRANT ALL ON TABLE "public"."email_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."email_messages" TO "service_role";



GRANT ALL ON TABLE "public"."email_usage" TO "anon";
GRANT ALL ON TABLE "public"."email_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."email_usage" TO "service_role";



GRANT ALL ON TABLE "public"."exam_questions" TO "anon";
GRANT ALL ON TABLE "public"."exam_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."exam_questions" TO "service_role";



GRANT ALL ON TABLE "public"."exam_submissions" TO "anon";
GRANT ALL ON TABLE "public"."exam_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."exam_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."feedback_submissions" TO "anon";
GRANT ALL ON TABLE "public"."feedback_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."finance_alerts" TO "anon";
GRANT ALL ON TABLE "public"."finance_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."finance_cost_events" TO "anon";
GRANT ALL ON TABLE "public"."finance_cost_events" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_cost_events" TO "service_role";



GRANT ALL ON TABLE "public"."finance_fixed_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."finance_fixed_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_fixed_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."finance_fx_rates" TO "anon";
GRANT ALL ON TABLE "public"."finance_fx_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_fx_rates" TO "service_role";



GRANT ALL ON TABLE "public"."finance_revenue_events" TO "anon";
GRANT ALL ON TABLE "public"."finance_revenue_events" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_revenue_events" TO "service_role";



GRANT ALL ON TABLE "public"."gmail_tokens" TO "anon";
GRANT ALL ON TABLE "public"."gmail_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."gmail_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."impersonation_sessions" TO "anon";
GRANT ALL ON TABLE "public"."impersonation_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."impersonation_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."integrations" TO "anon";
GRANT ALL ON TABLE "public"."integrations" TO "authenticated";
GRANT ALL ON TABLE "public"."integrations" TO "service_role";



GRANT ALL ON SEQUENCE "public"."invoice_seq_2026" TO "anon";
GRANT ALL ON SEQUENCE "public"."invoice_seq_2026" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."invoice_seq_2026" TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON TABLE "public"."macro_onboarding" TO "anon";
GRANT ALL ON TABLE "public"."macro_onboarding" TO "authenticated";
GRANT ALL ON TABLE "public"."macro_onboarding" TO "service_role";



GRANT ALL ON TABLE "public"."macro_tags" TO "anon";
GRANT ALL ON TABLE "public"."macro_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."macro_tags" TO "service_role";



GRANT ALL ON TABLE "public"."macros" TO "anon";
GRANT ALL ON TABLE "public"."macros" TO "authenticated";
GRANT ALL ON TABLE "public"."macros" TO "service_role";



GRANT ALL ON TABLE "public"."masterclasses" TO "anon";
GRANT ALL ON TABLE "public"."masterclasses" TO "authenticated";
GRANT ALL ON TABLE "public"."masterclasses" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."oauth_states" TO "anon";
GRANT ALL ON TABLE "public"."oauth_states" TO "authenticated";
GRANT ALL ON TABLE "public"."oauth_states" TO "service_role";



GRANT ALL ON TABLE "public"."outlook_tokens" TO "anon";
GRANT ALL ON TABLE "public"."outlook_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."outlook_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."ownership_transfers" TO "anon";
GRANT ALL ON TABLE "public"."ownership_transfers" TO "authenticated";
GRANT ALL ON TABLE "public"."ownership_transfers" TO "service_role";



GRANT ALL ON TABLE "public"."payment_methods" TO "anon";
GRANT ALL ON TABLE "public"."payment_methods" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_methods" TO "service_role";



GRANT ALL ON TABLE "public"."plans" TO "anon";
GRANT ALL ON TABLE "public"."plans" TO "authenticated";
GRANT ALL ON TABLE "public"."plans" TO "service_role";



GRANT ALL ON TABLE "public"."platform_admins" TO "anon";
GRANT ALL ON TABLE "public"."platform_admins" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_admins" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."refunds" TO "anon";
GRANT ALL ON TABLE "public"."refunds" TO "authenticated";
GRANT ALL ON TABLE "public"."refunds" TO "service_role";



GRANT ALL ON TABLE "public"."service_inquiries" TO "anon";
GRANT ALL ON TABLE "public"."service_inquiries" TO "authenticated";
GRANT ALL ON TABLE "public"."service_inquiries" TO "service_role";



GRANT ALL ON TABLE "public"."shipments" TO "anon";
GRANT ALL ON TABLE "public"."shipments" TO "authenticated";
GRANT ALL ON TABLE "public"."shipments" TO "service_role";



GRANT ALL ON TABLE "public"."shopify_orders" TO "anon";
GRANT ALL ON TABLE "public"."shopify_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."shopify_orders" TO "service_role";



GRANT ALL ON TABLE "public"."stores" TO "anon";
GRANT ALL ON TABLE "public"."stores" TO "authenticated";
GRANT ALL ON TABLE "public"."stores" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_addons" TO "anon";
GRANT ALL ON TABLE "public"."subscription_addons" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_addons" TO "service_role";



GRANT ALL ON TABLE "public"."support_events" TO "anon";
GRANT ALL ON TABLE "public"."support_events" TO "authenticated";
GRANT ALL ON TABLE "public"."support_events" TO "service_role";



GRANT ALL ON TABLE "public"."tags" TO "anon";
GRANT ALL ON TABLE "public"."tags" TO "authenticated";
GRANT ALL ON TABLE "public"."tags" TO "service_role";



GRANT ALL ON TABLE "public"."talent_profiles" TO "anon";
GRANT ALL ON TABLE "public"."talent_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."talent_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."talent_purchases" TO "anon";
GRANT ALL ON TABLE "public"."talent_purchases" TO "authenticated";
GRANT ALL ON TABLE "public"."talent_purchases" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."team_members" TO "anon";
GRANT ALL ON TABLE "public"."team_members" TO "authenticated";
GRANT ALL ON TABLE "public"."team_members" TO "service_role";



GRANT ALL ON TABLE "public"."tickets" TO "anon";
GRANT ALL ON TABLE "public"."tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."tickets" TO "service_role";



GRANT ALL ON TABLE "public"."time_session_edits" TO "anon";
GRANT ALL ON TABLE "public"."time_session_edits" TO "authenticated";
GRANT ALL ON TABLE "public"."time_session_edits" TO "service_role";



GRANT ALL ON TABLE "public"."time_sessions" TO "anon";
GRANT ALL ON TABLE "public"."time_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."time_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."usage_counters" TO "anon";
GRANT ALL ON TABLE "public"."usage_counters" TO "authenticated";
GRANT ALL ON TABLE "public"."usage_counters" TO "service_role";



GRANT ALL ON TABLE "public"."user_api_keys" TO "anon";
GRANT ALL ON TABLE "public"."user_api_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."user_api_keys" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."webhook_events" TO "anon";
GRANT ALL ON TABLE "public"."webhook_events" TO "authenticated";
GRANT ALL ON TABLE "public"."webhook_events" TO "service_role";



GRANT ALL ON TABLE "public"."workspace_addons" TO "anon";
GRANT ALL ON TABLE "public"."workspace_addons" TO "authenticated";
GRANT ALL ON TABLE "public"."workspace_addons" TO "service_role";



GRANT ALL ON TABLE "public"."workspace_deletion_log" TO "anon";
GRANT ALL ON TABLE "public"."workspace_deletion_log" TO "authenticated";
GRANT ALL ON TABLE "public"."workspace_deletion_log" TO "service_role";



GRANT ALL ON TABLE "public"."workspace_invites" TO "anon";
GRANT ALL ON TABLE "public"."workspace_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."workspace_invites" TO "service_role";



GRANT ALL ON TABLE "public"."workspace_invite_details" TO "service_role";



GRANT ALL ON TABLE "public"."workspace_members" TO "anon";
GRANT ALL ON TABLE "public"."workspace_members" TO "authenticated";
GRANT ALL ON TABLE "public"."workspace_members" TO "service_role";



GRANT ALL ON TABLE "public"."workspace_member_details" TO "service_role";



GRANT ALL ON TABLE "public"."workspace_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."workspace_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."workspace_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."workspaces" TO "anon";
GRANT ALL ON TABLE "public"."workspaces" TO "authenticated";
GRANT ALL ON TABLE "public"."workspaces" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







RESET ALL;
