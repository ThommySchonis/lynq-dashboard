'use client'

import { Check } from 'lucide-react'
import { CONNECTED_HIGHLIGHTS } from '@/lib/supply-chain-constants'

export function ConnectedScreen() {
  return (
    <div className="flex w-full flex-col items-center gap-[18px] pt-10">
      <div className="flex flex-col items-center gap-[7px]">
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-success bg-success-soft">
          <Check className="h-4 w-4 text-success" />
        </span>
        <h2 className="text-center text-xl font-bold tracking-[-0.01em] text-foreground">Shipment Tracker connected</h2>
        <p className="max-w-[440px] text-center text-sm text-foreground-3">
          Parcel Panel is linked. Lynq now tracks every new shipment automatically — no more manual status updates.
        </p>
      </div>

      <div className="flex w-full max-w-[560px] flex-col gap-0.5 rounded-[16px] border border-border bg-card px-2.5 pb-3 pt-2.5">
        <p className="px-2.5 pb-1 pt-2 text-xs font-semibold uppercase tracking-[0.08em] text-foreground-4">
          What’s live now
        </p>
        {CONNECTED_HIGHLIGHTS.map((line) => (
          <div key={line} className="flex items-center gap-[11px] px-2.5 py-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-pill">
              <Check className="h-3 w-3 text-success" />
            </span>
            <span className="text-sm text-foreground">{line}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-[9px] rounded-full bg-success-pill py-[9px] pl-3 pr-3.5">
        <span className="h-2 w-2 rounded-full bg-success" />
        <span className="text-xs font-semibold text-success">
          First event received from Parcel Panel · connection healthy
        </span>
      </div>
    </div>
  )
}
