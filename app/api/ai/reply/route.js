import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { supabaseAdmin, getUserFromToken } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

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

export async function POST(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messages, threadId, language } = await request.json()

  if (!messages || messages.length === 0) {
    return NextResponse.json({ error: 'messages are required' }, { status: 400 })
  }

  // Fetch user's custom system prompt from Supabase (if configured)
  const { data: settings } = await supabaseAdmin
    .from('ai_settings')
    .select('system_prompt, brand_name')
    .eq('user_id', user.id)
    .single()

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

  const { text } = await generateText({
    model: anthropic('claude-haiku-4-5-20251001'),
    system: systemPrompt + languageInstruction,
    prompt: `Here is the full email conversation. Write a professional reply to the latest message from the customer.

${conversationContext}

---
Write only the reply body. Do not include subject lines, metadata, or explanations. Sign off as "${brandName}".`,
    maxTokens: 600,
  })

  return NextResponse.json({ reply: text.trim(), threadId })
}
