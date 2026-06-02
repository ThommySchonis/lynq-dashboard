'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { rpc } from '@/lib/rpc'
import { parseJson } from '@/lib/utils/typed-json'
import type { Task, TaskFilters } from '@/types/tasks'

interface WorkspaceMembersResponse {
  members?: Array<{
    id: string
    display_name?: string
    email?: string
    role?: string
  }>
}

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export const taskKeys = {
  all: ['tasks'] as const,
  list: (filters?: TaskFilters) => [...taskKeys.all, 'list', filters ?? {}] as const,
  members: () => ['workspace-members'] as const,
}

export function useTasksQuery(filters?: TaskFilters) {
  const token = useToken()
  return useQuery<Task[]>({
    queryKey: taskKeys.list(filters),
    queryFn: async () => {
      const data = await rpc<{ tasks: Task[] }>('api_list_tasks', {
        p_status: filters?.status ?? null,
        p_priority: filters?.priority ?? null,
        p_assignee: filters?.assignee ?? null,
        p_limit: filters?.limit ?? 100,
        p_offset: filters?.offset ?? 0,
      })
      return data.tasks ?? []
    },
    enabled: !!token,
  })
}

export function useWorkspaceMembers() {
  const token = useToken()
  return useQuery<{ id: string; displayName: string; email: string; role: string }[]>({
    queryKey: taskKeys.members(),
    queryFn: async () => {
      const res = await fetch('/api/workspaces/current/members', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch members')
      const d = await parseJson<WorkspaceMembersResponse>(res)
      return (d.members || []).map((m) => ({
        id: m.id,
        displayName: m.display_name || m.email || 'Unknown',
        email: m.email || '',
        role: m.role || '',
      }))
    },
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  })
}
