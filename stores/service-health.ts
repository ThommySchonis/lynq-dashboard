import { create } from 'zustand'
import type { ServiceName, ServiceStatus } from '@/types/service-health'

const ALL_SERVICES: ServiceName[] = ['shopify', 'gmail', 'outlook', 'anthropic', 'whop']

function defaultStatuses(): Record<ServiceName, ServiceStatus> {
  return Object.fromEntries(
    ALL_SERVICES.map((s) => [s, 'healthy' as const]),
  ) as Record<ServiceName, ServiceStatus>
}

interface ServiceHealthState {
  statuses: Record<ServiceName, ServiceStatus>
  lastUpdated: Record<ServiceName, number>

  setStatus: (service: ServiceName, status: ServiceStatus) => void
  setAll: (statuses: Record<ServiceName, ServiceStatus>) => void
  isHealthy: (service: ServiceName) => boolean
}

export const useServiceHealthStore = create<ServiceHealthState>()((set, get) => ({
  statuses: defaultStatuses(),
  lastUpdated: Object.fromEntries(
    ALL_SERVICES.map((s) => [s, 0]),
  ) as Record<ServiceName, number>,

  setStatus: (service, status) =>
    set((state) => ({
      statuses: { ...state.statuses, [service]: status },
      lastUpdated: { ...state.lastUpdated, [service]: Date.now() },
    })),

  setAll: (statuses) =>
    set({
      statuses,
      lastUpdated: Object.fromEntries(
        ALL_SERVICES.map((s) => [s, Date.now()]),
      ) as Record<ServiceName, number>,
    }),

  isHealthy: (service) => get().statuses[service] === 'healthy',
}))
