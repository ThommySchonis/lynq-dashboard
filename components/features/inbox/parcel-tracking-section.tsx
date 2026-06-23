'use client'

import { useState } from 'react'
import { Truck, ChevronDown } from 'lucide-react'
import type { Order as ParcelTrackingOrder } from '@/types/supply-chain'
import { getStatus, fmtDateTime } from '@/lib/supply-chain-constants'

export function ParcelTrackingSection({ trackings }: { trackings?: ParcelTrackingOrder[] }) {
  const [openTimeline, setOpenTimeline] = useState<Record<number, boolean>>({})
  if (!trackings || trackings.length === 0) return null

  return (
    <div className="px-3.5 py-2.5 border-t border-border">
      <div className="flex items-center gap-1.5 mb-2">
        <Truck size={12} className="text-foreground-3" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground-3">Shipment tracking</span>
        <span className="text-[10px] text-foreground-4">· Parcel Panel</span>
      </div>

      <div className="flex flex-col gap-2">
        {trackings.map((t, i) => {
          const s = t.shipments?.[0]
          const cfg = getStatus(s?.status ?? 'PENDING')
          const isOpen = !!openTimeline[i]
          const checkpoints = s?.checkpoints ?? []
          return (
            <div key={t.id || i} className="rounded-lg border border-border p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span
                  className="text-[10px] font-bold px-1.5 py-px rounded border uppercase tracking-[.04em]"
                  style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}
                >
                  {cfg.label}
                </span>
                {s?.estimated_delivery_date && (
                  <span className="text-[11px] text-foreground-3">ETA {s.estimated_delivery_date}</span>
                )}
              </div>

              <div className="mt-1.5 text-[11px] text-foreground-2">
                {(s?.carrier_name || s?.carrier?.name) ?? 'Carrier'}
                {s?.tracking_number ? ` · ${s.tracking_number}` : ''}
              </div>

              {checkpoints.length > 0 && (
                <>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenTimeline((v) => ({ ...v, [i]: !v[i] }))}
                    className="mt-2 flex items-center gap-1 text-[11px] text-foreground-3 hover:text-foreground"
                  >
                    <ChevronDown size={11} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    {isOpen ? 'Hide timeline' : 'Show timeline'}
                  </button>
                  {isOpen && (
                    <div className="mt-2 flex flex-col gap-2 border-l border-border pl-2.5">
                      {checkpoints.map((cp, ci) => (
                        <div key={ci} className="text-[11px]">
                          <div className="text-foreground-2">{cp.detail}</div>
                          <div className="text-foreground-4">
                            {fmtDateTime(cp.checkpoint_time)}{cp.location ? ` · ${cp.location}` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {t.tracking_link && (
                <a
                  href={t.tracking_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-[11px] font-semibold text-foreground hover:underline"
                >
                  Track package →
                </a>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
