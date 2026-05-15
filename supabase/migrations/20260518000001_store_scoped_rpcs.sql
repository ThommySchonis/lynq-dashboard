-- Update get_kpis and get_revenue_trend to optionally filter by store_id

create or replace function get_kpis(
  p_workspace_id uuid,
  p_from date,
  p_to date,
  p_store_id uuid default null
)
returns json
language sql
stable
as $$
  select json_build_object(
    'totalOrders', count(*)::int,
    'cancelledOrders', count(*) filter (where cancel_reason is not null)::int,
    'totalRefunds', count(*) filter (where cancel_reason is null and refund_amount > 0)::int,
    'netRevenue', coalesce(sum(case when cancel_reason is null then subtotal_price - coalesce(refund_amount, 0) else 0 end), 0),
    'discounts', coalesce(sum(case when cancel_reason is null then coalesce(total_discounts, 0) else 0 end), 0),
    'returns', coalesce(sum(case when cancel_reason is null then coalesce(refund_amount, 0) else 0 end), 0)
  )
  from shopify_orders
  where workspace_id = p_workspace_id
    and coalesce(processed_at, created_at_shopify)::date between p_from and p_to
    and (p_store_id is null or store_id = p_store_id);
$$;

create or replace function get_revenue_trend(
  p_workspace_id uuid,
  p_from date,
  p_to date,
  p_store_id uuid default null
)
returns table(date date, revenue numeric)
language sql
stable
as $$
  select
    d::date as date,
    coalesce(sum(
      case when o.cancel_reason is null
        then o.subtotal_price - coalesce(o.refund_amount, 0)
        else 0
      end
    ), 0) as revenue
  from generate_series(p_from, p_to, '1 day'::interval) d
  left join shopify_orders o
    on o.workspace_id = p_workspace_id
    and (p_store_id is null or o.store_id = p_store_id)
    and coalesce(o.processed_at, o.created_at_shopify)::date = d::date
  group by d::date
  order by d::date;
$$;
