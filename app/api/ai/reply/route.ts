import { getAuthContext, requireWriteAccess } from '../../../../lib/auth'
import { checkAiSuggestLimit } from '../../../../lib/services/limit-check'
import { checkRateLimit } from '@/lib/rate-limit'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { aiReplyBody } from '@/lib/schemas/ai'
import { serviceCatchHandler } from '@/lib/service-catch-handler'
import { generateEmmaDraft } from '@/lib/services/emma-generate'

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const blocked = requireWriteAccess(ctx)
  if (blocked) return blocked
  const user = ctx.user

  // Model 3 (forced upgrade) — block AI Suggest at the plan's
  // ai_suggest_limit. Returns 429 with the structured PLAN_LIMIT_REACHED
  // shape so the UI can show the same upgrade prompt as for ticket sends.
  // We don't flip workspace_subscriptions.write_locked here; that flag is
  // owned by the outbound-ticket path. See docs/billing-model.md.
  const rl = checkRateLimit(`ws:${ctx.workspaceId}:ai`, 10, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfterMs: rl.resetMs },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(rl.resetMs / 1000)),
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': '0',
        },
      }
    )
  }

  const aiCheck = await checkAiSuggestLimit(ctx.workspaceId)
  if (!aiCheck.allowed) {
    return NextResponse.json({
      error:        'PLAN_LIMIT_REACHED',
      code:         'PLAN_LIMIT_REACHED',
      resource:     'ai_suggest',
      current_plan: aiCheck.planId,
      used:         aiCheck.used,
      limit:        aiCheck.limit,
      upgrade_url:  '/settings/workspace/billing',
    }, { status: 429 })
  }

  const raw: unknown = await request.json().catch(() => ({}))
  const parsed = aiReplyBody.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }
  const { messages, threadId, language } = parsed.data

  try {
    const result = await generateEmmaDraft({
      workspaceId: ctx.workspaceId,
      userId: user.id,
      userEmail: user.email ?? '',
      memberId: ctx.memberId,
      conversationId: threadId,
      messages,
      language,
      allowAutoSend: true,
    })

    const responseBody = result.autoSent
      ? { reply: result.replyText, threadId, auto_sent: true, draft_id: result.draftId }
      : { reply: result.replyText, threadId, draft_id: result.draftId }

    return NextResponse.json(responseBody, {
      headers: {
        'X-RateLimit-Limit': '10',
        'X-RateLimit-Remaining': String(rl.remaining),
      },
    })
  } catch (err) {
    return serviceCatchHandler(err, 'anthropic')
  }
}
