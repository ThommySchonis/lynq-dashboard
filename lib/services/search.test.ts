import { describe, it, expect, vi } from 'vitest'
import { searchWorkspace } from '@/lib/services/search'

describe('searchWorkspace', () => {
  it('calls api_search with p_workspace_id + params and returns data', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { conversations: [{ id: 'c1' }] }, error: null })
    const out = await searchWorkspace({ rpc } as never, 'w1', { q: 'refund', limit: 5 })
    expect(rpc).toHaveBeenCalledWith('api_search', expect.objectContaining({ p_workspace_id: 'w1', p_q: 'refund', p_limit: 5 }))
    expect(out).toEqual({ conversations: [{ id: 'c1' }] })
  })
  it('throws on rpc error', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } })
    await expect(searchWorkspace({ rpc } as never, 'w1', { q: 'x' })).rejects.toThrow('boom')
  })
})
