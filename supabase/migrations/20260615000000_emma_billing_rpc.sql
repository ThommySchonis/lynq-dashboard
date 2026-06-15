-- ============================================================
-- api_get_emma_billing — per-workspace Emma usage counts for the
-- current billing cycle, grouped by store. Counts every ai_drafts
-- row (all statuses; regenerations included). Returns counts only;
-- pricing (env rate) is applied in the edge service layer.
-- ============================================================

create or replace function api_get_emma_billing(p_workspace_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_start  timestamptz;
  v_end    timestamptz;
  v_result jsonb;
begin
  -- Current billing period from the workspace subscription.
  select current_period_start, current_period_end
    into v_start, v_end
  from workspace_subscriptions
  where workspace_id = p_workspace_id;

  -- Fallback: no subscription row or null period → current calendar month.
  if v_start is null or v_end is null then
    v_start := date_trunc('month', now());
    v_end   := v_start + interval '1 month';
  end if;

  -- LEFT JOIN + coalesce: ai_drafts.store_id is ON DELETE SET NULL, so a
  -- deleted store leaves orphan drafts with store_id = null. Those generations
  -- still happened and must count toward total usage — an inner join would drop
  -- them and under-report. Orphans group under a single "Deleted store" row.
  with per_store as (
    select
      coalesce(d.store_id::text, 'deleted') as store_id,
      coalesce(s.name, 'Deleted store')     as store_name,
      count(*)::int                          as count
    from ai_drafts d
    left join stores s on s.id = d.store_id
    where d.workspace_id = p_workspace_id
      and d.generated_at >= v_start
      and d.generated_at <  v_end
    group by coalesce(d.store_id::text, 'deleted'), coalesce(s.name, 'Deleted store')
    order by count(*) desc
  )
  select jsonb_build_object(
    'period_start', v_start,
    'period_end',   v_end,
    'total_count',  coalesce((select sum(count) from per_store), 0),
    'stores',       coalesce(
                      (select jsonb_agg(jsonb_build_object(
                         'store_id',   store_id,
                         'store_name', store_name,
                         'count',      count))
                       from per_store),
                      '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

-- Called only by the edge function with the service-role client, which
-- authorizes the workspace via authMiddleware before passing p_workspace_id.
-- Not granted to `authenticated` so it cannot be called client-side with an
-- arbitrary workspace id.
grant execute on function api_get_emma_billing(uuid) to service_role;

-- ── Verification ─────────────────────────────────────────────
do $$
begin
  assert (
    select count(*) from pg_proc where proname = 'api_get_emma_billing'
  ) = 1, 'api_get_emma_billing function not found';

  raise notice 'emma_billing_rpc migration OK';
end;
$$;
