-- Cron job run tracking for monitoring/alerting
create table cron_job_runs (
  id            uuid primary key default gen_random_uuid(),
  job_name      text not null,
  status        text not null check (status in ('running', 'success', 'warning', 'failure')),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  duration_ms   integer,
  summary       jsonb,
  error_message text,
  runtime       text not null check (runtime in ('vercel-cron', 'edge-function')),
  created_at    timestamptz not null default now()
);

create index idx_cron_job_runs_job_name on cron_job_runs(job_name);
create index idx_cron_job_runs_status on cron_job_runs(status);
create index idx_cron_job_runs_started_at on cron_job_runs(started_at desc);

-- RLS: deny writes from client, allow reads for authenticated users (needed for Realtime)
alter table cron_job_runs enable row level security;

-- Authenticated users can SELECT (required for Supabase Realtime to deliver events).
-- The admin page itself is gated by ADMIN_EMAILS at the component and API level.
create policy "Authenticated users can read cron_job_runs"
  on cron_job_runs for select
  to authenticated
  using (true);

-- No INSERT/UPDATE/DELETE policies = only service role (server-side) can write.

-- Enable Realtime subscriptions for admin UI
alter publication supabase_realtime add table cron_job_runs;
