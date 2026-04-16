import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { getUserFromToken } from '../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

// POST /api/translate
// Body: { text: string, targetLanguage?: string }
// Returns: { translatedText, detectedLanguage, targetLanguage }
export async function POST(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { text, targetLanguage = 'English' } = await request.json()
  if (!text?.trim()) return NextResponse.json({ error: 'text required' }, { status: 400 })

  let raw
  try {
    const result = await generateText({
      model: anthropic('claude-haiku-4-5-20251001'),
      prompt: `Detect the language of the following text and translate it to ${targetLanguage}.

Respond ONLY with a JSON object in this exact format (no markdown, no extra text):
{"detectedLanguage":"<detected language name in English>","translatedText":"<the translated text>"}

Text to translate:
${text}`,
      maxTokens: 1024,
    })
    raw = result.text
  } catch (err) {
    console.error('[translate] generateText failed:', err?.message || err)
    return NextResponse.json({ error: 'AI error: ' + (err?.message || 'unknown') }, { status: 500 })
  }

  let detectedLanguage = 'Unknown'
  let translatedText = text

  try {
    // Strip markdown code blocks if Claude wraps the response
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(cleaned)
    detectedLanguage = parsed.detectedLanguage || 'Unknown'
    translatedText = parsed.translatedText || text
  } catch {
    translatedText = raw?.trim() || text
  }

  return NextResponse.json({ translatedText, detectedLanguage, targetLanguage })
}
