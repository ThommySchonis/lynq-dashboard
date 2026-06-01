'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { useStoreStore } from '@/stores/store'
import { taskKeys } from './use-tasks-data'
import { parseJson } from '@/lib/utils/typed-json'
import type { CreateTaskInput, UpdateTaskInput } from '@/types/tasks'

interface ErrorResponse {
  error?: string
}

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export function useCreateTask() {
  const token = useToken()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const d = await parseJson<ErrorResponse>(res).catch((): ErrorResponse => ({}))
        throw new Error(d.error ||'Failed to create task')
      }
      return parseJson<unknown>(res)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}

export function useUpdateTask() {
  const token = useToken()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateTaskInput & { id: string }) => {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        const d = await parseJson<ErrorResponse>(res).catch((): ErrorResponse => ({}))
        throw new Error(d.error ||'Failed to update task')
      }
      return parseJson<unknown>(res)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}

export function useDeleteTask() {
  const token = useToken()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const d = await parseJson<ErrorResponse>(res).catch((): ErrorResponse => ({}))
        throw new Error(d.error ||'Failed to delete task')
      }
      return parseJson<unknown>(res)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}

export function useGeneratePatternTasks() {
  const token = useToken()
  const activeStoreId = useStoreStore((s) => s.activeStoreId)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!activeStoreId) throw new Error('No store selected')
      const res = await fetch(`/api/tasks/generate?store_id=${activeStoreId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Generation failed')
      return parseJson<unknown>(res)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}
