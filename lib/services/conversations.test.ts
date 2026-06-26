import { describe, it, expect } from 'vitest'
import { listConversations, getConversation, listTags, addTag, removeTag, setConversationState, createTag, deleteTag } from '@/lib/services/conversations'

/** Records the query chain calls and returns the seeded rows. */
function fakeDb(rows: Record<string, unknown>[]) {
  const calls: Record<string, unknown> = {}
  const q: Record<string, unknown> = {}
  const chain = {
    select: (c: string) => { calls.select = c; return chain },
    eq: (c: string, v: unknown) => { (q[c] = v); return chain },
    neq: (c: string, v: unknown) => { calls[`neq_${c}`] = v; return chain },
    is: (c: string, v: unknown) => { calls[`is_${c}`] = v; return chain },
    order: () => chain,
    range: () => chain,
    then: (res: (r: { data: unknown[]; error: null }) => void) => res({ data: rows, error: null }),
  }
  const db = { from: (t: string) => { calls.table = t; return chain } }
  return { db: db as never, calls, q }
}

describe('listConversations', () => {
  it('scopes by workspace_id and returns mapped summaries with enriched tags', async () => {
    const conversationRow = { id: 'c1', subject: 'Hi', customer_email: 'a@b.c', customer_name: 'A', status: 'open',
      last_message_at: '2026-06-26T00:00:00Z', stores: { name: 'Shop' } }

    // Multi-table db that serves conversations, tags, and tag links
    const db = {
      from(table: string) {
        if (table === 'email_conversations') {
          const chain = {
            select: (_c: string) => chain,
            eq: (_c: string, _v: unknown) => chain,
            neq: (_c: string, _v: unknown) => chain,
            is: (_c: string, _v: unknown) => chain,
            order: () => chain,
            range: () => chain,
            then: (res: (r: { data: unknown[]; error: null }) => void) => res({ data: [conversationRow], error: null }),
          }
          return chain
        }
        if (table === 'email_conversation_tags') {
          return {
            select: () => ({
              eq: () => ({
                in: async () => ({ data: [{ conversation_id: 'c1', tag_id: 'tag1' }], error: null })
              })
            })
          }
        }
        if (table === 'tags') {
          return {
            select: () => ({
              eq: () => ({
                in: async () => ({ data: [{ id: 'tag1', name: 'VIP', color: 'red' }], error: null })
              })
            })
          }
        }
        throw new Error('unexpected table ' + table)
      }
    }

    const out = await listConversations(db as never, 'w1', {})
    expect(out[0]).toMatchObject({ id: 'c1', store_name: 'Shop', tags: [{ id: 'tag1', name: 'VIP', color: 'red' }] })
    expect(out[0]).not.toHaveProperty('stores')
  })

  it('filters by status when provided', async () => {
    const { db, q } = fakeDb([])
    await listConversations(db, 'w1', { status: 'closed' })
    expect(q.status).toBe('closed')
  })
})

function detailDb(opts: {
  conversation: Record<string, unknown> | null
  messages?: Record<string, unknown>[]
  tagLinks?: { conversation_id?: string; tag_id: string }[]
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
      tagLinks: [{ conversation_id: 'c1', tag_id: 'tag1' }],
      tags: [{ id: 'tag1', name: 'VIP', color: 'red' }],
    })
    const d = await getConversation(db, 'w1', 'c1')
    expect(d?.id).toBe('c1')
    expect(d?.messages[0].body_text).toBe('hello')
    expect(d?.tags).toEqual([{ id: 'tag1', name: 'VIP', color: 'red' }])
  })
})

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

describe('createTag', () => {
  it('inserts a workspace-scoped tag with created_by and returns it', async () => {
    const inserted: Record<string, unknown>[] = []
    const db = { from: () => ({ insert: (r: Record<string, unknown>) => { inserted.push(r); return { select: () => ({ single: async () => ({ data: { id: 't1', name: r.name, color: r.color }, error: null }) }) } } }) } as never
    const tag = await createTag(db, 'w1', 'u1', { name: 'VIP', color: 'red' })
    expect(inserted[0]).toMatchObject({ workspace_id: 'w1', name: 'VIP', color: 'red', created_by: 'u1' })
    expect(tag).toEqual({ id: 't1', name: 'VIP', color: 'red' })
  })
  it('defaults color to slate when omitted', async () => {
    const inserted: Record<string, unknown>[] = []
    const db = { from: () => ({ insert: (r: Record<string, unknown>) => { inserted.push(r); return { select: () => ({ single: async () => ({ data: { id: 't1', name: r.name, color: r.color }, error: null }) }) } } }) } as never
    await createTag(db, 'w1', 'u1', { name: 'X' })
    expect(inserted[0].color).toBe('slate')
  })
})

describe('deleteTag', () => {
  it('deletes the tag scoped to the workspace', async () => {
    const eqs: [string, unknown][] = []
    const chain = { eq: (c: string, v: unknown) => { eqs.push([c, v]); return chain }, then: (r: (x: { error: null }) => void) => r({ error: null }) }
    const db = { from: () => ({ delete: () => chain }) } as never
    await deleteTag(db, 'w1', 't1')
    expect(eqs).toEqual(expect.arrayContaining([['workspace_id', 'w1'], ['id', 't1']]))
  })
})

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
