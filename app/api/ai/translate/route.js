import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { getUserFromToken, supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { text, targetLang, detectOnly } = await request.json()
  if (!text?.trim()) return NextResponse.json({ error: 'No text provided' }, { status: 400 })

  let prompt

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

  const { text: result, usage } = await generateText({
    model: anthropic('claude-haiku-4-5-20251001'),
    prompt,
    maxTokens: 2000,
  })

  await supabaseAdmin.from('ai_usage').insert({
    route: 'translate',
    model: 'claude-haiku-4-5-20251001',
    input_tokens: usage.promptTokens,
    output_tokens: usage.completionTokens,
    cost_usd: (usage.promptTokens * 0.0000008) + (usage.completionTokens * 0.000004),
    user_email: user.email,
  }).catch(() => {})

  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch?.[0] || '{}')
    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ error: 'Parse failed' }, { status: 500 })
  }
}
