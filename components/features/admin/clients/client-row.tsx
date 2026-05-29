'use client'

import { useState } from 'react'
import { Eye } from 'lucide-react'
import type { ClientOverviewItem } from '@/types/admin-client-overview'
import { useSuspendClient, useUnsuspendClient } from '@/hooks/admin/use-admin-mutations'
import { useAuthStore } from '@/stores/auth'

interface ClientRowProps {
  client: ClientOverviewItem
}

const REASON_PRESETS = ['Unpaid invoice', 'Terms violation', 'Abuse', 'Other']

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today'
  if (days === 1) return '1d ago'
  return `${days}d ago`
}

const BILLING_BADGE: Record<string, string> = {
  active: 'border-emerald-500/15 bg-emerald-500/8 text-emerald-600',
  trial: 'border-blue-500/15 bg-blue-500/8 text-blue-600',
  past_due: 'border-red-500/15 bg-red-500/8 text-red-600',
  canceled: 'border-border bg-muted text-muted-foreground',
  paused: 'border-amber-500/15 bg-amber-500/8 text-amber-600',
}

function IntegrationDot({ connected }: { connected: boolean }) {
  return (
    <span className={`inline-block size-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
  )
}

export function ClientRow({ client }: ClientRowProps) {
  const initial = (client.companyName || '?')[0].toUpperCase()
  const isSuspended = !!client.suspendedAt

  const suspendMutation = useSuspendClient()
  const unsuspendMutation = useUnsuspendClient()

  const [showReasonPicker, setShowReasonPicker] = useState(false)
  const [reason, setReason] = useState('')

  function handleSuspend() {
    if (!showReasonPicker) {
      setShowReasonPicker(true)
      return
    }
    suspendMutation.mutate(
      { id: client.id, reason: reason.trim() || undefined },
      { onSuccess: () => { setShowReasonPicker(false); setReason('') } }
    )
  }

  function handleUnsuspend() {
    unsuspendMutation.mutate(client.id)
  }

  const session = useAuthStore((s) => s.session)
  const setImpersonating = useAuthStore((s) => s.setImpersonating)
  const [isImpersonating, setIsImpersonatingLocal] = useState(false)

  async function handleImpersonate() {
    if (!client.workspaceId) return
    setIsImpersonatingLocal(true)
    try {
      const token = session?.access_token
      const res = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ workspaceId: client.workspaceId }),
      })
      if (!res.ok) {
        setIsImpersonatingLocal(false)
        return
      }
      const data = await res.json() as { sessionId: string }
      setImpersonating(data.sessionId)
      window.location.href = '/'
    } catch {
      setIsImpersonatingLocal(false)
    }
  }

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const isInactive = !client.lastLoginAt || new Date(client.lastLoginAt).getTime() < sevenDaysAgo

  const billingLabel = client.billingStatus
    ? client.billingStatus.replace('_', ' ')
    : '—'
  const billingClass = client.billingStatus
    ? BILLING_BADGE[client.billingStatus] ?? BILLING_BADGE.canceled
    : 'border-border bg-muted text-muted-foreground'

  return (
    <div className="border-b border-border last:border-b-0">
      <div className="flex items-center gap-3 px-4 py-2.5">
        {/* Client info */}
        <div className="flex items-center gap-2.5 min-w-0" style={{ width: '240px' }}>
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium text-foreground">
              {client.companyName}
            </div>
            <div className="truncate text-[11px] text-muted-foreground">
              {client.email}
              {client.planName && (
                <span className="ml-1.5 text-foreground-3">· {client.planName}</span>
              )}
            </div>
          </div>
        </div>

        {/* Billing status */}
        <div style={{ width: '80px' }}>
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${billingClass}`}>
            {billingLabel}
          </span>
        </div>

        {/* Integration dots: S G O */}
        <div className="flex items-center gap-3" style={{ width: '80px' }}>
          <div className="flex flex-col items-center gap-0.5">
            <IntegrationDot connected={client.hasShopify} />
            <span className="text-[9px] text-muted-foreground">S</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <IntegrationDot connected={client.hasGmail} />
            <span className="text-[9px] text-muted-foreground">G</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <IntegrationDot connected={client.hasOutlook} />
            <span className="text-[9px] text-muted-foreground">O</span>
          </div>
        </div>

        {/* Last login */}
        <div style={{ width: '70px' }}>
          <span className={`text-[12px] ${isInactive ? 'text-red-500' : 'text-muted-foreground'}`}>
            {formatRelativeTime(client.lastLoginAt)}
          </span>
        </div>

        {/* Actions */}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {/* Impersonate button */}
          {client.workspaceId && (
            <button
              onClick={() => void handleImpersonate()}
              disabled={isImpersonating}
              className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/15 disabled:opacity-50"
            >
              <Eye className="h-3 w-3" />
              {isImpersonating ? 'Opening...' : 'Impersonate'}
            </button>
          )}

          {/* Existing suspend/unsuspend buttons */}
          {isSuspended ? (
            <button
              onClick={handleUnsuspend}
              disabled={unsuspendMutation.isPending}
              className="rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              {unsuspendMutation.isPending ? 'Restoring...' : 'Unsuspend'}
            </button>
          ) : (
            <button
              onClick={handleSuspend}
              disabled={suspendMutation.isPending}
              className="rounded-md border border-destructive/30 px-2.5 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/5 disabled:opacity-50"
            >
              {suspendMutation.isPending ? 'Suspending...' : 'Suspend'}
            </button>
          )}
        </div>
      </div>

      {/* Reason picker (shown when suspend button clicked first time) */}
      {showReasonPicker && !isSuspended && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border/50 bg-muted/30 px-4 py-2.5">
          {REASON_PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => setReason(preset)}
              className={`rounded-md border px-2 py-0.5 text-[11px] ${
                reason === preset
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/30'
              }`}
            >
              {preset}
            </button>
          ))}
          <input
            type="text"
            value={REASON_PRESETS.includes(reason) ? '' : reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Or type a reason..."
            className="min-w-[140px] flex-1 rounded-md border border-border bg-background px-2 py-0.5 text-[11px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
          <button
            onClick={handleSuspend}
            disabled={suspendMutation.isPending}
            className="rounded-md bg-destructive px-2.5 py-0.5 text-[11px] font-medium text-white hover:bg-destructive/90 disabled:opacity-50"
          >
            {suspendMutation.isPending ? 'Suspending...' : 'Confirm'}
          </button>
          <button
            onClick={() => { setShowReasonPicker(false); setReason('') }}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Suspension info (shown when already suspended) */}
      {isSuspended && client.suspensionReason && (
        <div className="border-t border-border/50 bg-amber-500/5 px-4 py-1.5">
          <span className="text-[11px] text-amber-700">
            Reason: {client.suspensionReason}
          </span>
          {client.suspendedAt && (
            <span className="ml-2 text-[11px] text-muted-foreground">
              · Since {new Date(client.suspendedAt).toLocaleDateString()}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
