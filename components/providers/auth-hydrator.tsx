'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

export function AuthHydrator() {
  const setSession = useAuthStore((s) => s.setSession)
  const setWorkspace = useAuthStore((s) => s.setWorkspace)
  const setLoading = useAuthStore((s) => s.setLoading)
  const clearSession = useAuthStore((s) => s.clearSession)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session)
        loadWorkspace(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          setSession(session)
          loadWorkspace(session.user.id)
        } else {
          clearSession()
        }
      },
    )

    return () => subscription.unsubscribe()
  }, [setSession, setWorkspace, setLoading, clearSession])

  async function loadWorkspace(userId: string) {
    const { data: member } = await supabase
      .from('workspace_members')
      .select('id, role, workspace_id, workspaces(*)')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (member) {
      const workspace = Array.isArray(member.workspaces)
        ? member.workspaces[0]
        : member.workspaces
      setWorkspace(workspace, member.role, member.id)
    }
    setLoading(false)
  }

  return null
}
