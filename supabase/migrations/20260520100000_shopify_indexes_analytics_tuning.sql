-- ==========================================================
-- Shopify Orders: indexes for KPI/analytics dashboard queries
-- ==========================================================

-- Helper: IMMUTABLE function for expression indexes.
-- timestamptz::date is STABLE (timezone-dependent), so we pin to UTC
-- to satisfy PostgreSQL's IMMUTABLE requirement for index expressions.
-- Supabase defaults to UTC, so this matches runtime behavior.
CREATE OR REPLACE FUNCTION shopify_order_date(p timestamptz, fallback timestamptz)
RETURNS date
LANGUAGE sql IMMUTABLE
AS $$ SELECT (COALESCE(p, fallback) AT TIME ZONE 'UTC')::date; $$;

-- 1.1 Expression index for get_kpis and get_revenue_trend
CREATE INDEX IF NOT EXISTS idx_shopify_orders_workspace_date
  ON shopify_orders (workspace_id, shopify_order_date(processed_at, created_at_shopify));

-- 1.2 Store-scoped variant for multi-store dashboard filtering
CREATE INDEX IF NOT EXISTS idx_shopify_orders_workspace_store_date
  ON shopify_orders (workspace_id, store_id, shopify_order_date(processed_at, created_at_shopify));

-- 1.3 Store deletion cleanup path (stores.ts: UPDATE shopify_orders SET store_id = NULL WHERE store_id = X)
CREATE INDEX IF NOT EXISTS idx_shopify_orders_store_id
  ON shopify_orders (store_id);

-- ==========================================================
-- Rewrite get_kpis: use shopify_order_date() so planner hits the index
-- ==========================================================

CREATE OR REPLACE FUNCTION get_kpis(
  p_workspace_id uuid,
  p_from date,
  p_to date,
  p_store_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE sql STABLE
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

-- ==========================================================
-- Rewrite get_agent_productivity: eliminate correlated subqueries
-- Original: 5 correlated subqueries per agent row (O(5N))
-- Rewrite: pre-aggregate into CTEs, LEFT JOIN once (O(N))
-- ==========================================================

CREATE OR REPLACE FUNCTION get_agent_productivity(
  p_workspace_id uuid,
  p_agent_id     uuid        DEFAULT NULL,
  p_date_from    timestamptz DEFAULT NULL,
  p_date_to      timestamptz DEFAULT NULL
)
RETURNS TABLE (
  agent_id               uuid,
  messages_sent          bigint,
  tickets_resolved       bigint,
  one_touch_count        bigint,
  one_touch_rate         numeric,
  avg_messages_per_ticket numeric
)
LANGUAGE sql STABLE
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

-- ==========================================================
-- Rewrite get_revenue_trend: aggregate first, gap-fill second
-- Original: generate_series LEFT JOIN full orders table
-- Rewrite: filter+aggregate orders first (uses expression index),
--          then gap-fill with generate_series against small result
-- ==========================================================

CREATE OR REPLACE FUNCTION get_revenue_trend(
  p_workspace_id uuid,
  p_from date,
  p_to date,
  p_store_id uuid DEFAULT NULL
)
RETURNS TABLE(date date, revenue numeric)
LANGUAGE sql STABLE
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
