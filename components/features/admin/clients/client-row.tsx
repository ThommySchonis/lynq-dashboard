'use client'

import { useState } from 'react'
import type { Client } from '@/types/admin'
import { useSuspendClient, useUnsuspendClient } from '@/hooks/admin/use-admin-mutations'

interface ClientRowProps {
  client: Client
}

const REASON_PRESETS = ['Unpaid invoice', 'Terms violation', 'Abuse', 'Other']

export function ClientRow({ client }: ClientRowProps) {
  const initial = (client.company_name || '?')[0].toUpperCase()
  const isSuspended = !!client.suspended_at
  const isActive = client.status === 'active' && !isSuspended

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

  return (
    <div className="border-b border-border last:border-b-0">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#F0F0F0] text-xs font-semibold text-[#555]">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-foreground">
            {client.company_name}
          </div>
          <div className="text-xs text-muted-foreground">{client.email}</div>
        </div>

        {/* Status badge */}
        <span
          className={
            isSuspended
              ? 'rounded-full border border-amber-500/15 bg-amber-500/8 px-2.5 py-0.5 text-[11px] font-semibold text-amber-600'
              : isActive
                ? 'rounded-full border border-emerald-500/15 bg-emerald-500/8 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600'
                : 'rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground'
          }
        >
          {isSuspended ? 'suspended' : client.status}
        </span>

        {/* Quick action button */}
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
      {isSuspended && client.suspension_reason && (
        <div className="border-t border-border/50 bg-amber-500/5 px-4 py-1.5">
          <span className="text-[11px] text-amber-700">
            Reason: {client.suspension_reason}
          </span>
          {client.suspended_at && (
            <span className="ml-2 text-[11px] text-muted-foreground">
              · Since {new Date(client.suspended_at).toLocaleDateString()}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
