'use client'

import { useState } from 'react'
import { Eye, X } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { apiUrl } from '@/lib/api-client'

export function ImpersonationBanner() {
  const isImpersonating = useAuthStore((s) => s.isImpersonating)
  const workspace = useAuthStore((s) => s.workspace)
  const session = useAuthStore((s) => s.session)
  const setImpersonating = useAuthStore((s) => s.setImpersonating)
  const [isExiting, setIsExiting] = useState(false)

  if (!isImpersonating) return null

  async function handleExit() {
    setIsExiting(true)
    try {
      const token = session?.access_token
      await fetch(apiUrl('admin/impersonate'), {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      setImpersonating(null)
      window.location.href = '/admin/clients'
    } catch {
      setIsExiting(false)
    }
  }

  return (
    <div className="flex items-center justify-between bg-gradient-to-r from-amber-600 to-amber-700 px-4 py-2.5">
      <div className="flex items-center gap-2.5">
        <Eye className="h-4 w-4 text-white" />
        <span className="text-sm font-semibold text-white">
          Viewing as{' '}
          <span className="underline">{workspace?.name ?? 'Unknown'}</span>
        </span>
        <span className="text-xs text-white/70">
          — Some actions are restricted
        </span>
      </div>
      <button
        onClick={() => void handleExit()}
        disabled={isExiting}
        className="flex items-center gap-1.5 rounded-md border border-white/30 bg-white/20 px-3 py-1 text-xs font-semibold text-white hover:bg-white/30 disabled:opacity-50"
      >
        <X className="h-3.5 w-3.5" />
        {isExiting ? 'Exiting...' : 'Exit Impersonation'}
      </button>
    </div>
  )
}
