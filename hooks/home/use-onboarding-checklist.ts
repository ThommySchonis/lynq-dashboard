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

/** Derive the done state of an auto-tracked step from the onboarding status. */
function isAutoStepDone(key: string, status: OnboardingStatus | null | undefined): boolean {
  if (!status) return false
  switch (key) {
    case 'email':
      return !!status.email_connected
    case 'shopify':
      return !!status.shopify_connected
    case 'macros':
      return (status.macros_count ?? 0) > 0
    case 'team':
      return (status.team_member_count ?? 0) > 1
    default:
      return false
  }
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
