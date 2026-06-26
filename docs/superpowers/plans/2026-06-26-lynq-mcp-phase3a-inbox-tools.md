# Lynq MCP Server — Phase 3a (Inbox Core Tools) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the inbox-handling MCP tools — read a full conversation, draft a reply for human review, send a reply, change ticket state (resolve/close/reopen/assign/snooze), tag/untag, and link a customer — so Claude can work tickets end to end through the MCP server.

**Architecture:** Each tool is a thin handler in `mcp/tools/inbox.ts` that calls a `lib/services/*` function with `ctx.workspaceId` and a role gate (`can.*`). Read/get/tag/state logic that today lives inline in the Hono route is mirrored into pure functions in `lib/services/conversations.ts`. Sending and customer-linking reuse the existing `lib/conversationEngine.ts` functions. Drafts persist Claude's own text into the existing `ai_drafts` table (status `pending`) for human review — they do NOT re-invoke the cloud AI.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk` (`McpServer`), `zod`, Supabase (`supabaseAdmin`), existing `lib/conversationEngine.ts`, `lib/permissions.ts`, Vitest.

## Global Constraints

- TypeScript only; **no `any`** (ESLint-enforced). — CLAUDE.md
- `@/` path alias; no `../../../`. — CLAUDE.md
- Every workspace-scoped table query MUST filter `workspace_id`. — CLAUDE.md
- Routes/tools are thin; business logic in pure `lib/services/*`. — CLAUDE.md
- Run `npm run lint` (or scoped `npx eslint`) after each task; resolve errors **you introduce** (ignore the ~10 pre-existing unrelated errors in `app/components/hooks`). — CLAUDE.md + Phase 1 finding
- `mcp/` imports only `@/lib/*` + `zod` + the SDK; never `app/` or React. — design spec §4.1
- **Before editing any service that queries workspace-scoped tables, the implementer MUST invoke the `supabase-auth-rules` project skill.** — CLAUDE.md skills table
- Write tools are **role-gated** via `@/lib/permissions` `can.*`: `replyToTickets` (send/draft), `manageConversations` (state/link), `manageTags` (tag). Observer role is read-only. A gate failure returns an MCP error result, not a throw. — `lib/permissions.ts`
- Do **not** run git commands (working tree only). — user instruction
- **Send is real:** `send_reply` dispatches an actual email via the provider. During verification, NEVER send to a real customer — use a conversation you control or assert tool registration + arg validation only. — safety

---

## Context from prior phases (do not rebuild)

- `mcp/server.ts` exports `registerLynqTools(server, ctx)` and currently registers `list_conversations` inline. `mcp/types.ts` exports `McpToolContext { userId, workspaceId, role }`.
- `lib/services/conversations.ts` exports `listConversations(db, workspaceId, filters)`, types `ConversationFilters`, `ConversationSummary`, `ConversationsDb`. Tags are currently returned as `[]` (Phase 1 placeholder — Task 3 fixes this).
- `lib/conversationEngine.ts` exports (verified signatures):
  - `sendReply(workspaceId, conversationId, userEmail, { to?, cc?, bcc?, subject?, bodyHtml?, bodyText? }, memberId?)`
  - `linkCustomer(workspaceId, conversationId, shopifyCustomerId)` → `{ success: true }`
  - `updateConversationStatus(workspaceId, conversationId, status)` for `open|pending|resolved|closed`
- Tables: `email_conversations` (cols incl. `status`, `assigned_to`, `snoozed_until`, `is_unread`, `shopify_customer_id`, `last_message_at`), `email_messages` (`conversation_id`, `from_email`, `from_name`, `body_text`, `body_html`, `is_outbound`, `created_at`), `tags` (`id`, `name`, `color`, `workspace_id`), `email_conversation_tags` (`conversation_id`, `tag_id`, `workspace_id`), `ai_drafts` (Emma drafts; `status` `pending|auto_sent`).
- Role gates in `@/lib/permissions`: `can.replyToTickets(role)`, `can.manageConversations(role)`, `can.manageTags(role)` — each `['owner','admin','agent'].includes(role)`.
- `McpToolContext.userId` is the Supabase user id; `memberId` is NOT in the context — where `sendReply` wants `memberId`, pass `undefined` (it is optional and only used for attribution).

---

## File Structure

**Create:**
- `mcp/tools/inbox.ts` — `registerInboxTools(server, ctx)` (all inbox tools)
- `mcp/tools/inbox.test.ts` — tool registration + handler tests (mocked services)
- `lib/services/inbox-drafts.ts` — `createInboxDraft(db, {...})`
- `lib/services/inbox-drafts.test.ts`

**Modify:**
- `lib/services/conversations.ts` — add `getConversation`, `loadTags`, `listTags`, `addTag`, `removeTag`, `setConversationState`; enrich `listConversations` tags
- `lib/services/conversations.test.ts` — tests for the new functions + tag enrichment
- `mcp/server.ts` — delegate to `registerInboxTools` (move `list_conversations` into `mcp/tools/inbox.ts`)

---

## Interfaces (locked across tasks)

```ts
// lib/services/conversations.ts (additions)
export interface ConversationTag { id: string; name: string; color: string | null }
export interface ConversationMessage {
  id: string; from_email: string | null; from_name: string | null
  body_text: string | null; body_html: string | null; is_outbound: boolean; created_at: string
}
export interface ConversationDetail extends ConversationSummary {
  shopify_customer_id: string | null
  assigned_to: string | null
  snoozed_until: string | null
  messages: ConversationMessage[]
}
export type ConversationState =
  | { status: 'open' | 'pending' | 'resolved' | 'closed' }
  | { status: 'snoozed'; snoozedUntil: string }
  | { assignedTo: string | null }

export async function getConversation(db: ConversationsDb, workspaceId: string, id: string): Promise<ConversationDetail | null>
export async function loadTags(db: ConversationsDb, workspaceId: string, conversationIds: string[]): Promise<Record<string, ConversationTag[]>>
export async function listTags(db: ConversationsDb, workspaceId: string): Promise<ConversationTag[]>
export async function addTag(db: ConversationsDb, workspaceId: string, conversationId: string, tagId: string): Promise<void>
export async function removeTag(db: ConversationsDb, workspaceId: string, conversationId: string, tagId: string): Promise<void>
export async function setConversationState(db: ConversationsDb, workspaceId: string, conversationId: string, state: ConversationState): Promise<void>

// lib/services/inbox-drafts.ts
export async function createInboxDraft(
  db: InboxDraftsDb,
  input: { workspaceId: string; conversationId: string; userId: string; text: string },
): Promise<{ id: string }>

// mcp/tools/inbox.ts
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { McpToolContext } from '@/mcp/types'
export function registerInboxTools(server: McpServer, ctx: McpToolContext): void
```

> The `ConversationsDb` interface (Phase 1) only models the `listConversations` query chain. Tasks that add new query shapes (joins, insert, delete, update) must EXTEND `ConversationsDb` to include the methods they use, keeping it a hand-written structural type (no `any`). Each task below shows the shape it needs.

---

### Task 1: Extract `mcp/tools/inbox.ts` (refactor `list_conversations`)

**Files:**
- Create: `mcp/tools/inbox.ts`, `mcp/tools/inbox.test.ts`
- Modify: `mcp/server.ts`

**Interfaces:**
- Consumes: `listConversations` (Phase 1); `McpToolContext`; `McpServer`
- Produces: `registerInboxTools(server, ctx)` registering `list_conversations`; `mcp/server.ts` delegates to it

- [ ] **Step 1: Move the tool + write the registration test**

Create `mcp/tools/inbox.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const listConversations = vi.fn()
vi.mock('@/lib/services/conversations', () => ({
  listConversations: (...a: unknown[]) => listConversations(...a),
}))
vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: {} }))

import { registerInboxTools } from '@/mcp/tools/inbox'
import type { McpToolContext } from '@/mcp/types'

interface Reg { handler: (args: unknown) => Promise<{ content: { type: string; text: string }[]; isError?: boolean }> }
function fakeServer() {
  const tools: Record<string, Reg> = {}
  const server = {
    registerTool: (n: string, _c: unknown, h: Reg['handler']) => { tools[n] = { handler: h } },
    tool: (n: string, _s: unknown, h: Reg['handler']) => { tools[n] = { handler: h } },
  }
  return { server, tools }
}
const ctx: McpToolContext = { userId: 'u1', workspaceId: 'w1', role: 'agent' }
beforeEach(() => listConversations.mockReset())

describe('registerInboxTools / list_conversations', () => {
  it('registers list_conversations', () => {
    const { server, tools } = fakeServer()
    registerInboxTools(server as never, ctx)
    expect(tools.list_conversations).toBeDefined()
  })
  it('calls the service scoped to ctx workspace', async () => {
    const { server, tools } = fakeServer()
    listConversations.mockResolvedValue([{ id: 'c1' }])
    registerInboxTools(server as never, ctx)
    const res = await tools.list_conversations.handler({ status: 'open' })
    expect(listConversations).toHaveBeenCalledWith(expect.anything(), 'w1', { status: 'open' })
    expect(res.content[0].text).toContain('c1')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tools/inbox`
Expected: FAIL — `@/mcp/tools/inbox` not found.

- [ ] **Step 3: Create `mcp/tools/inbox.ts` with shared helpers + `list_conversations`**

```ts
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { listConversations, type ConversationFilters } from '@/lib/services/conversations'
import type { McpToolContext } from '@/mcp/types'

export function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}
export function fail(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true as const }
}

export function registerInboxTools(server: McpServer, ctx: McpToolContext): void {
  server.registerTool(
    'list_conversations',
    {
      description: 'List inbox conversations in the workspace. Filter by status, store, email account, search text, or unlinked/spam flags.',
      inputSchema: {
        status: z.string().optional(),
        search: z.string().optional(),
        storeId: z.string().optional(),
        emailAccountId: z.string().optional(),
        unlinked: z.boolean().optional(),
        spam: z.boolean().optional(),
        page: z.number().int().min(0).optional(),
      },
    },
    async (args: ConversationFilters) => {
      try {
        return ok(await listConversations(supabaseAdmin as never, ctx.workspaceId, args))
      } catch (e) {
        return fail(`list_conversations failed: ${e instanceof Error ? e.message : 'unknown error'}`)
      }
    },
  )
}
```

- [ ] **Step 4: Update `mcp/server.ts` to delegate**

Replace the body of `registerLynqTools` so it no longer registers `list_conversations` inline; instead:

```ts
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { McpToolContext } from '@/mcp/types'
import { registerInboxTools } from '@/mcp/tools/inbox'

export function registerLynqTools(server: McpServer, ctx: McpToolContext): void {
  registerInboxTools(server, ctx)
}
```

Remove the now-unused imports (`z`, `supabaseAdmin`, `listConversations`, `ok`/`fail`) from `mcp/server.ts`. Keep `mcp/server.test.ts` passing — it asserts `list_conversations` is registered via `registerLynqTools`, which still holds through delegation.

- [ ] **Step 5: Run tests + lint**

Run: `npm test -- tools/inbox server` then `npx eslint mcp/tools/inbox.ts mcp/server.ts mcp/tools/inbox.test.ts`
Expected: all pass; lint clean. (`mcp/server.test.ts` still green.)

---

### Task 2: `getConversation` + `get_conversation` tool

**Files:**
- Modify: `lib/services/conversations.ts`, `lib/services/conversations.test.ts`, `mcp/tools/inbox.ts`, `mcp/tools/inbox.test.ts`

**Interfaces:**
- Consumes: `ConversationsDb`
- Produces: `getConversation`, `loadTags`, types `ConversationDetail`, `ConversationMessage`, `ConversationTag` (see locked Interfaces); tool `get_conversation`

**Invoke `supabase-auth-rules` before editing `lib/services/conversations.ts`.**

- [ ] **Step 1: Write failing service tests**

Add to `lib/services/conversations.test.ts`:

```ts
import { getConversation, loadTags } from '@/lib/services/conversations'

function detailDb(opts: {
  conversation: Record<string, unknown> | null
  messages?: Record<string, unknown>[]
  tagLinks?: { tag_id: string }[]
  tags?: { id: string; name: string; color: string | null }[]
}) {
  const db = {
    from(table: string) {
      if (table === 'email_conversations') {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: opts.conversation, error: null }) }) }) }),
          update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
        }
      }
      if (table === 'email_messages') {
        return { select: () => ({ eq: () => ({ eq: () => ({ order: async () => ({ data: opts.messages ?? [], error: null }) }) }) }) }
      }
      if (table === 'email_conversation_tags') {
        return { select: () => ({ eq: () => ({ in: async () => ({ data: opts.tagLinks ?? [], error: null }) }) }) }
      }
      if (table === 'tags') {
        return { select: () => ({ eq: () => ({ in: async () => ({ data: opts.tags ?? [], error: null }) }) }) }
      }
      throw new Error('unexpected table ' + table)
    },
  }
  return db as never
}

describe('getConversation', () => {
  it('returns null when the conversation is not in the workspace', async () => {
    const db = detailDb({ conversation: null })
    expect(await getConversation(db, 'w1', 'missing')).toBeNull()
  })
  it('returns conversation + messages + tags', async () => {
    const db = detailDb({
      conversation: { id: 'c1', subject: 'Hi', customer_email: 'a@b.c', customer_name: 'A', status: 'open', last_message_at: 't', shopify_customer_id: null, assigned_to: null, snoozed_until: null },
      messages: [{ id: 'm1', from_email: 'a@b.c', from_name: 'A', body_text: 'hello', body_html: null, is_outbound: false, created_at: 't' }],
      tagLinks: [{ tag_id: 'tag1' }],
      tags: [{ id: 'tag1', name: 'VIP', color: 'red' }],
    })
    const d = await getConversation(db, 'w1', 'c1')
    expect(d?.id).toBe('c1')
    expect(d?.messages[0].body_text).toBe('hello')
    expect(d?.tags).toEqual([{ id: 'tag1', name: 'VIP', color: 'red' }])
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- conversations`
Expected: FAIL — `getConversation`/`loadTags` not exported.

- [ ] **Step 3: Implement `getConversation` + `loadTags` (and extend `ConversationsDb`)**

In `lib/services/conversations.ts`, add the new types from the locked Interfaces block, extend `ConversationsDb` to include the query shapes used (a structural type — add `update`, the `.eq().eq().maybeSingle()` get chain, the messages `.order()` chain, and the tags `.in()` chains), then:

```ts
export interface ConversationTag { id: string; name: string; color: string | null }
export interface ConversationMessage {
  id: string; from_email: string | null; from_name: string | null
  body_text: string | null; body_html: string | null; is_outbound: boolean; created_at: string
}
export interface ConversationDetail extends ConversationSummary {
  shopify_customer_id: string | null
  assigned_to: string | null
  snoozed_until: string | null
  messages: ConversationMessage[]
}

export async function loadTags(
  db: ConversationsDb,
  workspaceId: string,
  conversationIds: string[],
): Promise<Record<string, ConversationTag[]>> {
  if (conversationIds.length === 0) return {}
  const links = (await db
    .from('email_conversation_tags')
    .select('conversation_id, tag_id')
    .eq('workspace_id', workspaceId)
    .in('conversation_id', conversationIds)) as unknown as { data: { conversation_id: string; tag_id: string }[] | null; error: { message: string } | null }
  if (links.error || !links.data?.length) return {}

  const tagIds = [...new Set(links.data.map((l) => l.tag_id))]
  const tagRows = (await db
    .from('tags')
    .select('id, name, color')
    .eq('workspace_id', workspaceId)
    .in('id', tagIds)) as unknown as { data: ConversationTag[] | null; error: { message: string } | null }
  const byId = new Map((tagRows.data ?? []).map((t) => [t.id, t]))

  const out: Record<string, ConversationTag[]> = {}
  for (const link of links.data) {
    const tag = byId.get(link.tag_id)
    if (!tag) continue
    ;(out[link.conversation_id] ??= []).push(tag)
  }
  return out
}

export async function getConversation(
  db: ConversationsDb,
  workspaceId: string,
  id: string,
): Promise<ConversationDetail | null> {
  const conv = (await db
    .from('email_conversations')
    .select('id, subject, customer_email, customer_name, status, last_message_at, shopify_customer_id, assigned_to, snoozed_until')
    .eq('workspace_id', workspaceId)
    .eq('id', id)
    .maybeSingle()) as unknown as { data: Record<string, unknown> | null; error: { message: string } | null }
  if (conv.error || !conv.data) return null
  const row = conv.data

  const msgs = (await db
    .from('email_messages')
    .select('id, from_email, from_name, body_text, body_html, is_outbound, created_at')
    .eq('workspace_id', workspaceId)
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })) as unknown as { data: ConversationMessage[] | null; error: { message: string } | null }

  // Mark read (best-effort).
  await db.from('email_conversations').update({ is_unread: false }).eq('workspace_id', workspaceId).eq('id', id)

  const tagsByConv = await loadTags(db, workspaceId, [id])

  return {
    id: row.id as string,
    subject: (row.subject as string | null) ?? null,
    customer_email: (row.customer_email as string | null) ?? null,
    customer_name: (row.customer_name as string | null) ?? null,
    status: row.status as string,
    last_message_at: (row.last_message_at as string | null) ?? null,
    store_name: null,
    shopify_customer_id: (row.shopify_customer_id as string | null) ?? null,
    assigned_to: (row.assigned_to as string | null) ?? null,
    snoozed_until: (row.snoozed_until as string | null) ?? null,
    tags: tagsByConv[id] ?? [],
    messages: msgs.data ?? [],
  }
}
```

> Note on `ConversationsDb`: extend it so these chains type-check without `any`. The messages `.eq().eq().order()` and the conversation `.eq().eq().maybeSingle()`/`.update().eq().eq()` and the `.in()` calls each return the thenable result objects shown. Use `unknown`-cast boundaries exactly as written (mirrors Phase 1's `listConversations` style); do not introduce `any`.

- [ ] **Step 4: Run service tests to verify pass**

Run: `npm test -- conversations`
Expected: PASS (existing + new getConversation/loadTags tests).

- [ ] **Step 5: Add the `get_conversation` tool + test**

In `mcp/tools/inbox.ts`, import `getConversation` and register:

```ts
server.registerTool(
  'get_conversation',
  {
    description: 'Get a single conversation with its full message thread, tags, assignee, and linked Shopify customer id. Marks it read.',
    inputSchema: { id: z.string() },
  },
  async (args: { id: string }) => {
    try {
      const detail = await getConversation(supabaseAdmin as never, ctx.workspaceId, args.id)
      if (!detail) return fail(`Conversation ${args.id} not found in this workspace.`)
      return ok(detail)
    } catch (e) {
      return fail(`get_conversation failed: ${e instanceof Error ? e.message : 'unknown error'}`)
    }
  },
)
```

Add to `mcp/tools/inbox.test.ts`: mock `getConversation` from `@/lib/services/conversations`; assert `get_conversation` is registered and returns a not-found `isError` result when the service returns `null`, and `ok` data when it returns a detail.

- [ ] **Step 6: Run tests + lint**

Run: `npm test -- conversations tools/inbox` then `npx eslint lib/services/conversations.ts mcp/tools/inbox.ts`
Expected: all pass; lint clean.

---

### Task 3: Tag enrichment for `list_conversations`

**Files:**
- Modify: `lib/services/conversations.ts`, `lib/services/conversations.test.ts`

**Interfaces:**
- Consumes: `loadTags` (Task 2)
- Produces: `listConversations` now returns real `tags` (replacing the Phase 1 `[]`)

**Invoke `supabase-auth-rules` before editing.**

- [ ] **Step 1: Update the existing test to assert real tags**

In `lib/services/conversations.test.ts`, extend the `listConversations` workspace-scoping test so the fake db also serves `email_conversation_tags` + `tags` (as in Task 2's `detailDb`) for the returned conversation id, and assert the returned row's `tags` contains the enriched tag (not `[]`). Add one row with a known id + a tag link.

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- conversations`
Expected: FAIL — current `listConversations` hardcodes `tags: []`.

- [ ] **Step 3: Enrich `listConversations`**

In `listConversations`, after building `data`, collect the ids and call `loadTags`, then map each row's `tags` from the result:

```ts
const rows = data ?? []
const ids = rows.map((r) => r.id as string)
const tagsByConv = await loadTags(db, workspaceId, ids)
return rows.map((row): ConversationSummary => {
  const store = row.stores as { name: string } | null
  return {
    id: row.id as string,
    subject: (row.subject as string | null) ?? null,
    customer_email: (row.customer_email as string | null) ?? null,
    customer_name: (row.customer_name as string | null) ?? null,
    status: row.status as string,
    last_message_at: (row.last_message_at as string | null) ?? null,
    store_name: store?.name ?? null,
    tags: tagsByConv[row.id as string] ?? [],
  }
})
```

Change the `ConversationSummary.tags` type from `string[]` to `ConversationTag[]` and update any references. (Phase 1 declared `tags: string[]` with a `[]` value; the real shape is tag objects. Search for `ConversationSummary` consumers — only the MCP tools serialize it to JSON, so the type change is safe.)

- [ ] **Step 4: Run + lint**

Run: `npm test -- conversations` then `npx eslint lib/services/conversations.ts`
Expected: PASS; lint clean.

---

### Task 4: Tags — `listTags`, `addTag`, `removeTag` + tools

**Files:**
- Modify: `lib/services/conversations.ts`, `lib/services/conversations.test.ts`, `mcp/tools/inbox.ts`, `mcp/tools/inbox.test.ts`

**Interfaces:**
- Produces: `listTags`, `addTag`, `removeTag` (see locked Interfaces); tools `list_tags`, `add_tag`, `remove_tag`

**Invoke `supabase-auth-rules` before editing the service.**

- [ ] **Step 1: Write failing service tests**

Add to `lib/services/conversations.test.ts`:

```ts
import { listTags, addTag, removeTag } from '@/lib/services/conversations'

describe('tag mutations', () => {
  it('listTags returns workspace tags', async () => {
    const db = { from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: [{ id: 't1', name: 'VIP', color: 'red' }], error: null }) }) }) }) } as never
    expect(await listTags(db, 'w1')).toEqual([{ id: 't1', name: 'VIP', color: 'red' }])
  })
  it('addTag upserts a link scoped to the workspace', async () => {
    const ups: Record<string, unknown>[] = []
    const db = { from: () => ({ upsert: (r: Record<string, unknown>) => { ups.push(r); return Promise.resolve({ error: null }) } }) } as never
    await addTag(db, 'w1', 'c1', 't1')
    expect(ups[0]).toMatchObject({ workspace_id: 'w1', conversation_id: 'c1', tag_id: 't1' })
  })
  it('removeTag deletes the scoped link', async () => {
    const eqs: [string, unknown][] = []
    const chain = { eq: (c: string, v: unknown) => { eqs.push([c, v]); return chain }, then: (r: (x: { error: null }) => void) => r({ error: null }) }
    const db = { from: () => ({ delete: () => chain }) } as never
    await removeTag(db, 'w1', 'c1', 't1')
    expect(eqs).toEqual(expect.arrayContaining([['workspace_id', 'w1'], ['conversation_id', 'c1'], ['tag_id', 't1']]))
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- conversations`
Expected: FAIL — functions not exported.

- [ ] **Step 3: Implement**

Add to `lib/services/conversations.ts` (extend `ConversationsDb` with `upsert`, `delete().eq()` chain, and `select().eq().order()`):

```ts
export async function listTags(db: ConversationsDb, workspaceId: string): Promise<ConversationTag[]> {
  const res = (await db.from('tags').select('id, name, color').eq('workspace_id', workspaceId).order('name', { ascending: true })) as unknown as { data: ConversationTag[] | null; error: { message: string } | null }
  if (res.error) throw new Error(`listTags failed: ${res.error.message}`)
  return res.data ?? []
}

export async function addTag(db: ConversationsDb, workspaceId: string, conversationId: string, tagId: string): Promise<void> {
  const { error } = await db.from('email_conversation_tags').upsert({ workspace_id: workspaceId, conversation_id: conversationId, tag_id: tagId })
  if (error) throw new Error(`addTag failed: ${error.message}`)
}

export async function removeTag(db: ConversationsDb, workspaceId: string, conversationId: string, tagId: string): Promise<void> {
  const { error } = await db.from('email_conversation_tags').delete().eq('workspace_id', workspaceId).eq('conversation_id', conversationId).eq('tag_id', tagId)
  if (error) throw new Error(`removeTag failed: ${error.message}`)
}
```

- [ ] **Step 4: Run service tests**

Run: `npm test -- conversations`
Expected: PASS.

- [ ] **Step 5: Add tools `list_tags`, `add_tag`, `remove_tag` (role-gated) + tests**

In `mcp/tools/inbox.ts`, import `listTags`, `addTag`, `removeTag` and `can` from `@/lib/permissions`. Register:

```ts
server.registerTool('list_tags', { description: 'List all tags in the workspace (id, name, color) so you can tag conversations.', inputSchema: {} },
  async () => {
    try { return ok(await listTags(supabaseAdmin as never, ctx.workspaceId)) }
    catch (e) { return fail(`list_tags failed: ${e instanceof Error ? e.message : 'unknown error'}`) }
  })

server.registerTool('add_tag', { description: 'Add a tag (by tag id) to a conversation.', inputSchema: { conversationId: z.string(), tagId: z.string() } },
  async (args: { conversationId: string; tagId: string }) => {
    if (!can.manageTags(ctx.role)) return fail('Your role cannot manage tags.')
    try { await addTag(supabaseAdmin as never, ctx.workspaceId, args.conversationId, args.tagId); return ok({ added: true }) }
    catch (e) { return fail(`add_tag failed: ${e instanceof Error ? e.message : 'unknown error'}`) }
  })

server.registerTool('remove_tag', { description: 'Remove a tag (by tag id) from a conversation.', inputSchema: { conversationId: z.string(), tagId: z.string() } },
  async (args: { conversationId: string; tagId: string }) => {
    if (!can.manageTags(ctx.role)) return fail('Your role cannot manage tags.')
    try { await removeTag(supabaseAdmin as never, ctx.workspaceId, args.conversationId, args.tagId); return ok({ removed: true }) }
    catch (e) { return fail(`remove_tag failed: ${e instanceof Error ? e.message : 'unknown error'}`) }
  })
```

Add tests to `mcp/tools/inbox.test.ts`: with `ctx.role='agent'`, `add_tag` calls the service; with `ctx.role='observer'`, `add_tag` returns an `isError` result and does NOT call the service (mock `addTag`).

- [ ] **Step 6: Run + lint**

Run: `npm test -- conversations tools/inbox` then `npx eslint lib/services/conversations.ts mcp/tools/inbox.ts`
Expected: pass; clean.

---

### Task 5: `setConversationState` + `set_state` tool

**Files:**
- Modify: `lib/services/conversations.ts`, `lib/services/conversations.test.ts`, `mcp/tools/inbox.ts`, `mcp/tools/inbox.test.ts`

**Interfaces:**
- Produces: `setConversationState` (see locked Interfaces); tool `set_state`

**Invoke `supabase-auth-rules` before editing the service.**

- [ ] **Step 1: Write failing service tests**

Add to `lib/services/conversations.test.ts`:

```ts
import { setConversationState } from '@/lib/services/conversations'

function updateCaptureDb() {
  const updates: Record<string, unknown>[] = []
  const db = { from: () => ({ update: (u: Record<string, unknown>) => { updates.push(u); const chain = { eq: () => chain, then: (r: (x: { error: null }) => void) => r({ error: null }) }; return chain } }) } as never
  return { db, updates }
}

describe('setConversationState', () => {
  it('writes status for a simple status change', async () => {
    const { db, updates } = updateCaptureDb()
    await setConversationState(db, 'w1', 'c1', { status: 'resolved' })
    expect(updates[0]).toMatchObject({ status: 'resolved' })
  })
  it('writes status=snoozed + snoozed_until for snooze', async () => {
    const { db, updates } = updateCaptureDb()
    await setConversationState(db, 'w1', 'c1', { status: 'snoozed', snoozedUntil: '2026-07-01T00:00:00Z' })
    expect(updates[0]).toMatchObject({ status: 'snoozed', snoozed_until: '2026-07-01T00:00:00Z' })
  })
  it('writes assigned_to for assignment', async () => {
    const { db, updates } = updateCaptureDb()
    await setConversationState(db, 'w1', 'c1', { assignedTo: 'member-1' })
    expect(updates[0]).toMatchObject({ assigned_to: 'member-1' })
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- conversations`
Expected: FAIL — not exported.

- [ ] **Step 3: Implement**

Add to `lib/services/conversations.ts`:

```ts
export type ConversationState =
  | { status: 'open' | 'pending' | 'resolved' | 'closed' }
  | { status: 'snoozed'; snoozedUntil: string }
  | { assignedTo: string | null }

export async function setConversationState(
  db: ConversationsDb,
  workspaceId: string,
  conversationId: string,
  state: ConversationState,
): Promise<void> {
  const patch: Record<string, unknown> = {}
  if ('assignedTo' in state) patch.assigned_to = state.assignedTo
  else if (state.status === 'snoozed') { patch.status = 'snoozed'; patch.snoozed_until = state.snoozedUntil }
  else patch.status = state.status

  const { error } = await db.from('email_conversations').update(patch).eq('workspace_id', workspaceId).eq('id', conversationId)
  if (error) throw new Error(`setConversationState failed: ${error.message}`)
}
```

- [ ] **Step 4: Run service tests**

Run: `npm test -- conversations`
Expected: PASS.

- [ ] **Step 5: Add `set_state` tool (role-gated) + test**

In `mcp/tools/inbox.ts`, import `setConversationState`, type `ConversationState`. Register a tool whose args express the union safely:

```ts
server.registerTool(
  'set_state',
  {
    description: 'Change a conversation’s state: set status (open/pending/resolved/closed), snooze until an ISO timestamp, or assign to a member id (or null to unassign).',
    inputSchema: {
      conversationId: z.string(),
      status: z.enum(['open', 'pending', 'resolved', 'closed', 'snoozed']).optional(),
      snoozedUntil: z.string().optional(),
      assignedTo: z.string().nullable().optional(),
    },
  },
  async (args: { conversationId: string; status?: string; snoozedUntil?: string; assignedTo?: string | null }) => {
    if (!can.manageConversations(ctx.role)) return fail('Your role cannot change conversation state.')
    let state: ConversationState
    if (args.assignedTo !== undefined) state = { assignedTo: args.assignedTo }
    else if (args.status === 'snoozed') {
      if (!args.snoozedUntil) return fail('snoozedUntil (ISO timestamp) is required when status is snoozed.')
      state = { status: 'snoozed', snoozedUntil: args.snoozedUntil }
    } else if (args.status) state = { status: args.status as 'open' | 'pending' | 'resolved' | 'closed' }
    else return fail('Provide a status, snoozedUntil, or assignedTo.')

    try { await setConversationState(supabaseAdmin as never, ctx.workspaceId, args.conversationId, state); return ok({ updated: true }) }
    catch (e) { return fail(`set_state failed: ${e instanceof Error ? e.message : 'unknown error'}`) }
  },
)
```

Add a test: `observer` role → `isError`, service not called; `agent` + `{status:'resolved'}` → service called with `{status:'resolved'}`.

- [ ] **Step 6: Run + lint**

Run: `npm test -- conversations tools/inbox` then `npx eslint lib/services/conversations.ts mcp/tools/inbox.ts`
Expected: pass; clean.

---

### Task 6: `createInboxDraft` + `create_draft` tool

**Files:**
- Create: `lib/services/inbox-drafts.ts`, `lib/services/inbox-drafts.test.ts`
- Modify: `mcp/tools/inbox.ts`, `mcp/tools/inbox.test.ts`

**Interfaces:**
- Produces: `createInboxDraft` (see locked Interfaces); tool `create_draft`

**Invoke `supabase-auth-rules` before editing.** Persists Claude's drafted reply into `ai_drafts` (status `pending`) so a human reviews/sends it in the inbox — it does NOT call the cloud AI.

- [ ] **Step 1: Confirm `ai_drafts` required columns**

Run: query the table to see NOT NULL columns the insert must satisfy:

```bash
node --env-file=.env.local --import tsx -e "import {supabaseAdmin} from '@/lib/supabaseAdmin'; const r=await supabaseAdmin.from('ai_drafts').select('*').limit(1); console.log(r.data?.[0]?Object.keys(r.data[0]):r.error?.message)"
```

(If the table is empty, inspect the migration that creates `ai_drafts` under `supabase/migrations/` for `not null` columns.) The insert below sets the columns the Emma path uses; add any other NOT NULL column with a sensible default discovered here, and record it in the report.

- [ ] **Step 2: Write the failing test**

`lib/services/inbox-drafts.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createInboxDraft } from '@/lib/services/inbox-drafts'

describe('createInboxDraft', () => {
  it('inserts a pending ai_drafts row with the provided text', async () => {
    const inserted: Record<string, unknown>[] = []
    const db = { from: () => ({ insert: (r: Record<string, unknown>) => { inserted.push(r); return { select: () => ({ single: async () => ({ data: { id: 'd1' }, error: null }) }) } } }) } as never
    const out = await createInboxDraft(db, { workspaceId: 'w1', conversationId: 'c1', userId: 'u1', text: 'Hello there' })
    expect(out.id).toBe('d1')
    expect(inserted[0]).toMatchObject({ workspace_id: 'w1', conversation_id: 'c1', user_id: 'u1', suggested_text: 'Hello there', status: 'pending' })
  })
})
```

- [ ] **Step 3: Implement**

`lib/services/inbox-drafts.ts`:

```ts
export interface InboxDraftsDb {
  from(table: 'ai_drafts'): {
    insert(row: Record<string, unknown>): { select(cols: string): { single(): Promise<{ data: { id: string } | null; error: { message: string } | null }> } }
  }
}

export async function createInboxDraft(
  db: InboxDraftsDb,
  input: { workspaceId: string; conversationId: string; userId: string; text: string },
): Promise<{ id: string }> {
  const { data, error } = await db
    .from('ai_drafts')
    .insert({
      workspace_id: input.workspaceId,
      conversation_id: input.conversationId,
      user_id: input.userId,
      suggested_text: input.text,
      prompt_path: 'emma',
      model: 'mcp-claude',
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      status: 'pending',
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`createInboxDraft failed: ${error?.message ?? 'no row'}`)
  return { id: data.id }
}
```

> If Step 1 revealed additional NOT NULL columns (e.g. `store_id`), add them here. `store_id` may be nullable; if NOT NULL, fetch it from the conversation first. Record the final column set in the report.

- [ ] **Step 4: Run + implement-pass**

Run: `npm test -- inbox-drafts`
Expected: PASS.

- [ ] **Step 5: Add `create_draft` tool (role-gated) + test**

In `mcp/tools/inbox.ts`, import `createInboxDraft`:

```ts
server.registerTool(
  'create_draft',
  {
    description: 'Save a reply draft (your written text) for a conversation. A human reviews and sends it from the Lynq inbox. Use this when you should not send directly.',
    inputSchema: { conversationId: z.string(), text: z.string().min(1) },
  },
  async (args: { conversationId: string; text: string }) => {
    if (!can.replyToTickets(ctx.role)) return fail('Your role cannot draft replies.')
    try {
      const d = await createInboxDraft(supabaseAdmin as never, { workspaceId: ctx.workspaceId, conversationId: args.conversationId, userId: ctx.userId, text: args.text })
      return ok({ draftId: d.id, status: 'pending' })
    } catch (e) { return fail(`create_draft failed: ${e instanceof Error ? e.message : 'unknown error'}`) }
  },
)
```

Add a test: `observer` → `isError`, service not called; `agent` → calls `createInboxDraft` with `userId`/`workspaceId` from ctx.

- [ ] **Step 6: Run + lint**

Run: `npm test -- inbox-drafts tools/inbox` then `npx eslint lib/services/inbox-drafts.ts mcp/tools/inbox.ts`
Expected: pass; clean.

---

### Task 7: `send_reply` + `link_customer` tools (reuse `conversationEngine`)

**Files:**
- Modify: `mcp/tools/inbox.ts`, `mcp/tools/inbox.test.ts`

**Interfaces:**
- Consumes: `sendReply`, `linkCustomer` from `@/lib/conversationEngine`
- Produces: tools `send_reply`, `link_customer`

- [ ] **Step 1: Write failing tool tests**

Add to `mcp/tools/inbox.test.ts` (mock the engine):

```ts
const sendReply = vi.fn()
const linkCustomer = vi.fn()
vi.mock('@/lib/conversationEngine', () => ({
  sendReply: (...a: unknown[]) => sendReply(...a),
  linkCustomer: (...a: unknown[]) => linkCustomer(...a),
}))
```

(Place the mock with the other `vi.mock` calls at top of file.) Then:

```ts
describe('send_reply', () => {
  beforeEach(() => sendReply.mockReset())
  it('observer cannot send', async () => {
    const { server, tools } = fakeServer()
    registerInboxTools(server as never, { userId: 'u1', workspaceId: 'w1', role: 'observer' })
    const res = await tools.send_reply.handler({ conversationId: 'c1', bodyText: 'hi' })
    expect(res.isError).toBe(true)
    expect(sendReply).not.toHaveBeenCalled()
  })
  it('agent sends via the engine scoped to workspace', async () => {
    const { server, tools } = fakeServer()
    sendReply.mockResolvedValue({ messageId: 'm1' })
    registerInboxTools(server as never, { userId: 'u1', workspaceId: 'w1', role: 'agent' })
    await tools.send_reply.handler({ conversationId: 'c1', bodyText: 'hi', subject: 'Re' })
    expect(sendReply).toHaveBeenCalledWith('w1', 'c1', '', expect.objectContaining({ bodyText: 'hi' }), undefined)
  })
})

describe('link_customer', () => {
  beforeEach(() => linkCustomer.mockReset())
  it('agent links a shopify customer id', async () => {
    const { server, tools } = fakeServer()
    linkCustomer.mockResolvedValue({ success: true })
    registerInboxTools(server as never, { userId: 'u1', workspaceId: 'w1', role: 'agent' })
    await tools.link_customer.handler({ conversationId: 'c1', shopifyCustomerId: 'cust1' })
    expect(linkCustomer).toHaveBeenCalledWith('w1', 'c1', 'cust1')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tools/inbox`
Expected: FAIL — tools not registered.

- [ ] **Step 3: Implement the tools**

In `mcp/tools/inbox.ts`, import `{ sendReply, linkCustomer } from '@/lib/conversationEngine'` and `can`:

```ts
server.registerTool(
  'send_reply',
  {
    description: 'Send a reply email on a conversation NOW (it goes to the customer immediately). Provide bodyText and/or bodyHtml. Prefer create_draft if a human should review first.',
    inputSchema: {
      conversationId: z.string(),
      bodyText: z.string().optional(),
      bodyHtml: z.string().optional(),
      subject: z.string().optional(),
      to: z.string().optional(),
      cc: z.string().optional(),
      bcc: z.string().optional(),
    },
  },
  async (args: { conversationId: string; bodyText?: string; bodyHtml?: string; subject?: string; to?: string; cc?: string; bcc?: string }) => {
    if (!can.replyToTickets(ctx.role)) return fail('Your role cannot send replies.')
    if (!args.bodyText && !args.bodyHtml) return fail('Provide bodyText and/or bodyHtml.')
    try {
      const result = await sendReply(ctx.workspaceId, args.conversationId, '', {
        to: args.to, cc: args.cc, bcc: args.bcc, subject: args.subject, bodyHtml: args.bodyHtml, bodyText: args.bodyText,
      }, undefined)
      return ok({ sent: true, result })
    } catch (e) { return fail(`send_reply failed: ${e instanceof Error ? e.message : 'unknown error'}`) }
  },
)

server.registerTool(
  'link_customer',
  {
    description: 'Link a conversation to a Shopify customer id so order context resolves.',
    inputSchema: { conversationId: z.string(), shopifyCustomerId: z.string() },
  },
  async (args: { conversationId: string; shopifyCustomerId: string }) => {
    if (!can.manageConversations(ctx.role)) return fail('Your role cannot link customers.')
    try { return ok(await linkCustomer(ctx.workspaceId, args.conversationId, args.shopifyCustomerId)) }
    catch (e) { return fail(`link_customer failed: ${e instanceof Error ? e.message : 'unknown error'}`) }
  },
)
```

> `sendReply`'s 3rd arg is `userEmail` (used only for display attribution); the MCP context has no email, so pass `''` — the engine resolves the sending account from the conversation, not this arg. The 5th arg `memberId` is optional attribution; pass `undefined`.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- tools/inbox`
Expected: PASS.

- [ ] **Step 5: Lint**

Run: `npx eslint mcp/tools/inbox.ts mcp/tools/inbox.test.ts`
Expected: clean.

---

### Task 8: Update server instructions + full unit suite

**Files:**
- Modify: `mcp/instructions.ts`

**Interfaces:**
- Consumes: nothing
- Produces: instructions that describe the new inbox workflow tools

- [ ] **Step 1: Expand the instructions**

In `mcp/instructions.ts`, extend `LYNQ_MCP_INSTRUCTIONS` to describe the workflow with the new tools (keep the existing Emma/"replace cloud AI" guidance). Add, in prose:

```
Working a ticket:
- list_conversations / get_conversation to find and read a ticket fully (get_conversation returns the message thread, tags, assignee, and any linked Shopify customer).
- Draft vs send: use create_draft to leave a reply for a human to review and send; use send_reply ONLY when you should send to the customer immediately — it dispatches the email right away.
- set_state to resolve, close, reopen (status 'open'), snooze (status 'snoozed' + snoozedUntil ISO timestamp), or assign (assignedTo a member id, or null to unassign).
- list_tags then add_tag / remove_tag to label tickets.
- link_customer to attach a Shopify customer id when you have identified the customer.
Respect your role: if a tool reports your role cannot perform an action, tell the user instead of trying to work around it.
```

- [ ] **Step 2: Run the full suite**

Run: `npm test`
Expected: all test files pass (Phases 1–2 + new conversations/tools/inbox-drafts).

- [ ] **Step 3: Lint the changed files**

Run: `npx eslint mcp/instructions.ts`
Expected: clean.

---

### Task 9: Live end-to-end verification (read tools against real data; writes safely)

**Files:** none (verification only)

**Interfaces:**
- Consumes: the running app + a minted access token

- [ ] **Step 1: Mint a token for the existing dev workspace**

Use the Phase 1 dev workspace that has real conversations. Run:

```bash
node --env-file=.env.local --import tsx scripts/mint-mcp-token.ts ce5e3b7b-d4f9-46ce-be7c-630fef608145 1d1405e2-accd-4c22-bf3f-936327f02fef
```

(That user+workspace was used in Phase 1 and has conversations. If `mint-mcp-token.ts` was removed, recreate it per Phase 1 Task 8.) Start `npm run dev`.

- [ ] **Step 2: Verify the new tools are listed**

```bash
TOKEN="<lynq_at_…>"; BASE=http://localhost:3000; ACC="application/json, text/event-stream"
curl -sS -X POST $BASE/api/v1/mcp -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "Accept: $ACC" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | grep -oE '"name":"[a-z_]+"' | sort -u
```

Expected: includes `list_conversations, get_conversation, list_tags, add_tag, remove_tag, set_state, create_draft, send_reply, link_customer`.

- [ ] **Step 3: Read tools against real data**

```bash
# pick a real conversation id from list_conversations, then:
CID="<conversation id>"
curl -sS -X POST $BASE/api/v1/mcp -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "Accept: $ACC" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"get_conversation\",\"arguments\":{\"id\":\"$CID\"}}}" | tail -c 600
curl -sS -X POST $BASE/api/v1/mcp -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "Accept: $ACC" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"list_tags","arguments":{}}}' | tail -c 300
```

Expected: `get_conversation` returns the thread + tags + assignee; `list_tags` returns the workspace tags.

- [ ] **Step 4: Verify a safe state change + tag round-trip (NON-destructive, NO email)**

On a chosen test conversation, exercise `set_state` (e.g. assign then unassign, or set `pending`→`open`) and `add_tag`/`remove_tag` with a real tag id from Step 3, confirming each returns `{updated:true}`/`{added:true}`/`{removed:true}` and that re-reading via `get_conversation` reflects the change. **Do NOT call `send_reply` against a real customer conversation.** To prove `send_reply` wiring without emailing a customer, either (a) assert role-gating by minting a token for an `observer`-role member and confirming `send_reply` returns the role error, or (b) skip the live send and rely on the unit test — state which you did in the report.

- [ ] **Step 5: Restore any test mutations + stop the server**

Revert the conversation's state/tags you changed in Step 4 to their original values (re-read first to capture them), then `pkill -f "next dev"`. Note in the report exactly what was changed and restored.

---

## Self-Review

**Spec coverage (design §6.2 MVP inbox surface):**
- list/get conversation → Tasks 1, 2 (+ tag enrichment Task 3).
- create draft (persist Claude's text for review) → Task 6.
- send reply (direct) → Task 7.
- ticket state: resolve/close/reopen/assign/snooze → Task 5.
- tags: list/add/remove + enrichment → Tasks 3, 4.
- link customer → Task 7.
- role gating on every write (`replyToTickets`/`manageConversations`/`manageTags`) → Tasks 4–7.
- instructions updated → Task 8; live verification → Task 9.
- **Deferred to Phase 3b (explicit):** macros, orders (read), analytics (read), search. **Phase 4:** Emma config editing, settings UI, `/oauth/revoke`, connected-apps management.

**Placeholder scan:** every code/test step is concrete. The `ai_drafts` column-confirm (Task 6 Step 1) is a real verification command, not a deferral. Task 9's "(a) or (b)" send-safety choice is a deliberate safety branch with a reporting requirement, not vagueness.

**Type consistency:** `ConversationTag`, `ConversationMessage`, `ConversationDetail`, `ConversationState`, `getConversation`, `loadTags`, `listTags`, `addTag`, `removeTag`, `setConversationState`, `createInboxDraft`, `registerInboxTools` are defined once and consumed with matching names/shapes across tasks. `ConversationSummary.tags` is migrated from `string[]` to `ConversationTag[]` in Task 3 (only consumer is JSON serialization in the tools). `sendReply`/`linkCustomer` calls match the verified `conversationEngine` signatures. The `ok`/`fail` helpers are defined once in `mcp/tools/inbox.ts` (Task 1) and reused.

---

## Next phases (not in this plan)

- **Phase 3b — supporting read tools:** `list_macros`/`get_macro` (Postgres RPCs `api_list_macros`/`api_get_macro`), orders read (`getOrders`/`getOrderDetail`/`getCustomer` + `getStoreCredentials`), analytics read (`getKPIs`/`getRevenueTrend`), `search` (mirror `searchService`/`api_search` RPC into a Next-side service). Invoke `shopify-rules` for the Shopify tools.
- **Phase 4 — Emma config tools + settings UI + `/oauth/revoke` + connected-apps management.**
