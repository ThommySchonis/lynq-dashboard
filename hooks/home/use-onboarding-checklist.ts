'use client'

import { useCallback, useEffect, useState } from 'react'
import { useOnboardingStatus } from './use-home-data'
import type { OnboardingStatus } from './use-home-data'
import {
  CHECKLIST_STEPS,
  CHECKLIST_MANUAL_STORAGE_KEY,
  type ChecklistStep,
} from '@/lib/home-constants'

export interface ChecklistItem extends ChecklistStep {
  done: boolean
}

type ManualSteps = Record<string, boolean>

/** Maps an auto-tracked step key to its done-state derivation from onboarding status. */
const AUTO_STEP_CHECKS: Record<string, (s: OnboardingStatus) => boolean> = {
  email: (s) => !!s.email_connected,
  shopify: (s) => !!s.shopify_connected,
  macros: (s) => (s.macros_count ?? 0) > 0,
  team: (s) => (s.team_member_count ?? 0) > 1,
}

function isAutoStepDone(key: string, status: OnboardingStatus | null | undefined): boolean {
  return status ? (AUTO_STEP_CHECKS[key]?.(status) ?? false) : false
}

function readManualSteps(): ManualSteps {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(CHECKLIST_MANUAL_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ManualSteps) : {}
  } catch {
    return {}
  }
}

/**
 * Builds the "Get started" checklist: auto steps derive from the onboarding
 * status RPC; manual steps persist their "Mark as done" state in localStorage.
 */
export function useOnboardingChecklist() {
  const { data: status } = useOnboardingStatus()
  const [manual, setManual] = useState<ManualSteps>({})

  useEffect(() => {
    setManual(readManualSteps())
  }, [])

  const toggleManual = useCallback((key: string, done: boolean) => {
    setManual((prev) => {
      const next = { ...prev, [key]: done }
      if (!done) delete next[key]
      try {
        window.localStorage.setItem(CHECKLIST_MANUAL_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // best-effort persistence
      }
      return next
    })
  }, [])

  const items: ChecklistItem[] = CHECKLIST_STEPS.map((step) => ({
    ...step,
    done: step.type === 'auto' ? isAutoStepDone(step.key, status) : !!manual[step.key],
  }))

  const completed = items.filter((i) => i.done).length

  return {
    items,
    completed,
    total: items.length,
    allDone: completed >= items.length,
    toggleManual,
  }
}
