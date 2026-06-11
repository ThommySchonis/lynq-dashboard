// supabase/functions/migrations-tick/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  claimNextMigration, processOneChunk, markCompleted, markFailed, releaseClaim, loadCreds,
} from '../api/lib/services/migrations/orchestrator.ts'
import { getAdapter } from '../api/lib/services/migrations/registry.ts'
import { startCronRun, endCronRun } from '../_shared/cron-logger.ts'

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

Deno.serve(async () => {
  const runId = await startCronRun('migrations-tick', 'edge-function')
  let processed = 0

  try {
    const job = await claimNextMigration(sb)
    if (!job) {
      await endCronRun(runId, { status: 'success', summary: { notes: 'nothing to do' } })
      return new Response('idle')
    }
    if (!job.credentials_ref) {
      await markFailed(sb, job.id, 'No credentials_ref on job — cannot run')
      await endCronRun(runId, { status: 'failure', errorMessage: 'no creds' })
      return new Response('failed')
    }

    try {
      const adapter = getAdapter(job.source_platform)
      const creds = await loadCreds(sb, job.credentials_ref)

      const deadline = Date.now() + 120_000  // 30s headroom under 150s edge limit
      let current = job
      while (Date.now() < deadline) {
        const r = await processOneChunk(sb, current, adapter, creds)
        processed++
        if (r.done) {
          await markCompleted(sb, current.id)
          await endCronRun(runId, { status: 'success', summary: { notes: `completed job ${current.id}, ${processed} chunks` } })
          return new Response('completed')
        }
        current = r.updatedJob
      }
      await releaseClaim(sb, current.id)
      await endCronRun(runId, { status: 'success', summary: { notes: `partial run, ${processed} chunks` } })
      return new Response('partial')
    } catch (err) {
      await markFailed(sb, job.id, err instanceof Error ? err.message : String(err))
      await endCronRun(runId, { status: 'failure', errorMessage: err instanceof Error ? err.message : 'unknown' })
      return new Response('failed', { status: 500 })
    }
  } catch (outer) {
    await endCronRun(runId, { status: 'failure', errorMessage: outer instanceof Error ? outer.message : 'unknown' })
    return new Response('error', { status: 500 })
  }
})
