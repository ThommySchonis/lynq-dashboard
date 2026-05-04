import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// SANITY-CHECK ENDPOINT — verifies ANTHROPIC_API_KEY works end-to-end.
// Will be DELETED as part of Phase 2's first commit.
// (Also remove the matching entry in proxy.js PUBLIC_API_PREFIXES.)
export async function GET() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { ok: false, error: 'ANTHROPIC_API_KEY is not set in this environment' },
      { status: 500 }
    )
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const message = await client.messages.create({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [
        { role: 'user', content: 'Say hello in exactly 5 words' },
      ],
    })

    const text = Array.isArray(message.content)
      ? message.content
          .filter(block => block.type === 'text')
          .map(block => block.text)
          .join('')
      : null

    return NextResponse.json({
      ok:          true,
      model:       message.model,
      response:    text,
      stop_reason: message.stop_reason,
      usage:       message.usage,
    })
  } catch (err) {
    return NextResponse.json(
      {
        ok:     false,
        error:  err?.message ?? 'Unknown error',
        type:   err?.constructor?.name ?? null,
        status: err?.status ?? null,
      },
      { status: 500 }
    )
  }
}
