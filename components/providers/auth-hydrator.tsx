'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { apiUrl } from '@/lib/api-client'
import type { Workspace, Role } from '@/types/database'

interface ImpersonationStatusResponse {
  active: boolean
  workspace?: Workspace
  sessionId?: string
}

export function AuthHydrator() {
  const setSession = useAuthStore((s) => s.setSession)
  const setWorkspace = useAuthStore((s) => s.setWorkspace)
  const setLoading = useAuthStore((s) => s.setLoading)
  const clearSession = useAuthStore((s) => s.clearSession)
  const setImpersonating = useAuthStore((s) => s.setImpersonating)

  async function loadWorkspace(userId: string, accessToken: string) {
    // Check for active impersonation session first
    try {
      const res = await fetch(apiUrl('auth/impersonation-status'), {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (res.ok) {
        const status = await res.json() as ImpersonationStatusResponse
        if (status.active && status.workspace) {
          setWorkspace(status.workspace, 'owner' as Role, null)
          setImpersonating(status.sessionId ?? null)
          setLoading(false)
          return
        }
      }
    } catch {
      // Fall through to normal workspace loading
    }

    // Normal path: load own workspace from workspace_members
    setImpersonating(null)
    const { data: member } = await supabase
      .from('workspace_members')
      .select('id, role, workspace_id, workspaces(*)')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (member) {
      const raw = member.workspaces as Record<string, unknown> | Record<string, unknown>[] | null
      const workspace = (Array.isArray(raw) ? raw[0] : raw) as Workspace | null
      setWorkspace(
        workspace,
        member.role as Role | null,
        member.id as string | null,
      )
    }
    setLoading(false)
  }

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session)
        void loadWorkspace(session.user.id, session.access_token)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          setSession(session)
          void loadWorkspace(session.user.id, session.access_token)
        } else {
          clearSession()
        }
      },
    )

    return () => subscription.unsubscribe()
  }, [setSession, setWorkspace, setLoading, clearSession, setImpersonating]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
