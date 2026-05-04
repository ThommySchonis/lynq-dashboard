import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAuthContext } from '../../../../lib/auth'
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

const CLAUDE_MODEL = 'claude-sonnet-4-20250514'
const MAX_TOKENS   = 16000

// POST /api/macros/generate — call Claude, parse, bulk insert
export async function POST(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.manageMacros(ctx.role)) {
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
    console.error('[macros generate] onboarding lookup failed:', lookupError.message)
    return NextResponse.json({ error: lookupError.message, code: 'lookup_failed' }, { status: 500 })
  }
  if (!onboarding || !onboarding.completed_at || !onboarding.answers || Object.keys(onboarding.answers).length === 0) {
    return NextResponse.json(
      { error: 'Complete the onboarding wizard first.', code: 'onboarding_incomplete' },
      { status: 400 }
    )
  }

  // Call Claude (retry once on 429 / 5xx with 2s delay)
  const client       = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const userMessage  = buildUserMessage(onboarding.answers)

  let response
  try {
    response = await callClaudeWithRetry(client, userMessage)
  } catch (err) {
    return mapAnthropicError(err)
  }

  // Extract text content
  const text = Array.isArray(response.content)
    ? response.content.filter(b => b.type === 'text').map(b => b.text).join('')
    : ''

  // If Claude was cut off mid-response by max_tokens, the JSON will be
  // syntactically incomplete — surface a specific error before parsing
  // so the user understands the cause.
  if (response.stop_reason === 'max_tokens') {
    console.error(
      '[macros generate] hit max_tokens — output_tokens=',
      response.usage?.output_tokens,
      'response length=', text.length,
      '\n--- BEGIN TRUNCATED RESPONSE ---\n',
      text,
      '\n--- END TRUNCATED RESPONSE ---'
    )
    return NextResponse.json(
      { error: 'AI response was too long. Generating fewer macros, please retry.', code: 'max_tokens' },
      { status: 502 }
    )
  }

  // Parse JSON (with code-fence stripping + preamble extraction fallback)
  const { macros: parsed, parseError, raw } = parseMacroJson(text)
  if (!parsed || parsed.length === 0) {
    console.error(
      '[macros generate] parse failed:', parseError,
      '\n  stop_reason =', response.stop_reason,
      '\n  output_tokens =', response.usage?.output_tokens,
      '\n  response length =', text.length,
      '\n--- BEGIN RAW CLAUDE RESPONSE ---\n',
      raw,
      '\n--- END RAW CLAUDE RESPONSE ---'
    )
    return NextResponse.json(
      { error: "Couldn't parse AI response. Try again.", code: 'parse_failed' },
      { status: 502 }
    )
  }

  if (parsed.length < 40 || parsed.length > 60) {
    console.warn('[macros generate] unusual count:', parsed.length, '— accepting anyway')
  }

  // Build rows for bulk insert (single statement = atomic in Postgres)
  // Defensive: prepend "{store_name} | " if Claude forgot the prefix.
  const storeName = (onboarding.answers?.store_name ?? '').trim()
  const prefix    = storeName ? `${storeName} | ` : ''

  const rows = parsed.map(m => {
    let name = String(m.name).trim()
    if (prefix && !name.startsWith(prefix)) name = prefix + name
    return {
      workspace_id: ctx.workspaceId,
      name:         name.slice(0, 200),
      body:         String(m.body ?? '').slice(0, 100_000),
      language:     'en',
      tags:         Array.isArray(m.tags)
        ? m.tags
            .map(t => typeof t === 'string' ? t.trim().toLowerCase().slice(0, 40) : '')
            .filter(Boolean)
            .slice(0, 25)
        : [],
      created_by:   ctx.user.id,
    }
  })

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('macros')
    .insert(rows)
    .select('id, name, language, tags, created_at')

  if (insertError) {
    console.error('[macros generate] bulk insert failed:', insertError.message)
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
      new Set(rows.flatMap(r => Array.isArray(r.tags) ? r.tags : []))
    )
    if (allTagNames.length > 0 && inserted && inserted.length > 0) {
      const tagMap = await ensureTagsByName(supabaseAdmin, ctx.workspaceId, allTagNames, ctx.user.id)
      const links  = []
      for (const row of inserted) {
        const macroSourceTags = rows.find(r => r.name === row.name)?.tags || []
        for (const name of macroSourceTags) {
          const tagId = tagMap.get(name.toLowerCase())
          if (tagId) links.push({ macro_id: row.id, tag_id: tagId })
        }
      }
      if (links.length > 0) {
        const { error: linkError } = await supabaseAdmin.from('macro_tags').insert(links)
        if (linkError) console.error('[macros generate] macro_tags insert failed:', linkError.message)
      }
    }
  } catch (e) {
    console.error('[macros generate] tag sync failed (macros themselves were created):', e.message)
  }

  // Update onboarding bookkeeping
  await supabaseAdmin
    .from('macro_onboarding')
    .update({
      last_generated_at: new Date().toISOString(),
      generation_count:  (onboarding.generation_count ?? 0) + 1,
    })
    .eq('id', onboarding.id)
    .eq('workspace_id', ctx.workspaceId)

  const cost = calculateCost(response.usage)
  console.log(
    `[macros][generate] workspace=${ctx.workspaceId} input=${cost.input_tokens} output=${cost.output_tokens} cost=$${cost.estimated_cost_usd.toFixed(4)} count=${inserted?.length ?? 0}`
  )

  return NextResponse.json({
    ok:    true,
    count: inserted?.length ?? 0,
    cost,
  })
}

// ── helpers ──────────────────────────────────────────────────

async function callClaudeWithRetry(client, userMessage) {
  try {
    return await client.messages.create({
      model:      CLAUDE_MODEL,
      max_tokens: MAX_TOKENS,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: userMessage }],
    })
  } catch (err) {
    if (isRetryable(err)) {
      console.warn('[macros generate] retrying after 2s, status =', err?.status)
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

function isRetryable(err) {
  const s = err?.status ?? 0
  return s === 429 || (s >= 500 && s < 600)
}

function mapAnthropicError(err) {
  const status = err?.status ?? 0
  const msg    = err?.message ?? 'Unknown error'
  console.error('[macros generate] Anthropic error:', status, msg)

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
