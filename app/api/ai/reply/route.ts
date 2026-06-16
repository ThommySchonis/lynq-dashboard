import { generateText, Output } from 'ai'
import type { JSONObject } from '@ai-sdk/provider'
import { getAiModel, getAiModelId, getCachableSystemOptions } from '@/lib/ai/model'
import { computeCost } from '@/lib/ai/pricing'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { getAuthContext, requireWriteAccess } from '../../../../lib/auth'
import { checkAiSuggestLimit } from '../../../../lib/services/limit-check'
import { checkRateLimit } from '@/lib/rate-limit'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  aiAutonomyRulesConfig,
  aiReplyBody,
  DEFAULT_AUTONOMY_CONFIG,
  emmaReplyOutput,
  type AiAutonomyRulesConfig,
  type ReplyIntent,
} from '@/lib/schemas/ai'
import { resilientSdkCall } from '@/lib/resilient-fetch'
import { serviceCatchHandler } from '@/lib/service-catch-handler'
import {
  getEnabledLessons,
  getExamples,
  getOnboardingStatus,
  resolveStoreIdForThread,
} from '@/lib/services/ai-onboarding'
import type { AiExample, AiLesson, AiScenario } from '@/lib/services/ai-onboarding'
import { buildEmmaSystemPrompt } from '@/lib/services/ai-prompt-builder'
import { shouldAutoSend, type AutoSendBlockedReason } from '@/lib/services/ai-autonomy'
import { sendReply } from '@/lib/conversationEngine'
import { plainTextToSafeHtml } from '@/lib/inbox-utils'
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
  // scenarios is hoisted too so Phase 2's autonomy decision can find the row
  // matching the draft's intent without re-querying.
  let storeId: string | null = null
  let promptPath: 'emma' | 'fallback' = 'fallback'
  let scenarios: AiScenario[] = []

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
        // Lessons are best-effort — a failure here MUST NOT block Emma. We
        // wrap in a nested try so the empty-array fallback produces a prompt
        // without the Recent learnings section, and the outer Emma path
        // still benefits from the brand + policies + scenarios. The error
        // object is logged with a fixed scope; lesson_text contents are
        // never logged.
        let lessons: AiLesson[] = []
        try {
          lessons = await getEnabledLessons(storeId, ctx.workspaceId)
        } catch (err) {
          logger.error('[ai/reply]', 'lessons load failed', err)
        }
        let examples: AiExample[] = []
        try {
          examples = await getExamples(storeId, ctx.workspaceId)
        } catch (err) {
          logger.error('[ai/reply]', 'examples load failed', err)
        }
        systemPrompt = buildEmmaSystemPrompt(
          onboarding.policies,
          onboarding.scenarios,
          lessons,
          examples,
        )
        scenarios = onboarding.scenarios
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

  const userPrompt = `Here is the full email conversation. Write a professional reply to the latest message from the customer.

${conversationContext}

---
Write only the reply body. Do not include subject lines, metadata, or explanations. Sign off as "${brandName}".`

  try {
    // Emma path → structured generation (reply + classification). Fallback path
    // → existing plain-text generation, untouched. Classification metadata is
    // null unless the Emma structured call succeeds.
    let replyText = ''
    let usage: {
      inputTokens?:               number
      outputTokens?:              number
      cacheReadInputTokens?:      number
      cacheCreationInputTokens?:  number
    } = {}
    let intent: ReplyIntent | null = null
    let confidence: number | null = null
    let shouldEscalate: boolean | null = null
    let escalateReason: string | null = null

    if (promptPath === 'emma') {
      try {
        const result = await resilientSdkCall('anthropic', () =>
          generateText({
            model: getAiModel(),
            messages: [
              {
                role: 'system',
                content: systemPrompt + languageInstruction,
                providerOptions: getCachableSystemOptions() as Record<string, JSONObject>,
              },
              { role: 'user', content: userPrompt },
            ],
            maxOutputTokens: 600,
            experimental_output: Output.object({ schema: emmaReplyOutput }),
          })
        )
        const out = result.experimental_output
        replyText = out.reply
        intent = out.intent
        confidence = out.confidence
        shouldEscalate = out.should_escalate
        escalateReason = out.escalate_reason ?? null
        usage = {
          inputTokens:              result.usage.inputTokens,
          outputTokens:             result.usage.outputTokens,
          cacheReadInputTokens:     result.usage.inputTokenDetails?.cacheReadTokens,
          cacheCreationInputTokens: result.usage.inputTokenDetails?.cacheWriteTokens,
        }
      } catch (err) {
        // Structured-output failure: log (no content) and retry ONCE as plain
        // text for this call only. The draft persists null classification.
        logger.error('[ai/reply]', 'structured output failed; retrying as plain text', err)
        const result = await resilientSdkCall('anthropic', () =>
          generateText({
            model: getAiModel(),
            messages: [
              {
                role: 'system',
                content: systemPrompt + languageInstruction,
                providerOptions: getCachableSystemOptions() as Record<string, JSONObject>,
              },
              { role: 'user', content: userPrompt },
            ],
            maxOutputTokens: 600,
          })
        )
        replyText = result.text
        usage = {
          inputTokens:              result.usage.inputTokens,
          outputTokens:             result.usage.outputTokens,
          cacheReadInputTokens:     result.usage.inputTokenDetails?.cacheReadTokens,
          cacheCreationInputTokens: result.usage.inputTokenDetails?.cacheWriteTokens,
        }
      }
    } else {
      const result = await resilientSdkCall('anthropic', () =>
        generateText({
          model: getAiModel(),
          messages: [
            {
              role: 'system',
              content: systemPrompt + languageInstruction,
              providerOptions: getCachableSystemOptions() as Record<string, JSONObject>,
            },
            { role: 'user', content: userPrompt },
          ],
          maxOutputTokens: 600,
        })
      )
      replyText = result.text
      usage = {
        inputTokens:              result.usage.inputTokens,
        outputTokens:             result.usage.outputTokens,
        cacheReadInputTokens:     result.usage.inputTokenDetails?.cacheReadTokens,
        cacheCreationInputTokens: result.usage.inputTokenDetails?.cacheWriteTokens,
      }
    }

    replyText = replyText.trim()

    await supabaseAdmin.from('ai_usage').insert({
      route: 'reply',
      model: getAiModelId(),
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      cache_read_input_tokens:     usage.cacheReadInputTokens     ?? null,
      cache_creation_input_tokens: usage.cacheCreationInputTokens ?? null,
      cost_usd: computeCost(getAiModelId(), usage),
      user_email: user.email,
    })

    // Emma Phase 2 — gated auto-send. The decision runs ONLY when:
    //  • Emma path produced a structured draft (intent/confidence/should_escalate
    //    are all present — null when the structured call failed and we retried
    //    as plain text), AND
    //  • we have a storeId and a threadId (there's no autonomous-send target
    //    otherwise).
    // The fallback path is intentionally left untouched.
    //
    // Failure modes: the rules read, the decision logic, AND the send execution
    // are each wrapped in try/catch. None of them can 500 AI Suggest — the
    // worst case is that auto-send doesn't fire and the user gets the reply
    // they can manually send. No draft / policy / scenario / lesson content
    // is logged in any of these paths.
    let autoSentAt: string | null = null
    let autoSendBlockedReason: AutoSendBlockedReason | null = null
    let draftId: string | null = null

    // Narrow intent/confidence/shouldEscalate to non-null via an explicit
    // local snapshot. TypeScript can't propagate the narrowing through a
    // single `canEvaluateAutonomy` boolean, but it follows the dedicated
    // const declarations below.
    const intentLocal         = intent
    const confidenceLocal     = confidence
    const shouldEscalateLocal = shouldEscalate

    if (
      promptPath === 'emma' &&
      intentLocal         !== null &&
      confidenceLocal     !== null &&
      shouldEscalateLocal !== null &&
      storeId  !== null &&
      threadId !== undefined
    ) {
      // 0) Check store-level auto-send toggle. When off, skip autonomy entirely.
      let storeAutoSendEnabled = false
      try {
        const { data: storeRow } = await supabaseAdmin
          .from('stores')
          .select('ai_auto_send_enabled')
          .eq('id', storeId)
          .single<{ ai_auto_send_enabled: boolean }>()
        storeAutoSendEnabled = storeRow?.ai_auto_send_enabled ?? false
      } catch (err) {
        logger.error('[ai/reply]', 'store ai settings load failed', err)
      }

      if (!storeAutoSendEnabled) {
        autoSendBlockedReason = 'store_disabled'
      } else {
      // 1) Load rules — default to suggest mode on any failure.
      let rules: AiAutonomyRulesConfig = {
        master_enabled:       DEFAULT_AUTONOMY_CONFIG.master_enabled,
        confidence_threshold: DEFAULT_AUTONOMY_CONFIG.confidence_threshold,
        global_block_intents: [...DEFAULT_AUTONOMY_CONFIG.global_block_intents],
      }
      try {
        const { data, error } = await supabaseAdmin
          .from('ai_autonomy_rules')
          .select('config')
          .eq('workspace_id', ctx.workspaceId)
          .eq('store_id', storeId)
          .maybeSingle<{ config: unknown }>()
        if (error) throw error
        if (data?.config) {
          // Defensive parse — a stale row from a future trede must not crash
          // the decision logic. On schema mismatch fall back to defaults.
          const parsed = aiAutonomyRulesConfig.safeParse(data.config)
          if (parsed.success) rules = parsed.data
        }
      } catch (err) {
        logger.error('[ai/reply]', 'autonomy rules load failed', err)
      }

      // 2) Decide. Pure function — can't throw.
      const scenarioRow = scenarios.find((s) => s.scenario_key === intentLocal) ?? null
      const decision = shouldAutoSend({
        draft:    {
          intent:          intentLocal,
          confidence:      confidenceLocal,
          should_escalate: shouldEscalateLocal,
        },
        scenario: scenarioRow ? { autonomy_pct: scenarioRow.autonomy_pct } : null,
        rules,
      })

      if (decision.send) {
        // 3) Execute — reuse sendReply() from lib/conversationEngine. The
        // helper derives `to` from the conversation's customer_email and
        // `subject` from the conversation row when those fields are empty
        // (see SendReplyParams handling inside sendReply); we pass the
        // empty defaults explicitly because SendReplyParams marks all
        // fields required.
        try {
          const sendResult = await sendReply(
            ctx.workspaceId,
            threadId,
            ctx.user.email ?? '',
            {
              to:       [],
              cc:       [],
              bcc:      [],
              subject:  '',
              bodyHtml: plainTextToSafeHtml(replyText),
              bodyText: replyText,
            },
            ctx.memberId,
          )
          if (sendResult && typeof sendResult === 'object' && 'error' in sendResult) {
            // Plan-limit / ticket cap blocked the send.
            autoSendBlockedReason = 'send_failed'
            logger.error('[ai/reply]', 'auto-send blocked by sendReply error response')
          } else {
            autoSentAt = new Date().toISOString()
          }
        } catch (err) {
          autoSendBlockedReason = 'send_failed'
          logger.error('[ai/reply]', 'auto-send execution failed', err)
        }
      } else {
        autoSendBlockedReason = decision.reason
      }
      } // end else (storeAutoSendEnabled)
    }

    // Best-effort: persist the suggestion as an ai_drafts row. This must NEVER
    // affect the response — any failure is logged with a generic message (no
    // suggested_text / policy / scenario / model-output content) and swallowed.
    // Skipped when there is no conversation to link the draft to (threadId absent).
    if (threadId) {
      try {
        const promptTokens = usage.inputTokens ?? null
        const completionTokens = usage.outputTokens ?? null
        const totalTokens =
          promptTokens != null || completionTokens != null
            ? (promptTokens ?? 0) + (completionTokens ?? 0)
            : null
        const { data: insertedDraft } = await supabaseAdmin.from('ai_drafts').insert({
          workspace_id:             ctx.workspaceId,
          store_id:                 storeId,
          conversation_id:          threadId,
          user_id:                  user.id,
          prompt_path:              promptPath,
          suggested_text:           replyText,
          model:                    getAiModelId(),
          prompt_tokens:            promptTokens,
          completion_tokens:        completionTokens,
          total_tokens:             totalTokens,
          intent,
          confidence,
          should_escalate:          shouldEscalate,
          escalate_reason:          escalateReason,
          auto_sent_at:             autoSentAt,
          auto_send_blocked_reason: autoSendBlockedReason,
          status:                   autoSentAt ? 'auto_sent' : 'pending',
        }).select('id').single<{ id: string }>()
        draftId = insertedDraft?.id ?? null
      } catch (err) {
        logger.error('[ai/reply]', 'ai_drafts insert failed', err)
      }

      // Surface a review notification only when the draft awaits the agent
      // (not auto-sent). The conversation subject / customer email aren't
      // loaded in this route, so we use the generic review fallback. The
      // partial UNIQUE index on (source_type, source_id) makes this
      // idempotent. This write must never block reply generation.
      if (!autoSentAt && draftId) {
        try {
          await supabaseAdmin.from('notifications').insert({
            category:    'emma_pending_draft',
            type:        'info',
            workspace_id: ctx.workspaceId,
            title:       'Emma drafted a reply',
            body:        'A new reply is ready for your review',
            link:        `/inbox?conversation_id=${threadId}`,
            source_type: 'ai_draft',
            source_id:   draftId,
          })
        } catch (err) {
          // best-effort: never block reply generation on a notification write
          logger.error('[ai/reply]', 'notification insert failed', err)
        }
      }
    }

    // Response shape: existing { reply, threadId } unchanged. Add the
    // optional `auto_sent: true` flag ONLY when auto-send actually fired,
    // so existing UI behaviour stays backwards-compatible when absent.
    const responseBody = autoSentAt
      ? { reply: replyText, threadId, auto_sent: true, draft_id: draftId }
      : { reply: replyText, threadId, draft_id: draftId }

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
