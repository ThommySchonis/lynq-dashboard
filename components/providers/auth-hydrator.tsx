'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import type { Workspace, Role } from '@/types/database'

export function AuthHydrator() {
  const setSession = useAuthStore((s) => s.setSession)
  const setWorkspace = useAuthStore((s) => s.setWorkspace)
  const setLoading = useAuthStore((s) => s.setLoading)
  const clearSession = useAuthStore((s) => s.clearSession)

  async function loadWorkspace(userId: string) {
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
        void loadWorkspace(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          setSession(session)
          void loadWorkspace(session.user.id)
        } else {
          clearSession()
        }
      },
    )

    return () => subscription.unsubscribe()
  }, [setSession, setWorkspace, setLoading, clearSession]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
