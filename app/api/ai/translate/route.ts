import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { getUserFromToken, supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { checkRateLimit } from '@/lib/rate-limit'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { aiTranslateBody } from '@/lib/schemas/ai'
import { resilientSdkCall } from '@/lib/resilient-fetch'
import { serviceCatchHandler } from '@/lib/service-catch-handler'

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
  const parsed = aiTranslateBody.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }
  const { text, targetLang, detectOnly } = parsed.data

  let prompt: string

  if (detectOnly) {
    prompt = `Detect the language of the following text. Respond ONLY with a valid JSON object, nothing else:
{"code":"<ISO 639-1 language code>","name":"<language name in English>"}

Text: "${text.slice(0, 500)}"`
  } else if (targetLang) {
    prompt = `Translate the following customer support email text to ${targetLang}. Keep the same tone and formatting. Respond ONLY with valid JSON, nothing else:
{"translated":"<translated text>","detectedLang":"<ISO 639-1 code of source language>","detectedLangName":"<English name of source language>"}

Text to translate:
${text}`
  } else {
    prompt = `Translate the following customer support email text to English. Keep the same tone and meaning. Respond ONLY with valid JSON, nothing else:
{"translated":"<English translation>","detectedLang":"<ISO 639-1 code of source language>","detectedLangName":"<English name of source language>"}

Text to translate:
${text}`
  }

  try {
    const { text: result, usage } = await resilientSdkCall('anthropic', () =>
      generateText({
        model: anthropic('claude-haiku-4-5-20251001'),
        prompt,
        maxOutputTokens: 2000,
      })
    )

    void supabaseAdmin.from('ai_usage').insert({
      route: 'translate',
      model: 'claude-haiku-4-5-20251001',
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      cost_usd: ((usage.inputTokens ?? 0) * 0.0000008) + ((usage.outputTokens ?? 0) * 0.000004),
      user_email: user.email,
    }).then(undefined, () => {})

    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/)
      const parsed = JSON.parse(jsonMatch?.[0] || '{}') as Record<string, unknown>
      return NextResponse.json(parsed, {
        headers: {
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': String(rl.remaining),
        },
      })
    } catch {
      return NextResponse.json({ error: 'Parse failed' }, { status: 500 })
    }
  } catch (err) {
    return serviceCatchHandler(err, 'anthropic')
  }
}
