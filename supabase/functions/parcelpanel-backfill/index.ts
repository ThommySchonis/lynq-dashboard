// supabase/functions/parcelpanel-backfill/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { startCronRun, endCronRun } from '../_shared/cron-logger.ts'
import { backfillTrackings } from '../_shared/parcel-panel.ts'

const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey)

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const workspaceId = url.searchParams.get('workspace_id')

  // On-demand single-workspace calls (from connect) must present the service-role key.
  if (workspaceId) {
    const auth = req.headers.get('Authorization') ?? ''
    if (auth !== `Bearer ${serviceKey}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
  }

  // 'on-demand' is not a valid CronRuntime; the logger only accepts 'vercel-cron' | 'edge-function'.
  // We always run as an edge-function — record the trigger type in the summary instead.
  const runId = await startCronRun('parcelpanel-backfill', 'edge-function')
  try {
    let query = supabase
      .from('integrations')
      .select('workspace_id, parcelpanel_api_key')
      .not('parcelpanel_api_key', 'is', null)
    if (workspaceId) query = query.eq('workspace_id', workspaceId)

    const { data: integrations, error } = await query
    if (error || !integrations) {
      await endCronRun(runId, { status: 'failure', errorMessage: error?.message ?? 'fetch failed' })
      return new Response('Failed', { status: 500 })
    }

    let totalProcessed = 0
    for (const int of integrations as { workspace_id: string; parcelpanel_api_key: string | null }[]) {
      if (!int.parcelpanel_api_key) continue
      try {
        const { processed } = await backfillTrackings(supabase, int.workspace_id, int.parcelpanel_api_key, { sinceDays: 90 })
        totalProcessed += processed
      } catch (e) {
        console.error('[parcelpanel-backfill] workspace failed', int.workspace_id, e instanceof Error ? e.message : String(e))
      }
    }

    const trigger = workspaceId ? 'on-demand' : 'scheduled'
    await endCronRun(runId, { status: 'success', summary: { trigger, workspaces: integrations.length, processed: totalProcessed } })
    return new Response(JSON.stringify({ success: true, processed: totalProcessed }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await endCronRun(runId, { status: 'failure', errorMessage: msg })
    return new Response(JSON.stringify({ error: msg }), { status: 500 })
  }
})
