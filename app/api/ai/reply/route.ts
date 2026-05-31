import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { getAuthContext, requireWriteAccess } from '../../../../lib/auth'
import { checkAiSuggestLimit } from '../../../../lib/services/limit-check'
import { checkRateLimit } from '@/lib/rate-limit'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { aiReplyBody } from '@/lib/schemas/ai'
import { resilientSdkCall } from '@/lib/resilient-fetch'
import { serviceCatchHandler } from '@/lib/service-catch-handler'
import { getOnboardingStatus, resolveStoreIdForThread } from '@/lib/services/ai-onboarding'
import { buildEmmaSystemPrompt } from '@/lib/services/ai-prompt-builder'
import { logger } from '@/lib/logger'

interface AiSettingsRow {
  system_prompt?: string
  brand_name?: string
}

const DEFAULT_SYSTEM_PROMPT = `You are a professional customer support agent. Write a helpful, empathetic reply to the customer.

Rules:
- Write in first person
- Keep the tone warm but professional
- Do not use bullet points or dashes for simple replies
- Leave an empty line between paragraphs
- Keep replies concise — solve the problem clearly without unnecessary filler
- Sign off with "Kind regards" followed by a line break and the support team name
- If the customer seems angry or frustrated, acknowledge their frustration first before offering a solution
- If a refund is mentioned, offer a 30% partial refund and let the customer keep the item, unless the issue clearly warrants a full refund
- Never make up order details, tracking numbers, or policies you don't have information about`

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

  // Fetch user's custom system prompt from Supabase (if configured)
  const { data: settingsRaw } = await supabaseAdmin
    .from('ai_settings')
    .select('system_prompt, brand_name')
    .eq('user_id', user.id)
    .single()

  const settings = settingsRaw as AiSettingsRow | null
  let systemPrompt = settings?.system_prompt || DEFAULT_SYSTEM_PROMPT
  const brandName = settings?.brand_name || 'Support Team'

  // store_id is resolved here (hoisted out of the gate's try below) so it is
  // available both to the Emma gate and to the ai_drafts INSERT after the LLM
  // call. promptPath records which prompt path actually produced the reply.
  let storeId: string | null = null
  let promptPath: 'emma' | 'fallback' = 'fallback'

  // Emma Phase 1 — if the conversation's store has completed AI onboarding,
  // swap in a system prompt built from ai_policies + ai_scenarios. Any failure
  // (unknown thread, no store, DB error) falls through to the legacy prompt
  // above; AI Suggest must never 500 because of an onboarding lookup. Policy
  // and scenario contents are never logged.
  try {
    storeId = await resolveStoreIdForThread(threadId, ctx.workspaceId)
    if (storeId) {
      const onboarding = await getOnboardingStatus(storeId, ctx.workspaceId)
      if (onboarding.isComplete && onboarding.policies) {
        systemPrompt = buildEmmaSystemPrompt(onboarding.policies, onboarding.scenarios)
        promptPath = 'emma'
      }
    }
  } catch (err) {
    logger.error('[ai/reply]', 'emma onboarding lookup failed', err)
  }

  // Build the conversation context from thread messages
  const conversationContext = messages
    .map(msg => {
      const sender = msg.from || 'Unknown'
      const date = msg.date || ''
      const body = (msg.body || msg.snippet || '').slice(0, 1500) // cap per message
      return `--- Message from ${sender} (${date}) ---\n${body}`
    })
    .join('\n\n')

  // Detect language instruction
  const languageInstruction = language
    ? `\n\nIMPORTANT: Write your reply in ${language}. The customer is communicating in ${language}.`
    : ''

  try {
    const { text, usage } = await resilientSdkCall('anthropic', () =>
      generateText({
        model: anthropic('claude-haiku-4-5-20251001'),
        system: systemPrompt + languageInstruction,
        prompt: `Here is the full email conversation. Write a professional reply to the latest message from the customer.

${conversationContext}

---
Write only the reply body. Do not include subject lines, metadata, or explanations. Sign off as "${brandName}".`,
        maxOutputTokens: 600,
      })
    )

    await supabaseAdmin.from('ai_usage').insert({
      route: 'reply',
      model: 'claude-haiku-4-5-20251001',
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      cost_usd: ((usage.inputTokens ?? 0) * 0.0000008) + ((usage.outputTokens ?? 0) * 0.000004),
      user_email: user.email,
    })

    // Best-effort: persist the suggestion as an ai_drafts row. This must NEVER
    // affect the response — any failure is logged with a generic message (no
    // suggested_text / policy / scenario content) and swallowed. Skipped when
    // there is no conversation to link the draft to (threadId absent).
    if (threadId) {
      try {
        const promptTokens = usage.inputTokens ?? null
        const completionTokens = usage.outputTokens ?? null
        const totalTokens =
          promptTokens != null || completionTokens != null
            ? (promptTokens ?? 0) + (completionTokens ?? 0)
            : null
        await supabaseAdmin.from('ai_drafts').insert({
          workspace_id:      ctx.workspaceId,
          store_id:          storeId,
          conversation_id:   threadId,
          user_id:           user.id,
          prompt_path:       promptPath,
          suggested_text:    text.trim(),
          model:             'claude-haiku-4-5-20251001',
          prompt_tokens:     promptTokens,
          completion_tokens: completionTokens,
          total_tokens:      totalTokens,
        })
      } catch (err) {
        logger.error('[ai/reply]', 'ai_drafts insert failed', err)
      }
    }

    return NextResponse.json({ reply: text.trim(), threadId }, {
      headers: {
        'X-RateLimit-Limit': '10',
        'X-RateLimit-Remaining': String(rl.remaining),
      },
    })
  } catch (err) {
    return serviceCatchHandler(err, 'anthropic')
  }
}
