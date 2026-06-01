import type { User } from '@supabase/supabase-js'

export interface AuthWorkspace {
  id: string
  name: string
  suspended_at: string | null
}

export interface AuthContext {
  user: User
  workspace: AuthWorkspace
  workspaceId: string
  role: string
  memberId: string | null
  isSuspended: boolean
  scheduledForDeletion: string | null
  isImpersonating: boolean
  impersonationSessionId: string | null
}
