import { create } from 'zustand'
import type { Workspace, Role } from '@/types'
import type { User, Session } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  session: Session | null
  workspace: Workspace | null
  workspaceId: string | null
  role: Role | null
  memberId: string | null
  isLoading: boolean
  isSuspended: boolean
  suspensionReason: string | null
  isImpersonating: boolean
  impersonationSessionId: string | null
  setImpersonating: (sessionId: string | null) => void

  setSession: (session: Session | null) => void
  setWorkspace: (workspace: Workspace | null, role: Role | null, memberId: string | null) => void
  clearSession: () => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  session: null,
  workspace: null,
  workspaceId: null,
  role: null,
  memberId: null,
  isLoading: true,
  isSuspended: false,
  suspensionReason: null,
  isImpersonating: false,
  impersonationSessionId: null,

  setImpersonating: (sessionId) =>
    set({
      isImpersonating: !!sessionId,
      impersonationSessionId: sessionId,
    }),

  setSession: (session) =>
    set({
      session,
      user: session?.user ?? null,
    }),

  setWorkspace: (workspace, role, memberId) =>
    set({
      workspace,
      workspaceId: workspace?.id ?? null,
      role,
      memberId,
      isSuspended: !!workspace?.suspended_at,
      suspensionReason: workspace?.suspension_reason ?? null,
    }),

  clearSession: () =>
    set({
      user: null,
      session: null,
      workspace: null,
      workspaceId: null,
      role: null,
      memberId: null,
      isLoading: false,
      isSuspended: false,
      suspensionReason: null,
      isImpersonating: false,
      impersonationSessionId: null,
    }),

  setLoading: (isLoading) => set({ isLoading }),
}))
