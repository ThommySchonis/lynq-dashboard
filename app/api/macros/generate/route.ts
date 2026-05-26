import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Role } from '@/types/database'
import Anthropic from '@anthropic-ai/sdk'
import type { Message, TextBlock } from '@anthropic-ai/sdk/resources/messages'
import { getAuthContext, requireWriteAccess } from '../../../../lib/auth'
import { can } from '../../../../lib/permissions'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import {
  SYSTEM_PROMPT,
  buildUserMessage,
  parseMacroJson,
  calculateCost,
  sleep,
} from '../../../../lib/aiMacros'
import { ensureTagsByName } from '../../../../lib/tags'
import { logger } from '@/lib/logger'

interface AnthropicStatusError {
  status?: number
  message?: string
}

const CLAUDE_MODEL = 'claude-sonnet-4-20250514'
const MAX_TOKENS   = 16000

// POST /api/macros/generate — call Claude, parse, bulk insert
export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const blocked = requireWriteAccess(ctx)
  if (blocked) return blocked
  if (!can.manageMacros(ctx.role as Role)) {
    return NextResponse.json({ error: 'You do not have permission to generate macros.', code: 'permission_denied' }, { status: 403 })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI service unavailable. Contact support.', code: 'ai_auth' }, { status: 500 })
  }

  // Load latest onboarding for this workspace
  const { data: onboarding, error: lookupError } = await supabaseAdmin
    .from('macro_onboarding')
    .select('id, answers, completed_at, generation_count')
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  if (lookupError) {
    logger.error('[macros/generate]', 'onboarding lookup failed', { error: lookupError.message })
    return NextResponse.json({ error: lookupError.message, code: 'lookup_failed' }, { status: 500 })
  }
  interface OnboardingRow { id: string; answers: Record<string, unknown>; completed_at: string | null; generation_count: number }
  const ob = onboarding as OnboardingRow | null
  if (!ob || !ob.completed_at || !ob.answers || Object.keys(ob.answers).length === 0) {
    return NextResponse.json(
      { error: 'Complete the onboarding wizard first.', code: 'onboarding_incomplete' },
      { status: 400 }
    )
  }

  // Call Claude (retry once on 429 / 5xx with 2s delay)
  const client       = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const userMessage  = buildUserMessage(ob.answers as Parameters<typeof buildUserMessage>[0])

  let response: Message
  try {
    response = await callClaudeWithRetry(client, userMessage)
  } catch (err: unknown) {
    return mapAnthropicError(err)
  }

  // Extract text content
  const text = Array.isArray(response.content)
    ? response.content.filter(b => b.type === 'text').map(b => (b as TextBlock).text).join('')
    : ''

  // If Claude was cut off mid-response by max_tokens, the JSON will be
  // syntactically incomplete — surface a specific error before parsing
  // so the user understands the cause.
  if (response.stop_reason === 'max_tokens') {
    logger.error('[macros/generate]', 'hit max_tokens', { outputTokens: response.usage?.output_tokens, responseLength: text.length, truncatedResponse: text })
    return NextResponse.json(
      { error: 'AI response was too long. Generating fewer macros, please retry.', code: 'max_tokens' },
      { status: 502 }
    )
  }

  // Parse JSON (with code-fence stripping + preamble extraction fallback)
  const { macros: parsed, parseError, raw } = parseMacroJson(text)
  if (!parsed || parsed.length === 0) {
    logger.error('[macros/generate]', 'parse failed', { parseError, stopReason: response.stop_reason, outputTokens: response.usage?.output_tokens, responseLength: text.length, rawResponse: raw })
    return NextResponse.json(
      { error: "Couldn't parse AI response. Try again.", code: 'parse_failed' },
      { status: 502 }
    )
  }

  if (parsed.length < 40 || parsed.length > 60) {
    logger.warn('[macros/generate]', 'unusual count — accepting anyway', { count: parsed.length })
  }

  // Build rows for bulk insert (single statement = atomic in Postgres)
  // Defensive: prepend "{store_name} | " if Claude forgot the prefix.
  const storeName = (String(ob.answers?.store_name ?? '')).trim()
  const prefix    = storeName ? `${storeName} | ` : ''

  const rows = parsed.map((m: { name: unknown; body?: unknown; tags?: unknown[] }) => {
    let name = String(m.name).trim()
    if (prefix && !name.startsWith(prefix)) name = prefix + name
    return {
      workspace_id: ctx.workspaceId,
      name:         name.slice(0, 200),
      body:         String(m.body ?? '').slice(0, 100_000),
      language:     'en',
      tags:         Array.isArray(m.tags)
        ? m.tags
            .map((t: unknown) => typeof t === 'string' ? t.trim().toLowerCase().slice(0, 40) : '')
            .filter(Boolean)
            .slice(0, 25)
        : [],
      created_by:   ctx.user.id,
    }
  })

  interface InsertedMacro { id: string; name: string; language: string; tags: string[]; created_at: string }
  const insertResult = await supabaseAdmin
    .from('macros')
    .insert(rows)
    .select('id, name, language, tags, created_at')

  const inserted = (insertResult.data || []) as InsertedMacro[]
  const insertError = insertResult.error

  if (insertError) {
    logger.error('[macros/generate]', 'bulk insert failed', { error: insertError.message })
    return NextResponse.json(
      { error: 'Saved 0 macros. Try again.', code: 'db_failed' },
      { status: 500 }
    )
  }

  // Sync macro_tags — ensure each tag string exists in the tags table,
  // then bulk-insert the (macro_id, tag_id) join rows in one statement.
  // Failure here doesn't undo the macro insert; tags will be re-synced
  // on next individual edit. We log and continue.
  try {
    const allTagNames = Array.from(
      new Set(rows.flatMap((r: { tags: string[] }) => Array.isArray(r.tags) ? r.tags : []))
    )
    if (allTagNames.length > 0 && inserted.length > 0) {
      const tagMap = await ensureTagsByName(supabaseAdmin, ctx.workspaceId, allTagNames, ctx.user.id)
      const links  = []
      for (const row of inserted) {
        const macroSourceTags = rows.find((r: { name: string; tags: string[] }) => r.name === row.name)?.tags || []
        for (const name of macroSourceTags) {
          const tagId = tagMap.get(name.toLowerCase())
          if (tagId) links.push({ macro_id: row.id, tag_id: tagId })
        }
      }
      if (links.length > 0) {
        const { error: linkError } = await supabaseAdmin.from('macro_tags').insert(links)
        if (linkError) logger.error('[macros/generate]', 'macro_tags insert failed', { error: linkError.message })
      }
    }
  } catch (err: unknown) {
    logger.error('[macros/generate]', 'tag sync failed (macros themselves were created)', { error: err instanceof Error ? err.message : 'Unknown error' })
  }

  // Update onboarding bookkeeping
  await supabaseAdmin
    .from('macro_onboarding')
    .update({
      last_generated_at: new Date().toISOString(),
      generation_count:  (ob.generation_count ?? 0) + 1,
    })
    .eq('id', ob.id)
    .eq('workspace_id', ctx.workspaceId)

  const cost = calculateCost(response.usage)
  logger.info('[macros/generate]', 'generation complete', { workspaceId: ctx.workspaceId, inputTokens: cost.input_tokens, outputTokens: cost.output_tokens, estimatedCostUsd: cost.estimated_cost_usd, count: inserted.length })

  return NextResponse.json({
    ok:    true,
    count: inserted.length,
    cost,
  })
}

// ── helpers ──────────────────────────────────────────────────

async function callClaudeWithRetry(client: Anthropic, userMessage: string): Promise<Message> {
  try {
    return await client.messages.create({
      model:      CLAUDE_MODEL,
      max_tokens: MAX_TOKENS,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: userMessage }],
    })
  } catch (err: unknown) {
    if (isRetryable(err)) {
      const e = err as AnthropicStatusError
      logger.warn('[macros/generate]', 'retrying after 2s', { status: e?.status })
      await sleep(2000)
      return await client.messages.create({
        model:      CLAUDE_MODEL,
        max_tokens: MAX_TOKENS,
        system:     SYSTEM_PROMPT,
        messages:   [{ role: 'user', content: userMessage }],
      })
    }
    throw err
  }
}

function isRetryable(err: unknown): boolean {
  const s = (err as AnthropicStatusError)?.status ?? 0
  return s === 429 || (s >= 500 && s < 600)
}

function mapAnthropicError(err: unknown) {
  const e      = err as AnthropicStatusError
  const status = e?.status ?? 0
  const msg    = e?.message ?? 'Unknown error'
  logger.error('[macros/generate]', 'Anthropic error', { status, error: msg })

  if (status === 401) {
    return NextResponse.json({ error: 'AI service unavailable. Contact support.', code: 'ai_auth' }, { status: 500 })
  }
  if (status === 400) {
    return NextResponse.json({ error: "Couldn't generate macros. Try again.", code: 'ai_invalid' }, { status: 400 })
  }
  if (status === 429 || (status >= 500 && status < 600)) {
    return NextResponse.json({ error: "AI service is busy. Try again in a minute.", code: 'ai_busy' }, { status: 503 })
  }
  if (/timeout|ETIMEDOUT|aborted/i.test(msg)) {
    return NextResponse.json({ error: 'AI took too long. Try again.', code: 'timeout' }, { status: 504 })
  }
  return NextResponse.json({ error: msg, code: 'ai_error' }, { status: 502 })
}
