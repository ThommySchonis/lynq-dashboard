'use client'

import { useCallback, useState } from 'react'
import { useAuthStore } from '@/stores/auth'
import { authFetch } from '@/lib/inbox-utils'
import type { EodImpact } from '@/types/time-tracking'

export interface EodReportArgs {
  metrics:       EodImpact
  hoursTracked:  string
  breakDuration: string
  shiftWindow:   string
}

/** Calls Emma to draft a short shift report. Returns null on any failure. */
export function useEodReport() {
  const token = useAuthStore((s) => s.session?.access_token ?? '')
  const [generating, setGenerating] = useState(false)

  const generate = useCallback(
    async (args: EodReportArgs): Promise<string | null> => {
      setGenerating(true)
      try {
        const res = await authFetch(
          '/api/ai/eod-report',
          { method: 'POST', body: JSON.stringify(args) },
          token,
        )
        if (!res.ok) return null
        const data = (await res.json()) as { report?: string }
        return data.report ?? null
      } catch {
        return null
      } finally {
        setGenerating(false)
      }
    },
    [token],
  )

  return { generate, generating }
}
