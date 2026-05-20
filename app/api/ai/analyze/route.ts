import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { getUserFromToken, supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { checkRateLimit } from '@/lib/rate-limit'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { aiAnalyzeBody } from '@/lib/schemas/ai'

interface AnalyzeResult {
  results?: Record<string, unknown>
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  const prompt = `You are a customer support triage AI for an e-commerce dropshipping store. Analyze these support emails and classify each one.

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

  const { text, usage } = await generateText({
    model: anthropic('claude-haiku-4-5-20251001'),
    prompt,
    maxOutputTokens: 1200,
  })

  const { error: usageErr } = await supabaseAdmin.from('ai_usage').insert({
    route: 'analyze',
    model: 'claude-haiku-4-5-20251001',
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    cost_usd: ((usage.inputTokens ?? 0) * 0.0000008) + ((usage.outputTokens ?? 0) * 0.000004),
    user_email: user.email,
  })
  if (usageErr) console.error('[ai/analyze] usage log failed:', usageErr.message)

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
}
