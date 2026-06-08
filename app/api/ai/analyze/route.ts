import { generateText } from 'ai'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { getAuthContext } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { aiAnalyzeBody } from '@/lib/schemas/ai'
import { logger } from '@/lib/logger'
import { resilientSdkCall } from '@/lib/resilient-fetch'
import { serviceCatchHandler } from '@/lib/service-catch-handler'
import { getAiModel, getAiModelId } from '@/lib/ai/model'
import { computeCost } from '@/lib/ai/pricing'
import { loadWorkspaceBrandContext, buildBrandContextLine } from '@/lib/ai/brand-context'

interface AnalyzeResult {
  results?: Record<string, unknown>
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = ctx.user

  const rl = checkRateLimit(`user:${user.id}:ai`, 10, 60_000)
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

  const raw: unknown = await request.json().catch(() => ({}))
  const parsed = aiAnalyzeBody.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ analyses: {} })
  }
  const { threads } = parsed.data

  const policies = await loadWorkspaceBrandContext(ctx.workspaceId)
  const brandLine = buildBrandContextLine(policies)

  const promptBody = `You are a customer support triage AI for an e-commerce dropshipping store. Analyze these support emails and classify each one.

For each email return:
- urgency: one of "critical" | "high" | "medium" | "low"
  - critical = angry customer, threatening chargeback, fraud accusation, threatening legal action, extremely hostile tone
  - high = refund request, wrong item received, damaged product, order never arrived, package lost
  - medium = tracking question, delivery delay question, size exchange, order status (WISMO)
  - low = general question, product information, compliment, shipping info
- intent: short label (max 4 words), e.g. "Refund request", "Order not received", "Wrong item", "Tracking request", "Exchange request", "Delivery delay", "Complaint", "General inquiry", "Damaged item"
- tags: array, pick all that apply from: ["refund","not-received","wrong-item","damaged","tracking","exchange","complaint","angry","urgent","chargeback"]
- urgencyReason: one short sentence explaining the urgency classification

Return ONLY a valid JSON object, no markdown, no explanation:
{"results":{"<id>":{"urgency":"...","intent":"...","tags":[...],"urgencyReason":"..."}}}

Emails:
${threads.slice(0, 25).map(t => `ID: ${t.id}\nSubject: ${t.subject || '(no subject)'}\nPreview: ${t.snippet || ''}`).join('\n\n')}`

  const prompt = brandLine ? `${brandLine}\n\n${promptBody}` : promptBody

  try {
    const { text, usage } = await resilientSdkCall('anthropic', () =>
      generateText({
        model: getAiModel(),
        prompt,
        maxOutputTokens: 1200,
      })
    )

    const { error: usageErr } = await supabaseAdmin.from('ai_usage').insert({
      route: 'analyze',
      model: getAiModelId(),
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      cost_usd: computeCost(getAiModelId(), usage),
      user_email: user.email,
    })
    if (usageErr) logger.error('[ai/analyze]', 'usage log failed', { error: usageErr.message })

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      const parsed = JSON.parse(jsonMatch?.[0] || '{}') as AnalyzeResult
      return NextResponse.json({ analyses: parsed.results || {} }, {
        headers: {
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': String(rl.remaining),
        },
      })
    } catch {
      return NextResponse.json({ analyses: {} })
    }
  } catch (err) {
    return serviceCatchHandler(err, 'anthropic', {
      fallbackData: { analyses: {} },
    })
  }
}
