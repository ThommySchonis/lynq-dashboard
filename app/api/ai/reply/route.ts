import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { getAuthContext } from '../../../../lib/auth'
import { checkAiSuggestLimit } from '../../../../lib/services/limit-check'
import { checkRateLimit } from '@/lib/rate-limit'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { aiReplyBody } from '@/lib/schemas/ai'

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
  const systemPrompt = settings?.system_prompt || DEFAULT_SYSTEM_PROMPT
  const brandName = settings?.brand_name || 'Support Team'

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

  const { text, usage } = await generateText({
    model: anthropic('claude-haiku-4-5-20251001'),
    system: systemPrompt + languageInstruction,
    prompt: `Here is the full email conversation. Write a professional reply to the latest message from the customer.

${conversationContext}

---
Write only the reply body. Do not include subject lines, metadata, or explanations. Sign off as "${brandName}".`,
    maxOutputTokens: 600,
  })

  await supabaseAdmin.from('ai_usage').insert({
    route: 'reply',
    model: 'claude-haiku-4-5-20251001',
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    cost_usd: ((usage.inputTokens ?? 0) * 0.0000008) + ((usage.outputTokens ?? 0) * 0.000004),
    user_email: user.email,
  })

  return NextResponse.json({ reply: text.trim(), threadId }, {
    headers: {
      'X-RateLimit-Limit': '10',
      'X-RateLimit-Remaining': String(rl.remaining),
    },
  })
}
