'use client'

import { AlignLeft, Check, Key, SlidersHorizontal, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { apiUrl } from '@/lib/api-client'
import { STATUS_EVENTS, TRACKING_PREFS } from '@/lib/supply-chain-constants'
import { StepHeader, SectionLabel } from './wizard-ui'

interface StepReviewProps {
  apiKey: string
  webhookToken: string | null
  statusEvents: Record<string, boolean>
  trackingPrefs: Record<string, boolean>
  onEdit: (step: number) => void
}

interface ReviewRow {
  label: string
  icon: LucideIcon
  iconClass?: string
  value: string
  pill?: string
  caption?: string
  step: number
}

function StatusPill({ label }: { label: string }) {
  return (
    <span className="flex shrink-0 items-center gap-1 rounded-full bg-success-pill py-0.5 pl-1.5 pr-2 text-xs font-semibold text-success">
      <Check className="h-3 w-3" />
      {label}
    </span>
  )
}

export function StepReview({ apiKey, webhookToken, statusEvents, trackingPrefs, onEdit }: StepReviewProps) {
  const enabledEvents = STATUS_EVENTS.filter((e) => statusEvents[e.key])
  const customer = TRACKING_PREFS.filter((p) => p.group === 'customer' && trackingPrefs[p.key])
  const ai = TRACKING_PREFS.filter((p) => p.group === 'ai' && trackingPrefs[p.key])

  const rows: ReviewRow[] = [
    {
      label: 'API key',
      icon: Key,
      iconClass: 'rotate-45',
      value: apiKey ? `pp_live_••••${apiKey.slice(-4)}` : '—',
      pill: 'Connected',
      step: 0,
    },
    {
      label: 'Webhook URL',
      icon: Zap,
      value: webhookToken ? apiUrl(`parcel-panel/webhook/${webhookToken}`).replace(/^https?:\/\//, '') : '—',
      pill: 'Verified',
      step: 1,
    },
    {
      label: 'Status events',
      icon: AlignLeft,
      value: `${enabledEvents.length} events tracked`,
      caption: enabledEvents.map((e) => e.short).join(' · '),
      step: 2,
    },
    {
      label: 'Tracking preferences',
      icon: SlidersHorizontal,
      value: customer.map((p) => p.short).join(' · ') || 'None',
      caption: ai.map((p) => p.short).join(' · '),
      step: 3,
    },
  ]

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <StepHeader
        step={5}
        title="Review & connect"
        subtitle="Give your setup a final look, then connect Parcel Panel to start tracking shipments automatically."
      />

      <SectionLabel>Review your setup</SectionLabel>

      <div className="flex w-full flex-col rounded-[16px] border border-border bg-card">
        {rows.map((row, i) => {
          const Icon = row.icon
          return (
            <div key={row.label}>
              {i > 0 && <div className="h-px w-full bg-border" />}
              <div className="flex items-center gap-[13px] px-4 py-[15px]">
                <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-accent-soft">
                  <Icon className={`h-[18px] w-[18px] text-primary ${row.iconClass ?? ''}`} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground-4">{row.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 truncate text-sm font-semibold text-foreground">{row.value}</span>
                    {row.pill && <StatusPill label={row.pill} />}
                  </div>
                  {row.caption && <span className="text-xs font-medium text-foreground-3">{row.caption}</span>}
                </div>
                <button
                  type="button"
                  onClick={() => onEdit(row.step)}
                  className="shrink-0 rounded-[8px] border border-border px-3 py-1.5 text-sm font-semibold text-foreground-2"
                >
                  Edit
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex w-full items-start gap-3 rounded-[14px] border border-success bg-success-soft p-4">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success-pill">
          <Check className="h-4 w-4 text-success" />
        </span>
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-semibold text-foreground">You’re ready to connect</p>
          <p className="text-xs font-medium leading-4 text-foreground-3">
            On connect, Lynq imports tracking for your orders from the last 90 days, then keeps every new shipment
            updated automatically.
          </p>
        </div>
      </div>
    </div>
  )
}
