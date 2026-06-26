import { describe, it, expect, vi, beforeEach } from 'vitest'

const verifyAccessTokenMock = vi.fn()
const membershipMaybeSingle = vi.fn()
const profileMaybeSingle = vi.fn()

vi.mock('@/lib/services/oauth-tokens', () => ({
  verifyAccessToken: (...args: unknown[]): unknown => verifyAccessTokenMock(...args),
}))
vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === 'user_profiles') {
        return { select: () => ({ eq: () => ({ maybeSingle: profileMaybeSingle }) }) }
      }
      // workspace_members (and any other table)
      return { select: () => ({ eq: () => ({ maybeSingle: membershipMaybeSingle }) }) }
    },
  },
}))

import { verifyMcpAccessToken } from '@/lib/services/mcp-auth'

beforeEach(() => {
  verifyAccessTokenMock.mockReset()
  membershipMaybeSingle.mockReset()
  profileMaybeSingle.mockReset()
  // Default: user_profiles returns no row (existing tests don't care about deletion)
  profileMaybeSingle.mockResolvedValue({ data: null, error: null })
})

describe('verifyMcpAccessToken', () => {
  it('returns null when the token is invalid', async () => {
    verifyAccessTokenMock.mockResolvedValue(null)
    expect(await verifyMcpAccessToken('lynq_at_bad')).toBeNull()
  })

  it('builds an AuthContext from the token workspace + membership role', async () => {
    verifyAccessTokenMock.mockResolvedValue({ tokenId: 't', clientId: 'c', userId: 'u1', workspaceId: 'w1', scope: null })
    membershipMaybeSingle.mockResolvedValue({
      data: { id: 'm1', workspace_id: 'w1', role: 'agent', workspaces: { id: 'w1', name: 'Acme', suspended_at: null } },
      error: null,
    })
    const ctx = await verifyMcpAccessToken('lynq_at_ok')
    expect(ctx?.workspaceId).toBe('w1')
    expect(ctx?.role).toBe('agent')
    expect(ctx?.user.id).toBe('u1')
    expect(ctx?.isSuspended).toBe(false)
  })

  it('returns null when the membership workspace mismatches the token workspace', async () => {
    verifyAccessTokenMock.mockResolvedValue({ tokenId: 't', clientId: 'c', userId: 'u1', workspaceId: 'w1', scope: null })
    membershipMaybeSingle.mockResolvedValue({
      data: { id: 'm1', workspace_id: 'w2', role: 'agent', workspaces: { id: 'w2', name: 'Other', suspended_at: null } },
      error: null,
    })
    expect(await verifyMcpAccessToken('lynq_at_ok')).toBeNull()
  })

  it('carries scheduledForDeletion from user_profiles into AuthContext', async () => {
    verifyAccessTokenMock.mockResolvedValue({ tokenId: 't', clientId: 'c', userId: 'u1', workspaceId: 'w1', scope: null })
    membershipMaybeSingle.mockResolvedValue({
      data: { id: 'm1', workspace_id: 'w1', role: 'agent', workspaces: { id: 'w1', name: 'Acme', suspended_at: null } },
      error: null,
    })
    profileMaybeSingle.mockResolvedValue({
      data: { scheduled_for_deletion_at: '2026-07-01T00:00:00.000Z' },
      error: null,
    })
    const ctx = await verifyMcpAccessToken('lynq_at_scheduled')
    expect(ctx?.scheduledForDeletion).toBe('2026-07-01T00:00:00.000Z')
  })
})
