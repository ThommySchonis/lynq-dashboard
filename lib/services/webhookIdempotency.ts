import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { logger } from '@/lib/logger'
import { computeNextRetryAt, MAX_ATTEMPTS } from '@/lib/services/webhookRetry'

type WebhookSource = 'shopify' | 'whop' | 'email' | 'parcelpanel'

interface HandlerResult {
  response: Response
  workspaceId?: string
}

interface WithIdempotencyOptions {
  rawBody: string
  request: Request
  source: WebhookSource
  eventType: string
  extractEventId: (request: Request, body: unknown) => string | null
  workspaceId?: string
  metadata?: Record<string, unknown>
  handler: (body: unknown) => Promise<HandlerResult>
}

const STALE_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes

export async function withIdempotency(options: WithIdempotencyOptions): Promise<Response> {
  const { rawBody, request, source, eventType, extractEventId, handler } = options

  // 1. Parse body
  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // 2. Extract event ID
  const eventId = extractEventId(request, body)
  if (!eventId) {
    // No event ID available — skip dedup, run handler directly
    logger.warn(`[webhook/${source}]`, 'no event ID extractable, skipping dedup')
    try {
      const result = await handler(body)
      return result.response
    } catch (err) {
      logger.error(`[webhook/${source}]`, 'handler error (no dedup)', { error: err instanceof Error ? err.message : String(err) })
      Sentry.captureException(err, { tags: { webhook_source: source, event_type: eventType } })
      return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
    }
  }

  // 3. Attempt insert
  const { error: insertError } = await supabaseAdmin
    .from('webhook_events')
    .insert({
      event_id: eventId,
      source,
      event_type: eventType,
      payload: body,
      status: 'processing',
      workspace_id: options.workspaceId ?? null,
      metadata: options.metadata ?? null,
    })
    .select('id')
    .single()

  if (insertError) {
    // Unique violation — check existing row
    if (insertError.code === '23505') {
      const { data: existing } = await supabaseAdmin
        .from('webhook_events')
        .select('id, status, created_at, attempt_count, next_retry_at')
        .eq('source', source)
        .eq('event_id', eventId)
        .single()

      if (!existing) {
        // Race condition: row disappeared between conflict and select
        return NextResponse.json({ error: 'Transient conflict' }, { status: 500 })
      }

      if (existing.status === 'completed') {
        logger.info(`[webhook/${source}]`, 'duplicate delivery ignored', { eventId, eventType })
        return NextResponse.json({ received: true, duplicate: true })
      }

      // Failed events: allow re-processing on retry delivery.
      if (existing.status === 'failed') {
        // If our retry system has a future retry scheduled, let it handle it
        if (existing.next_retry_at && new Date(existing.next_retry_at as string) > new Date()) {
          logger.info(`[webhook/${source}]`, 'retry scheduled, deferring to retry system', { eventId })
          return NextResponse.json({ received: true, duplicate: true })
        }
        // Otherwise allow provider retry to proceed (our system hasn't picked it up)
        logger.warn(`[webhook/${source}]`, 'retrying previously failed event', { eventId })
        await supabaseAdmin
          .from('webhook_events')
          .delete()
          .eq('id', existing.id)

        const { error: retryInsertError } = await supabaseAdmin
          .from('webhook_events')
          .insert({
            event_id: eventId,
            source,
            event_type: eventType,
            payload: body,
            status: 'processing',
            workspace_id: options.workspaceId ?? null,
            metadata: options.metadata ?? null,
            attempt_count: ((existing.attempt_count as number) ?? 1) + 1,
          })

        if (retryInsertError) {
          logger.info(`[webhook/${source}]`, 'lost race on failed retry re-insert', { eventId })
          return NextResponse.json({ received: true, duplicate: true })
        }
        // Fall through to execute handler
      } else if (existing.status === 'dead_letter' || existing.status === 'dismissed') {
        logger.info(`[webhook/${source}]`, 'event is dead-lettered/dismissed, skipping', { eventId })
        return NextResponse.json({ received: true, duplicate: true })
      } else {
        // Status is 'processing' — check if stale
        const age = Date.now() - new Date(existing.created_at as string).getTime()
        if (age < STALE_THRESHOLD_MS) {
          logger.info(`[webhook/${source}]`, 'concurrent processing, skipping', { eventId })
          return NextResponse.json({ received: true, duplicate: true })
        }

        // Stale — delete and re-insert
        logger.warn(`[webhook/${source}]`, `stale processing event detected (${Math.round(age / 1000)}s old), re-processing`, { eventId })
        await supabaseAdmin
          .from('webhook_events')
          .delete()
          .eq('id', existing.id)

        const { error: reinsertError } = await supabaseAdmin
          .from('webhook_events')
          .insert({
            event_id: eventId,
            source,
            event_type: eventType,
            payload: body,
            status: 'processing',
            workspace_id: options.workspaceId ?? null,
            metadata: options.metadata ?? null,
          })

        if (reinsertError) {
          logger.info(`[webhook/${source}]`, 'lost race on stale re-insert', { eventId })
          return NextResponse.json({ received: true, duplicate: true })
        }
      }
    } else {
      // Non-conflict DB error — log but still process the webhook
      logger.error(`[webhook/${source}]`, 'event insert failed', { error: insertError.message })
      Sentry.captureException(insertError, { tags: { webhook_source: source, stage: 'idempotency' } })
    }
  }

  // 4. Execute handler
  const startTime = Date.now()
  try {
    const result = await handler(body)
    const durationMs = Date.now() - startTime
    const resolvedWorkspaceId = result.workspaceId ?? options.workspaceId ?? null

    // 5. Mark completed
    await supabaseAdmin
      .from('webhook_events')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        processing_duration_ms: durationMs,
        ...(resolvedWorkspaceId ? { workspace_id: resolvedWorkspaceId } : {}),
      })
      .eq('source', source)
      .eq('event_id', eventId)

    return result.response
  } catch (err) {
    const durationMs = Date.now() - startTime
    const errorMessage = err instanceof Error ? err.message : String(err)

    // Determine current attempt count
    const { data: currentEvent } = await supabaseAdmin
      .from('webhook_events')
      .select('attempt_count')
      .eq('source', source)
      .eq('event_id', eventId)
      .single()

    const attemptCount = (currentEvent?.attempt_count as number) ?? 1
    const nextRetry = computeNextRetryAt(attemptCount)
    const newStatus = attemptCount >= MAX_ATTEMPTS ? 'dead_letter' : 'failed'

    await supabaseAdmin
      .from('webhook_events')
      .update({
        status: newStatus,
        error_message: errorMessage,
        processing_duration_ms: durationMs,
        next_retry_at: nextRetry,
      })
      .eq('source', source)
      .eq('event_id', eventId)

    logger.error(`[webhook/${source}]`, 'handler error', {
      error: errorMessage,
      status: newStatus,
      nextRetry,
    })
    Sentry.captureException(err, {
      tags: { webhook_source: source, event_type: eventType },
      extra: { event_id: eventId, duration_ms: durationMs, status: newStatus },
    })
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }
}
