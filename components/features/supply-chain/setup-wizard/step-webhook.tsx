'use client'

import { useState } from 'react'
import { Check, Copy, ShieldCheck } from 'lucide-react'
import { apiUrl } from '@/lib/api-client'
import { StepHeader, SectionLabel } from './wizard-ui'

export function StepWebhook({ webhookToken }: { webhookToken: string | null }) {
  const [copied, setCopied] = useState(false)
  const url = webhookToken ? apiUrl(`parcel-panel/webhook/${webhookToken}`) : ''

  const copy = () => {
    if (!url) return
    navigator.clipboard.writeText(url).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <StepHeader
        step={2}
        title="Add your webhook URL"
        subtitle="Paste this endpoint into Parcel Panel so Lynq receives every shipment update the moment it happens."
      />

      <SectionLabel>Webhook endpoint</SectionLabel>

      <div className="flex w-full items-start gap-3 rounded-2xl border border-info/30 bg-info-soft p-4">
        <ShieldCheck className="mt-0.5 h-[18px] w-[18px] shrink-0 text-info" />
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-semibold text-foreground">Every event is signed &amp; verified</p>
          <p className="text-xs font-medium leading-4 text-foreground-3">
            Each delivery carries a signing secret, so Lynq only accepts shipment events that genuinely come from Parcel
            Panel.
          </p>
        </div>
      </div>

      <div className="flex w-full flex-col gap-3.5 rounded-2xl border border-border bg-card p-5">
        <p className="text-base font-semibold text-foreground">Your webhook URL</p>
        <div className="flex items-center gap-2.5 rounded-[10px] border border-border bg-surface-field py-2 pl-3.5 pr-2">
          <code className="flex-1 break-all font-mono text-xs text-foreground">
            {url || 'Connect your API key first to generate your webhook URL.'}
          </code>
          <button
            type="button"
            onClick={copy}
            disabled={!url}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent-soft px-3 py-2 text-sm font-semibold text-primary transition-opacity disabled:opacity-50"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div className="flex items-center gap-2 text-foreground-3">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
          <p className="text-xs font-medium">Paste this into Parcel Panel → Settings → Webhooks → Add endpoint.</p>
        </div>
      </div>
    </div>
  )
}
