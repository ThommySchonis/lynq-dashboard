// supabase/functions/api/tests/migrations-orchestrator.test.ts

import { assertEquals } from '@std/assert'
import { advancePhase, isJobDone } from '../lib/services/migrations/orchestrator.ts'

Deno.test('advancePhase: null → tags', () => {
  assertEquals(advancePhase(null), 'tags')
})

Deno.test('advancePhase: tags → macros', () => {
  assertEquals(advancePhase('tags'), 'macros')
})

Deno.test('advancePhase: macros → conversations', () => {
  assertEquals(advancePhase('macros'), 'conversations')
})

Deno.test('advancePhase: conversations → null (done)', () => {
  assertEquals(advancePhase('conversations'), null)
})

Deno.test('isJobDone: returns true when phase is null', () => {
  assertEquals(isJobDone(null), true)
  assertEquals(isJobDone('tags'), false)
})

import { processOneChunk } from '../lib/services/migrations/orchestrator.ts'
import type { SourceAdapter, MigrationJob, Page, NormalizedTag, NormalizedMacro, NormalizedConversation } from '../lib/services/migrations/types.ts'

function makeStubAdapter(opts: {
  tags?: NormalizedTag[][]
  macros?: NormalizedMacro[][]
  conversations?: NormalizedConversation[][]
} = {}): SourceAdapter {
  const tagPages = opts.tags ?? []
  const macroPages = opts.macros ?? []
  const convPages = opts.conversations ?? []
  return {
    platform: 'gorgias',
    verifyCredentials: () => Promise.resolve(),
    listMailboxes: () => Promise.resolve([]),
    countAll: () => Promise.resolve({ tags: 0, macros: 0, conversations: 0 }),
    fetchTags: (_c, cursor) => {
      const idx = cursor ? parseInt(cursor, 10) : 0
      const page = tagPages[idx] ?? []
      return Promise.resolve({ items: page, nextCursor: idx + 1 < tagPages.length ? String(idx + 1) : null } as Page<NormalizedTag>)
    },
    fetchMacros: (_c, cursor) => {
      const idx = cursor ? parseInt(cursor, 10) : 0
      const page = macroPages[idx] ?? []
      return Promise.resolve({ items: page, nextCursor: idx + 1 < macroPages.length ? String(idx + 1) : null })
    },
    fetchConversations: (_c, _r, _m, cursor) => {
      const idx = cursor ? parseInt(cursor, 10) : 0
      const page = convPages[idx] ?? []
      return Promise.resolve({ items: page, nextCursor: idx + 1 < convPages.length ? String(idx + 1) : null })
    },
  }
}

// In-memory fake Supabase client. Only implements the surface processOneChunk uses.
function makeFakeSb() {
  const inserts: Record<string, unknown[]> = { tags: [], macros: [], email_conversations: [], email_messages: [], email_conversation_tags: [] }
  const updates: Array<{ table: string; values: Record<string, unknown>; where: Record<string, unknown> }> = []
  return {
    inserts,
    updates,
    from(table: string) {
      return {
        upsert: (rows: unknown[] | unknown, _opts?: unknown) => {
          const items = Array.isArray(rows) ? rows : [rows]
          inserts[table] = (inserts[table] ?? []).concat(items)
          // For email_conversations we need to fake the returned ids (since the orchestrator
          // chains .select('id, source_external_id') after upsert)
          const synthRows = items.map((r, i) => {
            const row = r as Record<string, unknown>
            return { id: `fake-${table}-${i}-${row.source_external_id ?? ''}`, source_external_id: row.source_external_id }
          })
          const result: { data: unknown; error: null } = { data: items, error: null }
          // Some callers chain .select(...) after .upsert(...) to get the ids back
          const chainable = Promise.resolve(result) as Promise<typeof result> & { select: (cols: string) => Promise<{ data: unknown; error: null }> }
          chainable.select = (_cols: string) => Promise.resolve({ data: synthRows, error: null })
          return chainable
        },
        update: (values: Record<string, unknown>) => ({
          eq: (col: string, val: unknown) => {
            updates.push({ table, values, where: { [col]: val } })
            return Promise.resolve({ data: null, error: null })
          },
        }),
        select: (_cols?: string) => ({
          eq: (_c: string, _v: unknown) => ({
            single: () => Promise.resolve({ data: null, error: null }),
            eq: (_c2: string, _v2: unknown) => ({
              in: (_c3: string, _ids: string[]) => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }),
      }
    },
  }
}

Deno.test('processOneChunk: advances tags phase + persists cursor', async () => {
  const sb = makeFakeSb()
  const job: MigrationJob = {
    id: 'job-1',
    workspace_id: 'ws-1',
    source_platform: 'gorgias',
    credentials_ref: null,
    phase: 'tags',
    time_range_start: null,
    time_range_end: null,
    mailbox_links: {},
    cursor: {},
    progress: {},
  }
  const adapter = makeStubAdapter({ tags: [
    [{ source_external_id: 'g-1', name: 'VIP', color: '#f00' }],
    [{ source_external_id: 'g-2', name: 'Refund', color: null }],
  ] })

  const r1 = await processOneChunk(sb as unknown as never, job, adapter, { authMethod: 'api_key' })
  const tagsAfterR1: number = sb.inserts.tags.length
  if (tagsAfterR1 !== 1) throw new Error('expected 1 tag upsert')
  if ((r1.updatedJob.cursor.tags ?? null) !== '1') throw new Error('cursor should advance to "1"')
  if (r1.done) throw new Error('not done yet')

  const r2 = await processOneChunk(sb as unknown as never, r1.updatedJob, adapter, { authMethod: 'api_key' })
  const tagsAfterR2: number = sb.inserts.tags.length
  if (tagsAfterR2 !== 2) throw new Error('expected 2 tag upserts total')
  if (r2.updatedJob.phase !== 'macros') throw new Error('phase should advance to macros')
})

Deno.test('processOneChunk: skips conversations whose source_mailbox_id is not in mailbox_links', async () => {
  const sb = makeFakeSb()
  const job: MigrationJob = {
    id: 'job-1',
    workspace_id: 'ws-1',
    source_platform: 'gorgias',
    credentials_ref: null,
    phase: 'conversations',
    time_range_start: '2026-01-01T00:00:00Z',
    time_range_end: '2026-06-10T00:00:00Z',
    mailbox_links: { 'box-1': 'email-account-1' },
    cursor: {},
    progress: {},
  }
  const adapter = makeStubAdapter({ conversations: [[
    { source_external_id: 'c1', source_mailbox_id: 'box-1', subject: 's', customer_email: 'a@b.com', customer_name: null,
      status: 'open', created_at: '2026-02-01T00:00:00Z', updated_at: '2026-02-01T00:00:00Z', tag_external_ids: [], messages: [] },
    { source_external_id: 'c2', source_mailbox_id: 'box-2', subject: 's', customer_email: 'c@d.com', customer_name: null,
      status: 'open', created_at: '2026-02-01T00:00:00Z', updated_at: '2026-02-01T00:00:00Z', tag_external_ids: [], messages: [] },
  ]] })

  await processOneChunk(sb as unknown as never, job, adapter, { authMethod: 'api_key' })

  if (sb.inserts.email_conversations.length !== 1) {
    throw new Error(`expected 1 conversation upsert, got ${sb.inserts.email_conversations.length}`)
  }
})
