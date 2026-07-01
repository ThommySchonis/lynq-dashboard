'use client'

import { Info, KeyRound } from 'lucide-react'
import { StepHeader, SectionLabel, Toggle } from './wizard-ui'

interface StepApiKeyProps {
  apiKey: string
  onApiKeyChange: (value: string) => void
  onSubmit: () => void
  error: string | null
  autoSync: boolean
  onToggleAutoSync: () => void
}

export function StepApiKey({ apiKey, onApiKeyChange, onSubmit, error, autoSync, onToggleAutoSync }: StepApiKeyProps) {
  return (
    <div className="flex w-full flex-col items-center gap-5">
      <StepHeader
        step={1}
        title="Connect your API key"
        subtitle="Link your Parcel Panel account so Lynq tracks every shipment automatically."
      />

      <SectionLabel>API credentials</SectionLabel>

      <div className="flex w-full items-start gap-3 rounded-2xl border border-warning bg-warning-soft p-4">
        <Info className="mt-0.5 h-[18px] w-[18px] shrink-0 text-warning" />
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-semibold text-foreground">We import your recent shipments</p>
          <p className="text-xs font-medium leading-4 text-foreground-3">
            On connect, Lynq imports tracking for orders from the last 90 days. After that, new updates arrive
            automatically via the webhook.
          </p>
        </div>
      </div>

      <div className="flex w-full flex-col gap-3.5 rounded-2xl border border-border bg-card p-5">
        <p className="text-base font-semibold text-foreground">Paste your API key</p>
        <input
          value={apiKey}
          onChange={(e) => onApiKeyChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
          type="password"
          placeholder="pp_live_•••••••••••••••• — paste your Parcel Panel API key"
          className="w-full rounded-[10px] border border-border bg-surface-field px-3.5 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-foreground-4 focus:border-border-hover"
        />
        <div className="flex items-center gap-2 text-foreground-3">
          <KeyRound className="h-3.5 w-3.5 shrink-0" />
          <p className="text-xs font-medium">Find it in Parcel Panel → Settings → API.</p>
        </div>

        {error && <p className="text-xs font-medium text-destructive">{error}</p>}

        <div className="h-px w-full bg-border" />

        <div className="flex items-center gap-3">
          <Toggle checked={autoSync} onChange={onToggleAutoSync} aria-label="Auto-sync recent shipments" />
          <p className="text-sm font-medium text-foreground">Auto-sync recent shipments from the last 90 days</p>
        </div>
      </div>
    </div>
  )
}
