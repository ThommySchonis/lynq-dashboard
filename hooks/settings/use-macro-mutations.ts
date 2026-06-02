'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsKeys } from './use-settings-data'
import { useToken } from './utils'
import { rpc } from '@/lib/rpc'
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
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      return rpc('api_duplicate_macro', { p_id: id })
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
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      return rpc('api_archive_macro', { p_id: id })
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
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      return rpc('api_restore_macro', { p_id: id })
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
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      return rpc('api_delete_macro', { p_id: id })
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
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (answers: MacroOnboarding) => {
      return rpc('api_save_macro_onboarding', { p_answers: answers })
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
