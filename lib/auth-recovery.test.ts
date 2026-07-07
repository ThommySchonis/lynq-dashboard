import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Session } from '@supabase/supabase-js'

const refreshSession = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { refreshSession: (...args: unknown[]): unknown => refreshSession(...args) } },
}))

import { isAuthError, recoverAuth, __resetAuthRecovery } from '@/lib/auth-recovery'
import { useAuthStore } from '@/stores/auth'

const fakeSession = { access_token: 'fresh', user: { id: 'u1' } } as unknown as Session

function seedSession() {
  useAuthStore.setState({ session: fakeSession, user: fakeSession.user })
}

beforeEach(() => {
  refreshSession.mockReset()
  __resetAuthRecovery()
  seedSession()
})

describe('isAuthError', () => {
  it('is true only for an "Unauthorized" Error (the 401 body)', () => {
    expect(isAuthError(new Error('Unauthorized'))).toBe(true)
    expect(isAuthError(new Error('Request failed: 500'))).toBe(false)
    expect(isAuthError('Unauthorized')).toBe(false)
    expect(isAuthError(null)).toBe(false)
  })
})

describe('recoverAuth', () => {
  it('refreshes and keeps the session when the refresh token is still valid', async () => {
    refreshSession.mockResolvedValue({ data: { session: fakeSession }, error: null })

    expect(await recoverAuth()).toBe(true)
    expect(refreshSession).toHaveBeenCalledTimes(1)
    expect(useAuthStore.getState().session).toBe(fakeSession) // not cleared
  })

  it('clears the session (→ AuthGuard redirects to /login) when refresh fails', async () => {
    refreshSession.mockResolvedValue({ data: { session: null }, error: { message: 'invalid refresh token' } })

    expect(await recoverAuth()).toBe(false)
    expect(useAuthStore.getState().session).toBeNull()
  })

  it('signs out instead of looping when a just-refreshed token is still rejected', async () => {
    refreshSession.mockResolvedValue({ data: { session: fakeSession }, error: null })
    expect(await recoverAuth()).toBe(true) // first 401: refresh succeeds

    // A second 401 arrives moments later — the fresh token is being rejected
    // server-side. We must not loop; sign out instead.
    expect(await recoverAuth()).toBe(false)
    expect(useAuthStore.getState().session).toBeNull()
    expect(refreshSession).toHaveBeenCalledTimes(1) // no second refresh attempt
  })

  it('dedupes concurrent 401s into a single refresh attempt', async () => {
    let resolveRefresh!: (v: unknown) => void
    refreshSession.mockReturnValue(new Promise((r) => { resolveRefresh = r }))

    const a = recoverAuth()
    const b = recoverAuth()
    resolveRefresh({ data: { session: fakeSession }, error: null })

    expect(await a).toBe(true)
    expect(await b).toBe(true)
    expect(refreshSession).toHaveBeenCalledTimes(1)
  })
})
