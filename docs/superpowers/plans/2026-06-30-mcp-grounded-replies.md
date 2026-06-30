# MCP Grounded Replies (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the MCP agent a one-call grounding tool, autonomy-enforced sending, member listing, and MCP-tagged draft tracking — so it composes on-brand, policy-safe replies without bypassing workspace rules.

**Architecture:** The connecting agent writes reply text; MCP provides grounding (`get_reply_context`) and enforces the workspace's autonomy rules at send time by reusing the in-app `shouldAutoSend()` gate. Blocked sends fall back to a draft. MCP activity is recorded as `ai_drafts` rows tagged `prompt_path='mcp'` (no `ai_usage` — not an Emma charge). Tools stay thin wrappers; logic lives in `lib/services/`.

**Tech Stack:** TypeScript, Next.js 16, `@modelcontextprotocol/sdk`, Zod, Supabase (admin client), Vitest.

## Global Constraints

- **No git steps.** Per `CLAUDE.local.md`, this plan contains NO commit/push steps. Committing is a separate user-initiated action.
- **TypeScript only, no `any`.** Use `unknown`/specific interfaces. ESLint-enforced.
- **`@/` import alias** for all imports — no `../../` relative paths.
- **Workspace scoping:** every Supabase query touching a `workspace_id` table must filter by `ctx.workspaceId`.
- **Service layer:** MCP tools are thin wrappers (permission check + arg marshalling + service call + `ok`/`fail`). All logic in `lib/services/`.
- **Tests don't type-check.** After all tasks, `npx tsc --noEmit` AND `npm run lint` must both pass.
- **Valid intents (`REPLY_INTENTS`, exact):** `wismo`, `long_delivery`, `lost_package`, `wrong_or_damaged`, `refund_or_cancel`, `customs_fees`, `angry_or_chargeback`, `other`, `unknown`. Import from `@/lib/schemas/ai`; never re-declare.
- **Test convention:** mock service modules with `vi.mock`, capture registered tools via a `fakeServer()` whose `registerTool(name, _cfg, handler)` stores `{ handler }`, then invoke `handler(args)`. Mirror `mcp/tools/inbox.test.ts` and `mcp/tools/emma.test.ts`.

---

## File Structure

- `supabase/migrations/20260630120000_ai_drafts_mcp.sql` — **create.** Extend `ai_drafts.prompt_path` CHECK to include `'mcp'`; extend `auto_send_blocked_reason` CHECK to include `'store_disabled'`.
- `lib/services/mcp-autonomy-gate.ts` — **create.** `loadAutonomyConfig()` + `evaluateMcpSend()`. Reuses `shouldAutoSend`.
- `lib/services/mcp-autonomy-gate.test.ts` — **create.**
- `lib/services/mcp-reply-record.ts` — **create.** `recordMcpDraft()` — best-effort `ai_drafts` insert tagged `'mcp'`.
- `lib/services/mcp-reply-record.test.ts` — **create.**
- `lib/services/mcp-reply-context.ts` — **create.** `rankMacros()` (pure) + `buildReplyContext()`.
- `lib/services/mcp-reply-context.test.ts` — **create.**
- `mcp/tools/context.ts` — **create.** `registerContextTools()` → `get_reply_context`.
- `mcp/tools/context.test.ts` — **create.**
- `mcp/tools/inbox.ts` — **modify.** `send_reply` autonomy enforcement; add `list_members`.
- `mcp/tools/inbox.test.ts` — **modify.** Add cases.
- `mcp/server.ts` — **modify.** Register context tools.
- `mcp/instructions.ts` — **modify.** Teach the new loop.

---

## Task 1: Migration — `ai_drafts` accepts `'mcp'` and `'store_disabled'`

**Files:**
- Create: `supabase/migrations/20260630120000_ai_drafts_mcp.sql`

**Interfaces:**
- Produces: `ai_drafts.prompt_path` may be `'mcp'`; `ai_drafts.auto_send_blocked_reason` may be `'store_disabled'`. Consumed by Task 4 (`recordMcpDraft`) and Task 3 (`evaluateMcpSend` returns `'store_disabled'`).

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260630120000_ai_drafts_mcp.sql`:

```sql
-- ============================================================
-- ai_drafts — allow MCP-sourced drafts and the store_disabled
-- block reason.
--   • prompt_path gains 'mcp' so agent-composed replies are
--     distinguishable from Emma ('emma') and legacy ('fallback').
--   • auto_send_blocked_reason gains 'store_disabled' — the app's
--     own emma-generate path already emits this reason but the
--     original CHECK omitted it, so those rows silently failed to
--     persist. This fixes that latent gap too.
-- ============================================================

ALTER TABLE public.ai_drafts DROP CONSTRAINT IF EXISTS ai_drafts_prompt_path_check;
ALTER TABLE public.ai_drafts
  ADD CONSTRAINT ai_drafts_prompt_path_check
  CHECK (prompt_path IN ('emma', 'fallback', 'mcp'));

ALTER TABLE public.ai_drafts DROP CONSTRAINT IF EXISTS ai_drafts_auto_send_blocked_reason_check;
ALTER TABLE public.ai_drafts
  ADD CONSTRAINT ai_drafts_auto_send_blocked_reason_check
  CHECK (auto_send_blocked_reason IN ('master_off','blocked_intent','scenario_locked','emma_escalate','confidence_low','send_failed','store_disabled'));
```

- [ ] **Step 2: Verify the constraint names match the originals**

Run: `grep -n "prompt_path\|auto_send_blocked_reason" supabase/migrations/20260531000000_ai_drafts.sql supabase/migrations/20260602000000_ai_drafts_autosend.sql`
Expected: confirms the original columns exist. The original CHECKs are inline (auto-named `ai_drafts_prompt_path_check` / `ai_drafts_auto_send_blocked_reason_check` by Postgres convention `<table>_<column>_check`). The `DROP CONSTRAINT IF EXISTS` lines are safe even if a name differs slightly — if the grep shows a differently-named constraint, update the `DROP` lines to match before applying.

- [ ] **Step 3: Checkpoint**

Migration is not applied here (applying/pushing is a separate user action). The file exists and is the single source of the new allowed values.

---

## Task 2: `rankMacros()` — relevance ranking for templates

**Files:**
- Create: `lib/services/mcp-reply-context.ts`
- Test: `lib/services/mcp-reply-context.test.ts`

**Interfaces:**
- Consumes: `MacroSummary` from `@/lib/services/macros` (`{ id, name, body, language, tags, archived }`).
- Produces: `rankMacros(macros: MacroSummary[], opts: { language?: string; text: string }): RankedMacro[]` where `RankedMacro = MacroSummary & { score: number }`, sorted score-descending. Consumed by Task 5 (`buildReplyContext`).

- [ ] **Step 1: Write the failing test**

Create `lib/services/mcp-reply-context.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { rankMacros } from '@/lib/services/mcp-reply-context'
import type { MacroSummary } from '@/lib/services/macros'

function macro(p: Partial<MacroSummary> & { id: string }): MacroSummary {
  return { name: '', body: '', language: 'en', tags: [], archived: false, ...p }
}

describe('rankMacros', () => {
  it('ranks keyword-overlapping macros above unrelated ones', () => {
    const macros = [
      macro({ id: 'a', name: 'Refund policy', body: 'We process refunds within 14 days', tags: ['refund'] }),
      macro({ id: 'b', name: 'Welcome', body: 'Thanks for shopping with us' }),
    ]
    const ranked = rankMacros(macros, { text: 'I want a refund for my order', language: 'en' })
    expect(ranked[0].id).toBe('a')
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score)
  })

  it('adds a language-match bonus', () => {
    const macros = [
      macro({ id: 'en1', language: 'en', name: 'Hello' }),
      macro({ id: 'de1', language: 'de', name: 'Hello' }),
    ]
    const ranked = rankMacros(macros, { text: 'unrelated', language: 'en' })
    expect(ranked[0].id).toBe('en1')
  })

  it('returns all macros with a numeric score even at zero overlap', () => {
    const macros = [macro({ id: 'x', name: 'Zzz', body: 'qqq' })]
    const ranked = rankMacros(macros, { text: 'nothing matches here', language: 'fr' })
    expect(ranked).toHaveLength(1)
    expect(typeof ranked[0].score).toBe('number')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/services/mcp-reply-context.test.ts`
Expected: FAIL — `rankMacros` is not exported / module has no such member.

- [ ] **Step 3: Write the implementation**

Create `lib/services/mcp-reply-context.ts` (only the ranking parts for now; `buildReplyContext` is added in Task 5):

```ts
import type { MacroSummary } from '@/lib/services/macros'

export type RankedMacro = MacroSummary & { score: number }

// Lowercased word tokens of length >= 3, deduped. Text is capped so a huge
// thread can't blow up the comparison.
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .slice(0, 4000)
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter((w) => w.length >= 3),
  )
}

/**
 * Rank macros by relevance to a conversation. +2 for a language match,
 * +1 per overlapping keyword between the conversation text and the macro's
 * name + tags + body. Stable sort, score-descending. Never filters anything
 * out — callers slice the top N.
 */
export function rankMacros(
  macros: MacroSummary[],
  opts: { language?: string; text: string },
): RankedMacro[] {
  const words = tokenize(opts.text)
  return macros
    .map((m) => {
      let score = 0
      if (opts.language && m.language === opts.language) score += 2
      const hay = tokenize(`${m.name} ${m.tags.join(' ')} ${m.body}`)
      for (const w of words) if (hay.has(w)) score += 1
      return { ...m, score }
    })
    .sort((a, b) => b.score - a.score)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/services/mcp-reply-context.test.ts`
Expected: PASS (3 tests).

---

## Task 3: Autonomy gate — `loadAutonomyConfig()` + `evaluateMcpSend()`

**Files:**
- Create: `lib/services/mcp-autonomy-gate.ts`
- Test: `lib/services/mcp-autonomy-gate.test.ts`

**Interfaces:**
- Consumes: `shouldAutoSend`, `AutoSendBlockedReason` from `@/lib/services/ai-autonomy`; `aiAutonomyRulesConfig`, `DEFAULT_AUTONOMY_CONFIG`, `AiAutonomyRulesConfig`, `ReplyIntent` from `@/lib/schemas/ai`; `resolveStoreIdForThread`, `getOnboardingStatus` from `@/lib/services/ai-onboarding`; `supabaseAdmin` from `@/lib/supabaseAdmin`.
- Produces:
  - `loadAutonomyConfig(workspaceId: string, storeId: string): Promise<{ rules: AiAutonomyRulesConfig; storeAutoSendEnabled: boolean }>`
  - `evaluateMcpSend(params: { workspaceId: string; conversationId: string; intent: ReplyIntent; confidence: number; shouldEscalate: boolean }): Promise<{ allowed: boolean; reason: AutoSendBlockedReason | null; storeId: string | null }>`
  - Both consumed by Tasks 5, 6, 7.

- [ ] **Step 1: Write the failing test**

Create `lib/services/mcp-autonomy-gate.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const resolveStoreIdForThread = vi.fn()
const getOnboardingStatus = vi.fn()
vi.mock('@/lib/services/ai-onboarding', () => ({
  resolveStoreIdForThread: (...a: unknown[]): unknown => resolveStoreIdForThread(...a),
  getOnboardingStatus: (...a: unknown[]): unknown => getOnboardingStatus(...a),
}))

// Table-dispatch Supabase mock: each table resolves to a canned single/maybeSingle row.
const tableData: Record<string, { data: unknown }> = {}
vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from(table: string) {
      const result = tableData[table] ?? { data: null }
      const b: Record<string, unknown> = {}
      b.select = () => b
      b.eq = () => b
      b.single = () => Promise.resolve(result)
      b.maybeSingle = () => Promise.resolve(result)
      return b
    },
  },
}))

import { evaluateMcpSend } from '@/lib/services/mcp-autonomy-gate'

beforeEach(() => {
  resolveStoreIdForThread.mockReset()
  getOnboardingStatus.mockReset()
  for (const k of Object.keys(tableData)) delete tableData[k]
})

function setup(opts: {
  storeId?: string | null
  autoSend?: boolean
  rules?: unknown
  scenarios?: Array<{ scenario_key: string; autonomy_pct: number | null }>
}) {
  resolveStoreIdForThread.mockResolvedValue(opts.storeId ?? 's1')
  tableData['stores'] = { data: { ai_auto_send_enabled: opts.autoSend ?? true } }
  tableData['ai_autonomy_rules'] = { data: opts.rules ? { config: opts.rules } : null }
  getOnboardingStatus.mockResolvedValue({ isComplete: true, policies: {}, scenarios: opts.scenarios ?? [] })
}

describe('evaluateMcpSend', () => {
  it('blocks store_disabled when the store toggle is off', async () => {
    setup({ autoSend: false })
    const d = await evaluateMcpSend({ workspaceId: 'w1', conversationId: 'c1', intent: 'wismo', confidence: 1, shouldEscalate: false })
    expect(d).toEqual({ allowed: false, reason: 'store_disabled', storeId: 's1' })
  })

  it('blocks store_disabled when no store resolves', async () => {
    setup({ storeId: null })
    const d = await evaluateMcpSend({ workspaceId: 'w1', conversationId: 'c1', intent: 'wismo', confidence: 1, shouldEscalate: false })
    expect(d).toEqual({ allowed: false, reason: 'store_disabled', storeId: null })
  })

  it('blocks blocked_intent for a globally blocked intent', async () => {
    setup({ rules: { master_enabled: true, confidence_threshold: 0.5, global_block_intents: ['refund_or_cancel'] } })
    const d = await evaluateMcpSend({ workspaceId: 'w1', conversationId: 'c1', intent: 'refund_or_cancel', confidence: 1, shouldEscalate: false })
    expect(d.allowed).toBe(false)
    expect(d.reason).toBe('blocked_intent')
  })

  it('blocks confidence_low when confidence is under the threshold', async () => {
    setup({ rules: { master_enabled: true, confidence_threshold: 0.9, global_block_intents: [] } })
    const d = await evaluateMcpSend({ workspaceId: 'w1', conversationId: 'c1', intent: 'wismo', confidence: 0.3, shouldEscalate: false })
    expect(d.reason).toBe('confidence_low')
  })

  it('allows a confident, unblocked send', async () => {
    setup({ rules: { master_enabled: true, confidence_threshold: 0.5, global_block_intents: [] }, scenarios: [{ scenario_key: 'wismo', autonomy_pct: 50 }] })
    const d = await evaluateMcpSend({ workspaceId: 'w1', conversationId: 'c1', intent: 'wismo', confidence: 0.95, shouldEscalate: false })
    expect(d).toEqual({ allowed: true, reason: null, storeId: 's1' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/services/mcp-autonomy-gate.test.ts`
Expected: FAIL — `evaluateMcpSend` not exported.

- [ ] **Step 3: Write the implementation**

Create `lib/services/mcp-autonomy-gate.ts`:

```ts
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { resolveStoreIdForThread, getOnboardingStatus } from '@/lib/services/ai-onboarding'
import { shouldAutoSend, type AutoSendBlockedReason } from '@/lib/services/ai-autonomy'
import {
  aiAutonomyRulesConfig,
  DEFAULT_AUTONOMY_CONFIG,
  type AiAutonomyRulesConfig,
  type ReplyIntent,
} from '@/lib/schemas/ai'

/**
 * Load the per-store autonomy rules + the store-level auto-send toggle.
 * Defaults to the conservative DEFAULT_AUTONOMY_CONFIG on any miss or parse
 * failure. Mirrors the loads emma-generate.ts performs inline.
 */
export async function loadAutonomyConfig(
  workspaceId: string,
  storeId: string,
): Promise<{ rules: AiAutonomyRulesConfig; storeAutoSendEnabled: boolean }> {
  const { data: storeRow } = await supabaseAdmin
    .from('stores')
    .select('ai_auto_send_enabled')
    .eq('id', storeId)
    .single<{ ai_auto_send_enabled: boolean }>()

  let rules: AiAutonomyRulesConfig = {
    master_enabled: DEFAULT_AUTONOMY_CONFIG.master_enabled,
    confidence_threshold: DEFAULT_AUTONOMY_CONFIG.confidence_threshold,
    global_block_intents: [...DEFAULT_AUTONOMY_CONFIG.global_block_intents],
  }
  const { data: rulesRow } = await supabaseAdmin
    .from('ai_autonomy_rules')
    .select('config')
    .eq('workspace_id', workspaceId)
    .eq('store_id', storeId)
    .maybeSingle<{ config: unknown }>()
  if (rulesRow?.config) {
    const parsed = aiAutonomyRulesConfig.safeParse(rulesRow.config)
    if (parsed.success) rules = parsed.data
  }

  return { rules, storeAutoSendEnabled: storeRow?.ai_auto_send_enabled ?? false }
}

/**
 * Decide whether an MCP-composed reply may be sent NOW, applying the same
 * gate Emma's auto-send uses. Fail-safe: no resolvable store, or the store
 * toggle off, blocks with 'store_disabled'.
 */
export async function evaluateMcpSend(params: {
  workspaceId: string
  conversationId: string
  intent: ReplyIntent
  confidence: number
  shouldEscalate: boolean
}): Promise<{ allowed: boolean; reason: AutoSendBlockedReason | null; storeId: string | null }> {
  const { workspaceId, conversationId, intent, confidence, shouldEscalate } = params

  const storeId = await resolveStoreIdForThread(conversationId, workspaceId)
  if (!storeId) return { allowed: false, reason: 'store_disabled', storeId: null }

  const { rules, storeAutoSendEnabled } = await loadAutonomyConfig(workspaceId, storeId)
  if (!storeAutoSendEnabled) return { allowed: false, reason: 'store_disabled', storeId }

  const status = await getOnboardingStatus(storeId, workspaceId)
  const scenarioRow = status.scenarios.find((s) => s.scenario_key === intent) ?? null

  const decision = shouldAutoSend({
    draft: { intent, confidence, should_escalate: shouldEscalate },
    scenario: scenarioRow ? { autonomy_pct: scenarioRow.autonomy_pct } : null,
    rules,
  })

  return decision.send
    ? { allowed: true, reason: null, storeId }
    : { allowed: false, reason: decision.reason, storeId }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/services/mcp-autonomy-gate.test.ts`
Expected: PASS (5 tests).

---

## Task 4: `recordMcpDraft()` — MCP-tagged `ai_drafts` insert

**Files:**
- Create: `lib/services/mcp-reply-record.ts`
- Test: `lib/services/mcp-reply-record.test.ts`

**Interfaces:**
- Consumes: `supabaseAdmin`; `AutoSendBlockedReason` from `@/lib/services/ai-autonomy`; `ReplyIntent` from `@/lib/schemas/ai`.
- Produces: `recordMcpDraft(params: { workspaceId: string; storeId: string | null; conversationId: string; userId: string; text: string; intent: ReplyIntent | null; confidence: number | null; shouldEscalate: boolean | null; autoSent: boolean; blockedReason: AutoSendBlockedReason | null }): Promise<string | null>` — returns the new draft id, or `null` on any failure (best-effort, never throws). Consumed by Task 6.

- [ ] **Step 1: Write the failing test**

Create `lib/services/mcp-reply-record.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

let lastInsert: Record<string, unknown> | null = null
let insertShouldThrow = false
vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from() {
      return {
        insert(row: Record<string, unknown>) {
          lastInsert = row
          if (insertShouldThrow) throw new Error('db down')
          return { select: () => ({ single: () => Promise.resolve({ data: { id: 'draft-1' }, error: null }) }) }
        },
      }
    },
  },
}))

import { recordMcpDraft } from '@/lib/services/mcp-reply-record'

beforeEach(() => {
  lastInsert = null
  insertShouldThrow = false
})

describe('recordMcpDraft', () => {
  it('inserts an mcp-tagged auto_sent row and returns the id', async () => {
    const id = await recordMcpDraft({
      workspaceId: 'w1', storeId: 's1', conversationId: 'c1', userId: 'u1',
      text: 'hi', intent: 'wismo', confidence: 0.9, shouldEscalate: false,
      autoSent: true, blockedReason: null,
    })
    expect(id).toBe('draft-1')
    expect(lastInsert?.prompt_path).toBe('mcp')
    expect(lastInsert?.status).toBe('auto_sent')
    expect(lastInsert?.auto_sent_at).toBeTypeOf('string')
    expect(lastInsert?.auto_send_blocked_reason).toBeNull()
  })

  it('inserts a pending blocked row with the reason and null auto_sent_at', async () => {
    await recordMcpDraft({
      workspaceId: 'w1', storeId: 's1', conversationId: 'c1', userId: 'u1',
      text: 'hi', intent: 'refund_or_cancel', confidence: 1, shouldEscalate: false,
      autoSent: false, blockedReason: 'blocked_intent',
    })
    expect(lastInsert?.status).toBe('pending')
    expect(lastInsert?.auto_sent_at).toBeNull()
    expect(lastInsert?.auto_send_blocked_reason).toBe('blocked_intent')
  })

  it('returns null and never throws when the insert fails', async () => {
    insertShouldThrow = true
    const id = await recordMcpDraft({
      workspaceId: 'w1', storeId: null, conversationId: 'c1', userId: 'u1',
      text: 'hi', intent: null, confidence: null, shouldEscalate: null,
      autoSent: false, blockedReason: null,
    })
    expect(id).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/services/mcp-reply-record.test.ts`
Expected: FAIL — `recordMcpDraft` not exported.

- [ ] **Step 3: Write the implementation**

Create `lib/services/mcp-reply-record.ts`:

```ts
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import type { AutoSendBlockedReason } from '@/lib/services/ai-autonomy'
import type { ReplyIntent } from '@/lib/schemas/ai'
import { logger } from '@/lib/logger'

/**
 * Persist an MCP-composed reply as an ai_drafts row tagged prompt_path='mcp'.
 * Append-only and best-effort: it must NEVER throw into the tool handler — a
 * failed insert just means the reply isn't reflected in AI activity. No
 * ai_usage row is written; MCP replies are the user's own agent, not Emma,
 * so they never count toward Emma cost.
 */
export async function recordMcpDraft(params: {
  workspaceId: string
  storeId: string | null
  conversationId: string
  userId: string
  text: string
  intent: ReplyIntent | null
  confidence: number | null
  shouldEscalate: boolean | null
  autoSent: boolean
  blockedReason: AutoSendBlockedReason | null
}): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin
      .from('ai_drafts')
      .insert({
        workspace_id: params.workspaceId,
        store_id: params.storeId,
        conversation_id: params.conversationId,
        user_id: params.userId,
        prompt_path: 'mcp',
        suggested_text: params.text,
        model: 'mcp-agent',
        intent: params.intent,
        confidence: params.confidence,
        should_escalate: params.shouldEscalate,
        auto_sent_at: params.autoSent ? new Date().toISOString() : null,
        auto_send_blocked_reason: params.autoSent ? null : params.blockedReason,
        status: params.autoSent ? 'auto_sent' : 'pending',
      })
      .select('id')
      .single<{ id: string }>()
    return data?.id ?? null
  } catch (err) {
    logger.error('[mcp/reply]', 'ai_drafts insert failed', err)
    return null
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/services/mcp-reply-record.test.ts`
Expected: PASS (3 tests).

---

## Task 5: `buildReplyContext()` — the grounding bundle

**Files:**
- Modify: `lib/services/mcp-reply-context.ts` (add to the Task 2 file)
- Test: `lib/services/mcp-reply-context.test.ts` (add cases)

**Interfaces:**
- Consumes: `getConversation` from `@/lib/services/conversations`; `getAiSettings` from `@/lib/services/ai-config`; `listMacros` from `@/lib/services/macros`; `lookupCustomerForWorkspace` from `@/lib/services/mcp-shopify`; `loadAutonomyConfig` from `@/lib/services/mcp-autonomy-gate`; `REPLY_INTENTS` from `@/lib/schemas/ai`; `supabaseAdmin`; `rankMacros` (same file).
- Produces: `buildReplyContext(params: { workspaceId: string; conversationId: string; storeId?: string }): Promise<ReplyContext | null>` — `null` when the conversation isn't found. Consumed by Task 6 (`get_reply_context` tool).

- [ ] **Step 1: Write the failing test (append to `mcp-reply-context.test.ts`)**

Add these mocks at the TOP of the file (above the existing imports), then the new `describe` block:

```ts
import { vi } from 'vitest'

const getConversation = vi.fn()
const getAiSettings = vi.fn()
const listMacros = vi.fn()
const lookupCustomerForWorkspace = vi.fn()
const loadAutonomyConfig = vi.fn()
vi.mock('@/lib/services/conversations', () => ({ getConversation: (...a: unknown[]): unknown => getConversation(...a) }))
vi.mock('@/lib/services/ai-config', () => ({ getAiSettings: (...a: unknown[]): unknown => getAiSettings(...a) }))
vi.mock('@/lib/services/macros', () => ({ listMacros: (...a: unknown[]): unknown => listMacros(...a) }))
vi.mock('@/lib/services/mcp-shopify', () => ({ lookupCustomerForWorkspace: (...a: unknown[]): unknown => lookupCustomerForWorkspace(...a) }))
vi.mock('@/lib/services/mcp-autonomy-gate', () => ({ loadAutonomyConfig: (...a: unknown[]): unknown => loadAutonomyConfig(...a) }))
vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: {} }))
```

Then append:

```ts
import { buildReplyContext } from '@/lib/services/mcp-reply-context'

describe('buildReplyContext', () => {
  it('returns null when the conversation is not found', async () => {
    getConversation.mockResolvedValue(null)
    const r = await buildReplyContext({ workspaceId: 'w1', conversationId: 'missing' })
    expect(r).toBeNull()
  })

  it('bundles thread, settings, ranked macros, order, and autonomy snapshot', async () => {
    getConversation.mockResolvedValue({
      id: 'c1', subject: 'Where is my order', customer_email: 'a@b.com',
      status: 'open', shopify_customer_id: null,
      messages: [{ from: 'a@b.com', body: 'I need a refund for my order' }],
    })
    getAiSettings.mockResolvedValue({
      storeId: 's1', isComplete: true, systemPrompt: 'PROMPT',
      policies: { brand_name: 'Acme' },
      scenarios: [{ scenario_key: 'refund_or_cancel', autonomy_pct: 0 }, { scenario_key: 'wismo', autonomy_pct: 80 }],
      lessons: [], examples: [],
    })
    listMacros.mockResolvedValue([
      { id: 'm1', name: 'Refund', body: 'refund within 14 days', language: 'en', tags: ['refund'], archived: false },
      { id: 'm2', name: 'Welcome', body: 'hello', language: 'en', tags: [], archived: false },
    ])
    lookupCustomerForWorkspace.mockResolvedValue({ orders: [] })
    loadAutonomyConfig.mockResolvedValue({
      rules: { master_enabled: true, confidence_threshold: 0.85, global_block_intents: ['refund_or_cancel'] },
      storeAutoSendEnabled: true,
    })

    const r = await buildReplyContext({ workspaceId: 'w1', conversationId: 'c1' })
    expect(r).not.toBeNull()
    expect(r!.aiSettings.systemPrompt).toBe('PROMPT')
    expect(r!.suggestedMacros[0].id).toBe('m1') // refund macro ranks first
    expect(r!.suggestedMacros.length).toBeLessThanOrEqual(5)
    expect(r!.order).toEqual({ orders: [] })
    expect(r!.autonomy.store_auto_send_enabled).toBe(true)
    expect(r!.autonomy.perScenarioAutonomyPct.refund_or_cancel).toBe(0)
    expect(r!.validIntents).toContain('wismo')
  })

  it('sets order to null when the conversation has no customer email', async () => {
    getConversation.mockResolvedValue({ id: 'c1', subject: null, customer_email: null, status: 'open', shopify_customer_id: null, messages: [] })
    getAiSettings.mockResolvedValue({ storeId: 's1', isComplete: false, systemPrompt: null, policies: null, scenarios: [], lessons: [], examples: [] })
    listMacros.mockResolvedValue([])
    loadAutonomyConfig.mockResolvedValue({ rules: { master_enabled: false, confidence_threshold: 0.85, global_block_intents: [] }, storeAutoSendEnabled: false })
    const r = await buildReplyContext({ workspaceId: 'w1', conversationId: 'c1' })
    expect(r!.order).toBeNull()
    expect(lookupCustomerForWorkspace).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/services/mcp-reply-context.test.ts`
Expected: FAIL — `buildReplyContext` not exported. (The `rankMacros` tests still pass.)

- [ ] **Step 3: Write the implementation (append to `mcp-reply-context.ts`)**

Add imports at the top of `lib/services/mcp-reply-context.ts`:

```ts
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getConversation, type ConversationDetail } from '@/lib/services/conversations'
import { getAiSettings, type AiSettings } from '@/lib/services/ai-config'
import { listMacros } from '@/lib/services/macros'
import { lookupCustomerForWorkspace } from '@/lib/services/mcp-shopify'
import { loadAutonomyConfig } from '@/lib/services/mcp-autonomy-gate'
import { REPLY_INTENTS } from '@/lib/schemas/ai'
```

> If `ConversationDetail` or `AiSettings` are not exported names, import them as the file actually exports (check `lib/services/conversations.ts` and `lib/services/ai-config.ts`); both interfaces exist. Use them for typing only.

Append the function:

```ts
export interface ReplyContextAutonomy {
  master_enabled: boolean
  confidence_threshold: number
  global_block_intents: string[]
  store_auto_send_enabled: boolean
  perScenarioAutonomyPct: Record<string, number>
}

export interface ReplyContext {
  thread: ConversationDetail
  order: unknown
  aiSettings: AiSettings
  suggestedMacros: RankedMacro[]
  autonomy: ReplyContextAutonomy
  validIntents: string[]
  guidance: string
}

const GUIDANCE =
  'Compose the reply grounded in aiSettings.systemPrompt and, when one fits, the top suggestedMacros entry. ' +
  'Then call send_reply with the chosen intent and your confidence (0-1). The server enforces the workspace ' +
  'autonomy rules: if the reply may not auto-send, it is saved as a draft for human review (the response says why). ' +
  'Use create_draft when a human should review regardless. Use list_members to find a member id for assignment.'

function latestCustomerText(thread: ConversationDetail): string {
  const msgs = thread.messages ?? []
  const last = msgs[msgs.length - 1] as { body?: string; snippet?: string } | undefined
  return last?.body ?? last?.snippet ?? thread.subject ?? ''
}

export async function buildReplyContext(params: {
  workspaceId: string
  conversationId: string
  storeId?: string
}): Promise<ReplyContext | null> {
  const { workspaceId, conversationId, storeId } = params

  const thread = await getConversation(supabaseAdmin as never, workspaceId, conversationId)
  if (!thread) return null

  const aiSettings = await getAiSettings(workspaceId, storeId)

  const macros = await listMacros(supabaseAdmin as never, workspaceId, {})
  const language =
    (aiSettings.policies?.languages && aiSettings.policies.languages[0]) || undefined
  const suggestedMacros = rankMacros(macros, { language, text: latestCustomerText(thread) }).slice(0, 5)

  let order: unknown = null
  if (thread.customer_email) {
    try {
      order = await lookupCustomerForWorkspace(workspaceId, { email: thread.customer_email }, { storeId: aiSettings.storeId })
    } catch {
      order = null
    }
  }

  const { rules, storeAutoSendEnabled } = await loadAutonomyConfig(workspaceId, aiSettings.storeId)
  const perScenarioAutonomyPct: Record<string, number> = {}
  for (const s of aiSettings.scenarios) {
    perScenarioAutonomyPct[s.scenario_key] = s.autonomy_pct ?? 0
  }

  return {
    thread,
    order,
    aiSettings,
    suggestedMacros,
    autonomy: {
      master_enabled: rules.master_enabled,
      confidence_threshold: rules.confidence_threshold,
      global_block_intents: rules.global_block_intents,
      store_auto_send_enabled: storeAutoSendEnabled,
      perScenarioAutonomyPct,
    },
    validIntents: [...REPLY_INTENTS],
    guidance: GUIDANCE,
  }
}
```

> `aiSettings.policies?.languages` — if `AiPolicies` types `languages` differently, fall back to `undefined`; the language bonus is optional. Confirm against `lib/schemas/ai.ts` `aiPoliciesBody` (it has `languages`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/services/mcp-reply-context.test.ts`
Expected: PASS (rankMacros 3 + buildReplyContext 3 = 6 tests).

---

## Task 6: `get_reply_context` MCP tool

**Files:**
- Create: `mcp/tools/context.ts`
- Create: `mcp/tools/context.test.ts`
- Modify: `mcp/server.ts`

**Interfaces:**
- Consumes: `buildReplyContext` from `@/lib/services/mcp-reply-context`; `ok`, `fail` from `@/mcp/tools/inbox`; `McpToolContext` from `@/mcp/types`; `McpServer` type.
- Produces: `registerContextTools(server, ctx)` registering tool `get_reply_context`. Consumed by `mcp/server.ts`.

- [ ] **Step 1: Write the failing test**

Create `mcp/tools/context.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const buildReplyContext = vi.fn()
vi.mock('@/lib/services/mcp-reply-context', () => ({
  buildReplyContext: (...a: unknown[]): unknown => buildReplyContext(...a),
}))

import { registerContextTools } from '@/mcp/tools/context'
import type { McpToolContext } from '@/mcp/types'

interface Reg { handler: (a: unknown) => Promise<{ content: { type: string; text: string }[]; isError?: boolean }> }
function fakeServer() {
  const tools: Record<string, Reg> = {}
  return {
    server: { registerTool: (n: string, _c: unknown, h: Reg['handler']) => { tools[n] = { handler: h } } },
    tools,
  }
}
const ctx: McpToolContext = { userId: 'u1', workspaceId: 'w1', role: 'agent' }

beforeEach(() => buildReplyContext.mockReset())

describe('registerContextTools', () => {
  it('registers get_reply_context', () => {
    const { server, tools } = fakeServer()
    registerContextTools(server as never, ctx)
    expect(tools.get_reply_context).toBeDefined()
  })

  it('returns the bundle on success', async () => {
    buildReplyContext.mockResolvedValue({ thread: { id: 'c1' }, validIntents: ['wismo'] })
    const { server, tools } = fakeServer()
    registerContextTools(server as never, ctx)
    const res = await tools.get_reply_context.handler({ conversationId: 'c1' })
    expect(res.isError).toBeUndefined()
    expect(res.content[0].text).toContain('"wismo"')
    expect(buildReplyContext).toHaveBeenCalledWith({ workspaceId: 'w1', conversationId: 'c1', storeId: undefined })
  })

  it('errors when the conversation is not found', async () => {
    buildReplyContext.mockResolvedValue(null)
    const { server, tools } = fakeServer()
    registerContextTools(server as never, ctx)
    const res = await tools.get_reply_context.handler({ conversationId: 'missing' })
    expect(res.isError).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run mcp/tools/context.test.ts`
Expected: FAIL — cannot find module `@/mcp/tools/context`.

- [ ] **Step 3: Write the tool**

Create `mcp/tools/context.ts`:

```ts
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { buildReplyContext } from '@/lib/services/mcp-reply-context'
import { ok, fail } from '@/mcp/tools/inbox'
import type { McpToolContext } from '@/mcp/types'

export function registerContextTools(server: McpServer, ctx: McpToolContext): void {
  server.registerTool(
    'get_reply_context',
    {
      description:
        'Get everything needed to compose an on-brand, policy-aware reply for a conversation in ONE call: the message thread, linked Shopify order context, the assembled AI/Emma system prompt + brand policies + scenarios + lessons + examples, the best-matching reply templates (macros) ranked by relevance, and the workspace autonomy snapshot (what may auto-send vs must be drafted/escalated). Call this before send_reply.',
      inputSchema: { conversationId: z.string(), storeId: z.string().optional() },
    },
    async (args: { conversationId: string; storeId?: string }) => {
      try {
        const context = await buildReplyContext({
          workspaceId: ctx.workspaceId,
          conversationId: args.conversationId,
          storeId: args.storeId,
        })
        if (!context) return fail(`Conversation ${args.conversationId} not found in this workspace.`)
        return ok(context)
      } catch (e) {
        return fail(`get_reply_context failed: ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    },
  )
}
```

- [ ] **Step 4: Register in `mcp/server.ts`**

Modify `mcp/server.ts` — add the import and the call:

```ts
import { registerContextTools } from '@/mcp/tools/context'
```

and inside `registerLynqTools`, after `registerEmmaTools(server, ctx)`:

```ts
  registerContextTools(server, ctx)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run mcp/tools/context.test.ts`
Expected: PASS (3 tests).

---

## Task 7: `send_reply` autonomy enforcement

**Files:**
- Modify: `mcp/tools/inbox.ts` (the existing `send_reply` registration, ~lines 173-204)
- Modify: `mcp/tools/inbox.test.ts`

**Interfaces:**
- Consumes: `evaluateMcpSend` from `@/lib/services/mcp-autonomy-gate`; `recordMcpDraft` from `@/lib/services/mcp-reply-record`; `REPLY_INTENTS`, `ReplyIntent` from `@/lib/schemas/ai`; existing `sendReply`, `can`, `supabaseAdmin`, `ok`, `fail`.
- Produces: `send_reply` now accepts optional `intent`, `confidence`, `should_escalate`; returns `{ sent: true, draftId }` when allowed or `{ sent: false, drafted: true, draftId, blockedReason, message }` when blocked.

- [ ] **Step 1: Write the failing tests (append cases to `mcp/tools/inbox.test.ts`)**

First extend the existing mocks. In `mcp/tools/inbox.test.ts`, add to the top-level mocks:

```ts
const evaluateMcpSend = vi.fn()
const recordMcpDraft = vi.fn()
vi.mock('@/lib/services/mcp-autonomy-gate', () => ({
  evaluateMcpSend: (...a: unknown[]): unknown => evaluateMcpSend(...a),
}))
vi.mock('@/lib/services/mcp-reply-record', () => ({
  recordMcpDraft: (...a: unknown[]): unknown => recordMcpDraft(...a),
}))
```

Add to the `beforeEach` reset block:

```ts
  evaluateMcpSend.mockReset()
  recordMcpDraft.mockReset()
```

Then append a `describe`:

```ts
describe('send_reply autonomy enforcement', () => {
  function getSendReply() {
    const { server, tools } = fakeServer()
    registerInboxTools(server as never, ctx)
    return tools.send_reply.handler
  }

  it('sends when the gate allows and records an auto_sent draft', async () => {
    evaluateMcpSend.mockResolvedValue({ allowed: true, reason: null, storeId: 's1' })
    recordMcpDraft.mockResolvedValue('d1')
    sendReply.mockResolvedValue({ ok: true })
    const handler = getSendReply()
    const res = await handler({ conversationId: 'c1', bodyText: 'hello', intent: 'wismo', confidence: 0.95 })
    expect(sendReply).toHaveBeenCalled()
    expect(res.isError).toBeUndefined()
    expect(res.content[0].text).toContain('"sent": true')
    expect(recordMcpDraft).toHaveBeenCalledWith(expect.objectContaining({ autoSent: true }))
  })

  it('does NOT send when blocked and drafts instead with the reason', async () => {
    evaluateMcpSend.mockResolvedValue({ allowed: false, reason: 'blocked_intent', storeId: 's1' })
    recordMcpDraft.mockResolvedValue('d2')
    const handler = getSendReply()
    const res = await handler({ conversationId: 'c1', bodyText: 'a refund for you', intent: 'refund_or_cancel', confidence: 1 })
    expect(sendReply).not.toHaveBeenCalled()
    expect(res.content[0].text).toContain('"drafted": true')
    expect(res.content[0].text).toContain('blocked_intent')
    expect(recordMcpDraft).toHaveBeenCalledWith(expect.objectContaining({ autoSent: false, blockedReason: 'blocked_intent' }))
  })

  it('defaults missing intent/confidence to a safe draft (gate blocks)', async () => {
    evaluateMcpSend.mockResolvedValue({ allowed: false, reason: 'confidence_low', storeId: 's1' })
    recordMcpDraft.mockResolvedValue('d3')
    const handler = getSendReply()
    await handler({ conversationId: 'c1', bodyText: 'hello' })
    expect(evaluateMcpSend).toHaveBeenCalledWith(expect.objectContaining({ intent: 'unknown', confidence: 0, shouldEscalate: false }))
    expect(sendReply).not.toHaveBeenCalled()
  })

  it('rejects a role that cannot reply', async () => {
    const { server, tools } = fakeServer()
    registerInboxTools(server as never, { userId: 'u1', workspaceId: 'w1', role: 'observer' })
    const res = await tools.send_reply.handler({ conversationId: 'c1', bodyText: 'hi' })
    expect(res.isError).toBe(true)
    expect(evaluateMcpSend).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run mcp/tools/inbox.test.ts`
Expected: FAIL — new assertions fail (current `send_reply` ignores the gate and always sends).

- [ ] **Step 3: Update `send_reply` in `mcp/tools/inbox.ts`**

Add imports near the top of `mcp/tools/inbox.ts`:

```ts
import { evaluateMcpSend } from '@/lib/services/mcp-autonomy-gate'
import { recordMcpDraft } from '@/lib/services/mcp-reply-record'
import { REPLY_INTENTS, type ReplyIntent } from '@/lib/schemas/ai'
```

Replace the entire `send_reply` registration (currently the block starting `server.registerTool('send_reply', ...)`) with:

```ts
  server.registerTool(
    'send_reply',
    {
      description:
        'Send a reply email on a conversation. Provide bodyText and/or bodyHtml, plus the intent you are handling and your confidence (0-1). The server enforces the workspace autonomy rules: if this reply may not auto-send, it is saved as a draft for human review instead and the response tells you why. Prefer create_draft when a human should always review.',
      inputSchema: {
        conversationId: z.string(),
        bodyText: z.string().optional(),
        bodyHtml: z.string().optional(),
        subject: z.string().optional(),
        to: z.string().optional(),
        cc: z.string().optional(),
        bcc: z.string().optional(),
        intent: z.enum(REPLY_INTENTS).optional(),
        confidence: z.number().min(0).max(1).optional(),
        should_escalate: z.boolean().optional(),
      },
    },
    async (args: {
      conversationId: string
      bodyText?: string
      bodyHtml?: string
      subject?: string
      to?: string
      cc?: string
      bcc?: string
      intent?: ReplyIntent
      confidence?: number
      should_escalate?: boolean
    }) => {
      if (!can.replyToTickets(ctx.role)) return fail('Your role cannot send replies.')
      if (!args.bodyText && !args.bodyHtml) return fail('Provide bodyText and/or bodyHtml.')

      const intent: ReplyIntent = args.intent ?? 'unknown'
      const confidence = args.confidence ?? 0
      const shouldEscalate = args.should_escalate ?? false
      const draftText = args.bodyText ?? args.bodyHtml ?? ''

      let decision: { allowed: boolean; reason: string | null; storeId: string | null }
      try {
        decision = await evaluateMcpSend({
          workspaceId: ctx.workspaceId,
          conversationId: args.conversationId,
          intent,
          confidence,
          shouldEscalate,
        })
      } catch (e) {
        return fail(`send_reply failed during autonomy check: ${e instanceof Error ? e.message : 'unknown error'}`)
      }

      if (!decision.allowed) {
        const draftId = await recordMcpDraft({
          workspaceId: ctx.workspaceId,
          storeId: decision.storeId,
          conversationId: args.conversationId,
          userId: ctx.userId,
          text: draftText,
          intent,
          confidence,
          shouldEscalate,
          autoSent: false,
          blockedReason: decision.reason as never,
        })
        return ok({
          sent: false,
          drafted: true,
          draftId,
          blockedReason: decision.reason,
          message: `Workspace autonomy rules do not allow auto-sending this reply (${decision.reason}). Saved as a draft for human review.`,
        })
      }

      try {
        const result = await sendReply(ctx.workspaceId, args.conversationId, '', {
          to: args.to ? [{ email: args.to }] : [],
          cc: args.cc ? [{ email: args.cc }] : [],
          bcc: args.bcc ? [{ email: args.bcc }] : [],
          subject: args.subject ?? '',
          bodyHtml: args.bodyHtml ?? '',
          bodyText: args.bodyText ?? '',
        }, undefined)
        const draftId = await recordMcpDraft({
          workspaceId: ctx.workspaceId,
          storeId: decision.storeId,
          conversationId: args.conversationId,
          userId: ctx.userId,
          text: draftText,
          intent,
          confidence,
          shouldEscalate,
          autoSent: true,
          blockedReason: null,
        })
        return ok({ sent: true, draftId, result })
      } catch (e) {
        return fail(`send_reply failed: ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    },
  )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run mcp/tools/inbox.test.ts`
Expected: PASS (existing cases + 4 new).

---

## Task 8: `list_members` MCP tool

**Files:**
- Modify: `mcp/tools/inbox.ts` (add a new registration inside `registerInboxTools`)
- Modify: `mcp/tools/inbox.test.ts`

**Interfaces:**
- Consumes: `getEnrichedMembers` from `@/lib/services/workspace-members` (returns `EnrichedMember[]` = `{ id, workspace_id, email, name, role, joined_at }`).
- Produces: tool `list_members` returning members for `ctx.workspaceId`.

- [ ] **Step 1: Write the failing test (append to `mcp/tools/inbox.test.ts`)**

Add the mock at the top with the others:

```ts
const getEnrichedMembers = vi.fn()
vi.mock('@/lib/services/workspace-members', () => ({
  getEnrichedMembers: (...a: unknown[]): unknown => getEnrichedMembers(...a),
}))
```

Add to `beforeEach`:

```ts
  getEnrichedMembers.mockReset()
```

Append a `describe`:

```ts
describe('list_members', () => {
  it('lists workspace members scoped to the workspace', async () => {
    getEnrichedMembers.mockResolvedValue([{ id: 'u1', workspace_id: 'w1', email: 'a@b.com', name: 'Aya', role: 'agent', joined_at: 't' }])
    const { server, tools } = fakeServer()
    registerInboxTools(server as never, ctx)
    const res = await tools.list_members.handler({})
    expect(getEnrichedMembers).toHaveBeenCalledWith({ workspaceId: 'w1' })
    expect(res.content[0].text).toContain('Aya')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run mcp/tools/inbox.test.ts`
Expected: FAIL — `tools.list_members` is undefined.

- [ ] **Step 3: Add the tool**

Add the import near the top of `mcp/tools/inbox.ts`:

```ts
import { getEnrichedMembers } from '@/lib/services/workspace-members'
```

Add this registration inside `registerInboxTools`, after the `link_customer` registration:

```ts
  server.registerTool(
    'list_members',
    {
      description: 'List workspace members (id, name, email, role) so you can assign or escalate a conversation. Use a member id with set_state (assignedTo).',
      inputSchema: {},
    },
    async () => {
      try {
        return ok(await getEnrichedMembers({ workspaceId: ctx.workspaceId }))
      } catch (e) {
        return fail(`list_members failed: ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    },
  )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run mcp/tools/inbox.test.ts`
Expected: PASS (all inbox cases + new `list_members`).

---

## Task 9: Instructions update + full verification

**Files:**
- Modify: `mcp/instructions.ts`

**Interfaces:**
- No code interface; updates the `LYNQ_MCP_INSTRUCTIONS` string the server advertises.

- [ ] **Step 1: Update the instructions**

In `mcp/instructions.ts`, replace the "Working a ticket:" and "Context for answering tickets:" guidance by inserting a new grounded-reply paragraph. Specifically, change the `Working a ticket:` block's first bullet from:

```
- Draft vs send: use create_draft to leave a reply for a human to review and send; use send_reply ONLY when you should send to the customer immediately — it dispatches the email right away.
```

to:

```
- For a customer reply, FIRST call get_reply_context — it returns the thread, linked order, the assembled AI/Emma system prompt + policies + scenarios, the best-matching reply templates (macros), and the workspace autonomy snapshot. Compose the reply grounded in that system prompt and the best macro.
- Then call send_reply with the intent you handled and your confidence (0-1). send_reply ENFORCES the workspace autonomy rules: if the reply may not auto-send (blocked intent, low confidence, scenario locked, master/store auto-send off, or you flagged escalation), it is saved as a draft for human review instead and the response tells you why. Use create_draft when a human should always review regardless.
- Use list_members to find a member id, then set_state (assignedTo) to assign or escalate.
```

Then add this line to the "Emma AI configuration" section (after the get_ai_settings bullet) so the agent knows MCP replies aren't billed as Emma:

```
- Replies you compose and send/draft through MCP are recorded in the workspace's AI activity but are NOT charged as Emma generations — they are the user's own agent, not the cloud Emma assist.
```

- [ ] **Step 2: Run the full MCP + service test suite**

Run: `npx vitest run mcp/ lib/services/mcp-autonomy-gate.test.ts lib/services/mcp-reply-record.test.ts lib/services/mcp-reply-context.test.ts`
Expected: PASS — all MCP tool tests and the three new service tests green.

- [ ] **Step 3: Type-check (tests do NOT type-check — this is mandatory)**

Run: `npx tsc --noEmit`
Expected: no errors. Fix any type mismatches (e.g. import names for `ConversationDetail`/`AiSettings`/`AiPolicies.languages`) before proceeding.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no errors. Resolve all (no `any`; `@/` imports only).

---

## Self-Review

**Spec coverage:**
- "agent composes, app grounds it" → Task 6 `get_reply_context` + Task 5 `buildReplyContext` (assembled prompt, policies, scenarios, lessons, examples, ranked macros, order, autonomy snapshot). ✅
- "suggest_macro / render context" → `rankMacros` (Task 2) folded into the context bundle. ✅
- "enforce server-side" autonomy → Task 3 `evaluateMcpSend` (reuses `shouldAutoSend`) + Task 7 `send_reply` enforcement with draft fallback. ✅
- "fail-safe defaults" (omitted intent→unknown, confidence→0) → Task 7 Step 3 + test. ✅
- "record as ai_draft, not billable" → Task 4 `recordMcpDraft` (prompt_path `'mcp'`, no `ai_usage`) + Task 1 migration. ✅
- "list_members" → Task 8. ✅
- "instructions update" → Task 9. ✅
- "store_disabled latent constraint" → Task 1 (folded-in fix). ✅

**Placeholder scan:** No TBD/TODO; every code step shows complete code; every test shows full assertions. ✅

**Type consistency:** `evaluateMcpSend`/`loadAutonomyConfig` signatures match between Tasks 3, 5, 7. `recordMcpDraft` param object matches between Tasks 4 and 7 (`autoSent`, `blockedReason`, `shouldEscalate`). `RankedMacro`/`ReplyContext` defined in Task 2/5 and consumed in Task 6. `registerContextTools` defined Task 6, registered in `mcp/server.ts`. ✅

**Known follow-up flagged for the implementer:** confirm the exact exported type names `ConversationDetail` (from `conversations.ts`) and `AiSettings` (from `ai-config.ts`), and that `AiPolicies.languages` exists; the plan imports them but the codebase is the source of truth. These are type-only imports — a mismatch surfaces at Task 9 Step 3 (`tsc`).
