import type { NextRequest } from 'next/server'
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { getUserFromToken, supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import { validateBody } from '@/lib/validation'
import { translateBody } from '@/lib/schemas/translate'
import { logger } from '@/lib/logger'

interface TranslateResult {
  detectedLanguage?: string
  translatedText?: string
}

// POST /api/translate
// Body: { text: string, targetLanguage?: string }
// Returns: { translatedText, detectedLanguage, targetLanguage }
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [body, err] = await validateBody(request, translateBody)
  if (err) return err
  const { text, targetLanguage } = body

  let raw
  try {
    const result = await generateText({
      model: anthropic('claude-haiku-4-5-20251001'),
      prompt: `Detect the language of the following text and translate it to ${targetLanguage}.

Respond ONLY with a JSON object in this exact format (no markdown, no extra text):
{"detectedLanguage":"<detected language name in English>","translatedText":"<the translated text>"}

Text to translate:
${text}`,
      maxOutputTokens: 1024,
    })
    raw = result.text
    await supabaseAdmin.from('ai_usage').insert({
      route: 'translate',
      model: 'claude-haiku-4-5-20251001',
      input_tokens: result.usage.inputTokens,
      output_tokens: result.usage.outputTokens,
      cost_usd: ((result.usage.inputTokens ?? 0) * 0.0000008) + ((result.usage.outputTokens ?? 0) * 0.000004),
      user_email: user.email,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    logger.error('[translate]', 'generateText failed', { error: msg })
    return NextResponse.json({ error: `AI error: ${msg}` }, { status: 500 })
  }

  let detectedLanguage = 'Unknown'
  let translatedText = text

  try {
    // Strip markdown code blocks if Claude wraps the response
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(cleaned) as TranslateResult
    detectedLanguage = parsed.detectedLanguage || 'Unknown'
    translatedText = parsed.translatedText || text
  } catch {
    translatedText = raw?.trim() || text
  }

  return NextResponse.json({ translatedText, detectedLanguage, targetLanguage })
}
