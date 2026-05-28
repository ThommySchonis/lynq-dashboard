/**
 * Verification script for the AI Suggest counter wiring.
 *
 * Usage:
 *   npx tsx scripts/verify-ai-suggest-counter.ts <workspace-uuid>
 *
 * Reads the current usage_counters row for the given workspace, calls
 * incrementAISuggestUsage() once, re-reads, and asserts that
 * (ai_suggest_used + ai_suggest_overage) increased by exactly 1.
 *
 * Mutates one row in usage_counters. Run against a TEST workspace —
 * not a real billing tenant — or accept a one-call usage bump.
 *
 * Requires the same env vars as the rest of the server runtime
 * (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY). The script never
 * prints them.
 */

import { supabaseAdmin } from '../lib/supabaseAdmin'
import { incrementAISuggestUsage } from '../lib/usage'

interface CounterRow {
  id:                 string
  ai_suggest_used:    number
  ai_suggest_overage: number
}

async function readCounter(workspaceId: string): Promise<CounterRow | null> {
  const nowIso = new Date().toISOString()
  const { data, error } = await supabaseAdmin
    .from('usage_counters')
    .select('id, ai_suggest_used, ai_suggest_overage')
    .eq('workspace_id', workspaceId)
    .lte('period_start', nowIso)
    .order('period_start', { ascending: false })
    .limit(1)
    .maybeSingle<CounterRow>()

  if (error) {
    throw new Error(`usage_counters read failed: ${error.message}`)
  }
  return data
}

async function main(): Promise<void> {
  const workspaceId = process.argv[2]
  if (!workspaceId) {
    console.error('usage: npx tsx scripts/verify-ai-suggest-counter.ts <workspace-uuid>')
    process.exit(2)
  }

  const before = await readCounter(workspaceId)
  if (!before) {
    console.error(`no current-period usage_counters row for workspace ${workspaceId}`)
    process.exit(3)
  }
  const totalBefore = before.ai_suggest_used + before.ai_suggest_overage

  const result = await incrementAISuggestUsage(workspaceId)

  const after = await readCounter(workspaceId)
  if (!after) {
    console.error('counter row vanished between reads — investigate')
    process.exit(4)
  }
  const totalAfter = after.ai_suggest_used + after.ai_suggest_overage

  const delta = totalAfter - totalBefore
  console.log(`workspace:    ${workspaceId}`)
  console.log(`counter id:   ${before.id}`)
  console.log(`before:       used=${before.ai_suggest_used}  overage=${before.ai_suggest_overage}`)
  console.log(`after:        used=${after.ai_suggest_used}  overage=${after.ai_suggest_overage}`)
  console.log(`result:       counted=${result.counted}  overage=${result.overage}`)
  console.log(`delta:        ${delta}`)

  if (delta !== 1) {
    console.error(`FAIL — expected delta of 1, got ${delta}`)
    process.exit(1)
  }
  console.log('PASS — counter incremented by 1')
}

main().catch(err => {
  console.error('error:', err instanceof Error ? err.message : err)
  process.exit(1)
})
