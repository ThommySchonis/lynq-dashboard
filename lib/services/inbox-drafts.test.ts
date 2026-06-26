import { describe, it, expect } from 'vitest'
import { createInboxDraft } from '@/lib/services/inbox-drafts'

describe('createInboxDraft', () => {
  it('inserts a pending ai_drafts row with the provided text', async () => {
    const inserted: Record<string, unknown>[] = []
    const db = {
      from: () => ({
        insert: (r: Record<string, unknown>) => {
          inserted.push(r)
          return {
            select: () => ({
              single: async () => ({ data: { id: 'd1' }, error: null }),
            }),
          }
        },
      }),
    } as never
    const out = await createInboxDraft(db, { workspaceId: 'w1', conversationId: 'c1', userId: 'u1', text: 'Hello there' })
    expect(out.id).toBe('d1')
    expect(inserted[0]).toMatchObject({ workspace_id: 'w1', conversation_id: 'c1', user_id: 'u1', suggested_text: 'Hello there', status: 'pending' })
  })
})
