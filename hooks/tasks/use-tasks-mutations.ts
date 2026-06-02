'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { useStoreStore } from '@/stores/store'
import { taskKeys } from './use-tasks-data'
import { rpc } from '@/lib/rpc'
import { parseJson } from '@/lib/utils/typed-json'
import type { CreateTaskInput, UpdateTaskInput } from '@/types/tasks'

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? '')
}

export function useCreateTask() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      return rpc('api_create_task', {
        p_title: input.title,
        p_description: input.description ?? null,
        p_category: input.category ?? null,
        p_priority: input.priority ?? 'medium',
        p_assigned_to: input.assignedTo ?? null,
        p_shopify_order_id: input.shopifyOrderId ?? null,
        p_shopify_order_name: input.shopifyOrderName ?? null,
        p_shopify_customer_id: input.shopifyCustomerId ?? null,
        p_customer_name: input.customerName ?? null,
        p_customer_email: input.customerEmail ?? null,
      })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}

export function useUpdateTask() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateTaskInput & { id: string }) => {
      return rpc('api_update_task', {
        p_id: id,
        p_title: updates.title ?? null,
        p_description: updates.description ?? null,
        p_category: updates.category ?? null,
        p_priority: updates.priority ?? null,
        p_assigned_to: updates.assignedTo ?? null,
        p_result_note: updates.resultNote ?? null,
        p_status: updates.status ?? null,
      })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      return rpc('api_delete_task', { p_id: id })
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
