-- get_kpis: aggregate KPI data for a workspace within a date range
CREATE OR REPLACE FUNCTION get_kpis(
  p_workspace_id UUID,
  p_from DATE,
  p_to DATE
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'totalOrders', COUNT(*)::int,
    'cancelledOrders', COUNT(*) FILTER (WHERE cancel_reason IS NOT NULL)::int,
    'totalRefunds', COUNT(*) FILTER (WHERE cancel_reason IS NULL AND refund_amount > 0)::int,
    'netRevenue', COALESCE(SUM(CASE WHEN cancel_reason IS NULL THEN subtotal_price - COALESCE(refund_amount, 0) ELSE 0 END), 0),
    'discounts', COALESCE(SUM(CASE WHEN cancel_reason IS NULL THEN COALESCE(total_discounts, 0) ELSE 0 END), 0),
    'returns', COALESCE(SUM(CASE WHEN cancel_reason IS NULL THEN COALESCE(refund_amount, 0) ELSE 0 END), 0)
  ) INTO result
  FROM shopify_orders
  WHERE workspace_id = p_workspace_id
    AND COALESCE(processed_at, created_at_shopify)::date BETWEEN p_from AND p_to;

  RETURN result;
END;
$$;

-- get_revenue_trend: daily revenue for a workspace, gap-filled
CREATE OR REPLACE FUNCTION get_revenue_trend(
  p_workspace_id UUID,
  p_from DATE,
  p_to DATE
)
RETURNS TABLE(date DATE, revenue NUMERIC)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH days AS (
    SELECT generate_series(p_from, p_to, '1 day'::interval)::date AS d
  ),
  daily AS (
    SELECT
      COALESCE(processed_at, created_at_shopify)::date AS d,
      SUM(subtotal_price - COALESCE(refund_amount, 0)) AS rev
    FROM shopify_orders
    WHERE workspace_id = p_workspace_id
      AND cancel_reason IS NULL
      AND COALESCE(processed_at, created_at_shopify)::date BETWEEN p_from AND p_to
    GROUP BY 1
  )
  SELECT days.d AS date, GREATEST(COALESCE(daily.rev, 0), 0) AS revenue
  FROM days
  LEFT JOIN daily ON days.d = daily.d
  ORDER BY days.d;
END;
$$;
