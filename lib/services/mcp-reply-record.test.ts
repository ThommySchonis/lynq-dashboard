import { describe, it, expect, vi, beforeEach } from 'vitest'

let lastInsert: Record<string, unknown> | null = null
let insertShouldThrow = false
let insertReturnsNullData = false
vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from() {
      return {
        insert(row: Record<string, unknown>) {
          lastInsert = row
          if (insertShouldThrow) throw new Error('db down')
          return { select: () => ({ single: () => Promise.resolve(insertReturnsNullData ? { data: null, error: { message: 'boom' } } : { data: { id: 'draft-1' }, error: null }) }) }
        },
      }
    },
  },
}))

import { recordMcpDraft } from '@/lib/services/mcp-reply-record'

beforeEach(() => {
  lastInsert = null
  insertShouldThrow = false
  insertReturnsNullData = false
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

  it('returns null when the insert resolves with an error and no row', async () => {
    insertReturnsNullData = true
    const id = await recordMcpDraft({
      workspaceId: 'w1', storeId: 's1', conversationId: 'c1', userId: 'u1',
      text: 'hi', intent: 'wismo', confidence: 0.9, shouldEscalate: false,
      autoSent: true, blockedReason: null,
    })
    expect(id).toBeNull()
  })
})
