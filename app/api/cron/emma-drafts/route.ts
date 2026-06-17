import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { checkAiSuggestLimit } from '@/lib/services/limit-check'
import { generateEmmaDraft, type EmmaMessageInput } from '@/lib/services/emma-generate'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BATCH_SIZE = 8
const MAX_ATTEMPTS = 2 // initial try + 1 retry

interface QueueRow {
  id: string
  workspace_id: string
  conversation_id: string
  user_id: string
  user_email: string | null
  member_id: string | null
  language: string | null
  attempts: number
}

interface MessageRow {
  from_name: string | null
  from_email: string | null
  body_text: string | null
  body_html: string | null
  sent_at: string | null
  created_at: string | null
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: jobsRaw, error: claimErr } = await supabaseAdmin
    .from('emma_draft_queue')
    .select('id, workspace_id, conversation_id, user_id, user_email, member_id, language, attempts')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE)
  if (claimErr) return NextResponse.json({ error: claimErr.message }, { status: 500 })

  const jobs = (jobsRaw ?? []) as QueueRow[]
  if (jobs.length === 0) return NextResponse.json({ processed: 0 })

  await supabaseAdmin
    .from('emma_draft_queue')
    .update({ status: 'processing' })
    .in('id', jobs.map((j) => j.id))

  const planAllowed = new Map<string, boolean>()
  let completed = 0, failed = 0, skipped = 0

  for (const job of jobs) {
    try {
      let allowed = planAllowed.get(job.workspace_id)
      if (allowed === undefined) {
        const lim = await checkAiSuggestLimit(job.workspace_id)
        allowed = lim.allowed
        planAllowed.set(job.workspace_id, allowed)
      }
      if (!allowed) {
        await supabaseAdmin.from('emma_draft_queue')
          .update({ status: 'skipped', error: 'plan_limit', processed_at: new Date().toISOString() })
          .eq('id', job.id)
        skipped++
        continue
      }

      const { data: msgRaw } = await supabaseAdmin
        .from('email_messages')
        .select('from_name, from_email, body_text, body_html, sent_at, created_at')
        .eq('workspace_id', job.workspace_id)
        .eq('conversation_id', job.conversation_id)
        .order('created_at', { ascending: true })
      const messages: EmmaMessageInput[] = ((msgRaw ?? []) as MessageRow[]).map((m) => ({
        from: m.from_name ? `${m.from_name} <${m.from_email ?? ''}>` : (m.from_email ?? ''),
        date: m.sent_at ?? m.created_at ?? '',
        body: m.body_text ?? m.body_html ?? '',
      }))

      await generateEmmaDraft({
        workspaceId: job.workspace_id,
        userId: job.user_id,
        userEmail: job.user_email ?? '',
        memberId: job.member_id,
        conversationId: job.conversation_id,
        messages,
        language: job.language ?? undefined,
        allowAutoSend: false,
      })

      await supabaseAdmin.from('emma_draft_queue')
        .update({ status: 'completed', processed_at: new Date().toISOString() })
        .eq('id', job.id)
      completed++
    } catch (err) {
      const attempts = job.attempts + 1
      const isFinal = attempts >= MAX_ATTEMPTS
      await supabaseAdmin.from('emma_draft_queue')
        .update({
          status: isFinal ? 'failed' : 'pending',
          attempts,
          error: err instanceof Error ? err.message.slice(0, 500) : 'generation failed',
          processed_at: isFinal ? new Date().toISOString() : null,
        })
        .eq('id', job.id)
      if (isFinal) failed++
      logger.error('[cron/emma-drafts]', 'job failed', { jobId: job.id, attempts })
    }
  }

  return NextResponse.json({ processed: jobs.length, completed, failed, skipped })
}
