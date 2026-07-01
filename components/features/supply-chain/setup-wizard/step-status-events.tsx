'use client'

import { CircleCheck, Info, MapPin, Tag, TriangleAlert, Truck, Undo2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { STATUS_EVENTS } from '@/lib/supply-chain-constants'
import { StepHeader, SectionLabel, Toggle } from './wizard-ui'

const EVENT_ICONS: Record<string, LucideIcon> = {
  info_received: Tag, // shipping label created
  in_transit: Truck, // moving through the network
  out_for_delivery: MapPin, // last mile to the door
  delivered: CircleCheck, // marked delivered
  exception: TriangleAlert, // failed attempt / delay
  returned: Undo2, // heading back to sender
}

// Semantic icon colours matched to Figma (differs from the shipment status map:
// out-for-delivery is purple and exception is amber here).
const EVENT_ICON_COLOR: Record<string, string> = {
  info_received: 'text-foreground-3',
  in_transit: 'text-info',
  out_for_delivery: 'text-primary',
  delivered: 'text-success',
  exception: 'text-warning',
  returned: 'text-foreground-3',
}

interface StepStatusEventsProps {
  values: Record<string, boolean>
  onToggle: (key: string) => void
}

// Selection is UI-only for now; the webhook accepts all events until BE-2 wires
// per-event filtering.
export function StepStatusEvents({ values, onToggle }: StepStatusEventsProps) {
  return (
    <div className="flex w-full flex-col items-center gap-5">
      <StepHeader
        step={3}
        title="Choose status events"
        subtitle="Pick which shipment updates Lynq should track. We log each one to the order and can keep your customers in the loop automatically."
      />

      <SectionLabel>Track these events</SectionLabel>

      <div className="flex w-full flex-col gap-0.5 rounded-[16px] border border-border bg-card p-2">
        {STATUS_EVENTS.map((event) => {
          const Icon = EVENT_ICONS[event.key]
          return (
            <div key={event.key} className="flex items-center gap-[13px] rounded-[11px] px-3 py-[11px]">
              <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px] bg-surface-chip">
                <Icon className={`h-[18px] w-[18px] ${EVENT_ICON_COLOR[event.key]}`} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-px">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{event.title}</p>
                  {event.opensTicket && (
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-primary">
                      Opens a ticket
                    </span>
                  )}
                </div>
                <p className="text-xs font-medium text-foreground-3">{event.caption}</p>
              </div>
              <Toggle checked={values[event.key]} onChange={() => onToggle(event.key)} aria-label={event.title} />
            </div>
          )
        })}

        <div className="mt-1 h-px w-full bg-border" />

        <div className="flex items-center gap-[9px] px-3 pb-2.5 pt-2.5">
          <Info className="h-[15px] w-[15px] shrink-0 text-foreground-3" />
          <p className="text-xs font-medium text-foreground-3">
            Exceptions and returns can automatically open a ticket in your inbox, so your team never misses a problem
            delivery.
          </p>
        </div>
      </div>
    </div>
  )
}
