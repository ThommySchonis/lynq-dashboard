import { supabaseAdmin } from '@/lib/supabaseAdmin'

type CronRuntime = 'vercel-cron' | 'edge-function'
type CronStatus = 'success' | 'warning' | 'failure'

interface EndCronRunParams {
  status: CronStatus
  summary?: Record<string, unknown>
  errorMessage?: string
}

export async function startCronRun(
  jobName: string,
  runtime: CronRuntime
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('cron_job_runs')
    .insert({ job_name: jobName, status: 'running', runtime })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[cron-logger] startCronRun failed:', error?.message)
    return 'unknown'
  }

  return data.id as string
}

export async function endCronRun(
  runId: string,
  { status, summary, errorMessage }: EndCronRunParams
): Promise<void> {
  if (runId === 'unknown') return

  const { data: row } = await supabaseAdmin
    .from('cron_job_runs')
    .select('started_at')
    .eq('id', runId)
    .single()

  const durationMs = row?.started_at
    ? Date.now() - new Date(row.started_at as string).getTime()
    : null

  const { error } = await supabaseAdmin
    .from('cron_job_runs')
    .update({
      status,
      finished_at: new Date().toISOString(),
      duration_ms: durationMs,
      summary: summary ?? null,
      error_message: errorMessage ?? null,
    })
    .eq('id', runId)

  if (error) {
    console.error('[cron-logger] endCronRun failed:', error.message)
  }
}
