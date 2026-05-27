'use client'

import { useEffect, useRef } from 'react'
import { useServiceHealthStore } from '@/stores/service-health'
import type { ServiceName, ServiceStatus } from '@/types/service-health'

const POLL_INTERVAL_MS = 30_000

export function useServiceHealthPoller() {
  const statuses = useServiceHealthStore((s) => s.statuses)
  const setAll = useServiceHealthStore((s) => s.setAll)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const hasUnhealthy = Object.values(statuses).some((s) => s !== 'healthy')

  useEffect(() => {
    if (!hasUnhealthy) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    async function poll() {
      try {
        const res = await fetch('/api/health/services')
        if (res.ok) {
          const json = (await res.json()) as { statuses: Record<ServiceName, ServiceStatus> }
          setAll(json.statuses)
        }
      } catch {
        // Polling failure is non-critical — skip
      }
    }

    void poll()
    intervalRef.current = setInterval(() => { void poll() }, POLL_INTERVAL_MS)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [hasUnhealthy, setAll])
}
