import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { startCronRun, endCronRun } from '../_shared/cron-logger.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const appBaseUrl = Deno.env.get('APP_BASE_URL')!
const retrySecret = Deno.env.get('WEBHOOK_RETRY_SECRET')!

const supabase = createClient(supabaseUrl, supabaseKey)

// Same schedule as lib/services/webhookRetry.ts — keep in sync
const RETRY_DELAYS_MS = [30_000, 120_000, 600_000, 1_800_000, 3_600_000, 7_200_000, 14_400_000]
const MAX_ATTEMPTS = 8

function computeNextRetryAt(attemptCount: number): string | null {
  const index = attemptCount - 1
  if (index < 0 || index >= RETRY_DELAYS_MS.length) return null
  return new Date(Date.now() + RETRY_DELAYS_MS[index]).toISOString()
}

const RETRY_ENDPOINTS: Record<string, string> = {
  shopify: '/api/webhooks/retry/shopify',
  whop: '/api/webhooks/retry/whop',
  email: '/api/webhooks/retry/email',
  parcelpanel: '/api/webhooks/retry/parcelpanel',
}

Deno.serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 })
  }

  const runId = await startCronRun('webhook-retry', 'edge-function')

  try {
    // 1. Reset stale processing events from previous retry cycles
    const staleThreshold = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const { data: staleEvents } = await supabase
      .from('webhook_events')
      .update({ status: 'failed' })
      .eq('status', 'processing')
      .gt('attempt_count', 0)
      .lt('created_at', staleThreshold)
      .select('id')

    if (staleEvents?.length) {
      console.log(`[webhook-retry] reset ${staleEvents.length} stale processing events`)
    }

    // 2. Fetch failed events due for retry
    const { data: events, error: fetchError } = await supabase
      .from('webhook_events')
      .select('id, event_id, source, event_type, payload, workspace_id, metadata, attempt_count')
      .eq('status', 'failed')
      .lte('next_retry_at', new Date().toISOString())
      .lt('attempt_count', MAX_ATTEMPTS)
      .order('next_retry_at', { ascending: true })
      .limit(20)

    if (fetchError) {
      console.error('[webhook-retry] fetch failed:', fetchError.message)
      await endCronRun(runId, { status: 'failure', errorMessage: fetchError.message })
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!events?.length) {
      await endCronRun(runId, { status: 'success', summary: { processed: 0, completed: 0, rescheduled: 0, dead_lettered: 0 } })
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    let completed = 0
    let rescheduled = 0
    let deadLettered = 0

    for (const event of events) {
      const endpoint = RETRY_ENDPOINTS[event.source]
      if (!endpoint) {
        console.warn(`[webhook-retry] unknown source: ${event.source}`)
        continue
      }

      // Mark as processing to prevent concurrent pickup
      await supabase
        .from('webhook_events')
        .update({ status: 'processing' })
        .eq('id', event.id)

      const startTime = Date.now()

      try {
        const res = await fetch(`${appBaseUrl}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-retry-secret': retrySecret,
          },
          body: JSON.stringify({
            event_id: event.event_id,
            event_type: event.event_type,
            payload: event.payload,
            workspace_id: event.workspace_id,
            metadata: event.metadata,
          }),
        })

        const durationMs = Date.now() - startTime

        if (res.ok) {
          await supabase
            .from('webhook_events')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              processing_duration_ms: durationMs,
            })
            .eq('id', event.id)
          completed++
        } else {
          const newAttemptCount = (event.attempt_count ?? 1) + 1
          const nextRetry = computeNextRetryAt(newAttemptCount)
          const newStatus = newAttemptCount >= MAX_ATTEMPTS ? 'dead_letter' : 'failed'

          let errorMessage = `HTTP ${res.status}`
          try {
            const errBody = await res.json()
            errorMessage = errBody.error || errorMessage
          } catch { /* ignore */ }

          await supabase
            .from('webhook_events')
            .update({
              status: newStatus,
              attempt_count: newAttemptCount,
              next_retry_at: nextRetry,
              error_message: errorMessage,
              processing_duration_ms: durationMs,
            })
            .eq('id', event.id)

          if (newStatus === 'dead_letter') {
            deadLettered++
          } else {
            rescheduled++
          }
        }
      } catch (err) {
        // Network error — increment attempt count and schedule next retry
        const errorMessage = err instanceof Error ? err.message : String(err)
        const newAttemptCount = (event.attempt_count ?? 1) + 1
        const nextRetry = computeNextRetryAt(newAttemptCount)
        const newStatus = newAttemptCount >= MAX_ATTEMPTS ? 'dead_letter' : 'failed'

        await supabase
          .from('webhook_events')
          .update({
            status: newStatus,
            attempt_count: newAttemptCount,
            next_retry_at: nextRetry,
            error_message: `Retry fetch error: ${errorMessage}`,
          })
          .eq('id', event.id)

        if (newStatus === 'dead_letter') {
          deadLettered++
        } else {
          rescheduled++
        }
      }
    }

    const logSummary = `[webhook-retry] processed ${events.length} events: ${completed} completed, ${rescheduled} rescheduled, ${deadLettered} dead-lettered`
    console.log(logSummary)

    await endCronRun(runId, {
      status: deadLettered > 0 ? 'warning' : 'success',
      summary: { processed: events.length, completed, rescheduled, dead_lettered: deadLettered },
    })

    return new Response(
      JSON.stringify({ processed: events.length, completed, rescheduled, deadLettered }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error('[webhook-retry] Fatal error:', errorMessage)
    await endCronRun(runId, { status: 'failure', errorMessage })
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
