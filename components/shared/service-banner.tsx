'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { useServiceHealthStore } from '@/stores/service-health'
import { useServiceHealthPoller } from '@/hooks/use-service-health-poller'
import type { ServiceName, ServiceStatus } from '@/types/service-health'
const SERVICE_LABELS: Record<ServiceName, string> = {
  shopify: 'Shopify',
  gmail: 'Email (Gmail)',
  outlook: 'Email (Outlook)',
  anthropic: 'AI features',
  whop: 'Billing',
}

function getMessage(service: ServiceName, status: ServiceStatus): string {
  const label = SERVICE_LABELS[service]
  if (status === 'down') return `${label} is currently unavailable — some features may not work`
  return `${label} is experiencing issues — showing cached data where available`
}

export function ServiceBanner() {
  useServiceHealthPoller()

  const statuses = useServiceHealthStore((s) => s.statuses)
  const [dismissed, setDismissed] = useState<Set<ServiceName>>(new Set())

  const unhealthy = (Object.entries(statuses) as [ServiceName, ServiceStatus][])
    .filter(([service, status]) => status !== 'healthy' && !dismissed.has(service))

  if (unhealthy.length === 0) return null

  return (
    <div className="flex flex-col gap-1 px-4 pt-2">
      {unhealthy.map(([service, status]) => (
        <div
          key={service}
          className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${
            status === 'down'
              ? 'bg-destructive/10 text-destructive'
              : 'bg-warning/10 text-warning'
          }`}
        >
          <span>{getMessage(service, status)}</span>
          <button
            onClick={() => setDismissed((prev) => new Set(prev).add(service))}
            className="ml-2 shrink-0 rounded p-0.5 hover:bg-black/5 dark:hover:bg-white/5"
            aria-label={`Dismiss ${SERVICE_LABELS[service]} alert`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
