'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsKeys } from './use-settings-data'
import { useToken } from './utils'
import { toast } from 'sonner'
import { parseJson } from '@/lib/utils/typed-json'
import type { MacroOnboarding } from '@/types/settings'

interface ErrorResponse {
  error?: string
}

interface GenerateMacrosResponse {
  ok: boolean
  count: number
}

export function useDuplicateMacro() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/macros/${id}/duplicate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const d = await parseJson<ErrorResponse>(res).catch((): ErrorResponse => ({}))
        throw new Error(d.error ||'Failed to duplicate macro')
      }
      return parseJson<unknown>(res)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settingsKeys.macros({ search: '', language: '', tags: [], archived: false }) })
      toast.success('Macro duplicated')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useArchiveMacro() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/macros/${id}/archive`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const d = await parseJson<ErrorResponse>(res).catch((): ErrorResponse => ({}))
        throw new Error(d.error ||'Failed to archive macro')
      }
      return parseJson<unknown>(res)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...settingsKeys.all, 'macros'] })
      toast.success('Macro archived')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useRestoreMacro() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/macros/${id}/restore`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const d = await parseJson<ErrorResponse>(res).catch((): ErrorResponse => ({}))
        throw new Error(d.error ||'Failed to restore macro')
      }
      return parseJson<unknown>(res)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...settingsKeys.all, 'macros'] })
      toast.success('Macro restored')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useDeleteMacro() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/macros/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const d = await parseJson<ErrorResponse>(res).catch((): ErrorResponse => ({}))
        throw new Error(d.error ||'Failed to delete macro')
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...settingsKeys.all, 'macros'] })
      toast.success('Macro deleted')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useSaveMacroOnboarding() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (answers: MacroOnboarding) => {
      const res = await fetch('/api/macros/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ answers }),
      })
      if (!res.ok) {
        const d = await parseJson<ErrorResponse>(res).catch((): ErrorResponse => ({}))
        throw new Error(d.error ||'Failed to save onboarding')
      }
      return parseJson<unknown>(res)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settingsKeys.macroOnboarding() })
      toast.success('Onboarding saved')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useGenerateMacros() {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body?: Record<string, unknown>) => {
      const res = await fetch('/api/macros/generate', {
        method: 'POST',
        headers: body
          ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
          : { Authorization: `Bearer ${token}` },
        body: body ? JSON.stringify(body) : undefined,
      })
      if (!res.ok) {
        const d = await parseJson<ErrorResponse>(res).catch((): ErrorResponse => ({}))
        throw new Error(d.error ||'Generation failed')
      }
      return parseJson<GenerateMacrosResponse>(res)
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: [...settingsKeys.all, 'macros'] })
      toast.success(`${data.count} macros created`)
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}
