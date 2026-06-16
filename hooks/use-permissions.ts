'use client'

import { useMemo } from 'react'
import { useAuthStore } from '@/stores/auth'
import { can } from '@/lib/permissions'

/**
 * Binds the capability map to the current role.
 * `permissions.can.manageOrders` is a boolean for the logged-in user.
 */
export function usePermissions() {
  const role = useAuthStore((s) => s.role)
  return useMemo(() => {
    const caps = Object.fromEntries(
      Object.entries(can).map(([key, fn]) => [key, role ? fn(role) : false]),
    ) as Record<keyof typeof can, boolean>
    return { role, can: caps }
  }, [role])
}
