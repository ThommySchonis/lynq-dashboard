'use client'

import { ChevronDown, ExternalLink } from 'lucide-react'
import { fmtDate } from '@/lib/supply-chain-constants'
import { useSupplyChainUI } from '@/stores/supply-chain-ui'
import { StatusBadge } from './status-badge'
import { CarrierBadge } from './carrier-badge'
import { CheckpointTimeline } from './checkpoint-timeline'
import type { Order } from '@/types/supply-chain'

interface ShipmentRowProps {
  order: Order
  index: number
  isAttention: boolean
}

export function ShipmentRow({ order, index, isAttention }: ShipmentRowProps) {
  const { expandedOrderId, toggleExpandedOrderId } = useSupplyChainUI()
  const shipment = order.shipments?.[0]
  if (!shipment) return null

  const orderId = order.order_number || order.id
  const expanded = expandedOrderId === orderId
  const carrierName = shipment.last_mile?.carrier_name || shipment.carrier?.name
  const carrierLogo = shipment.last_mile?.carrier_logo_url || shipment.carrier?.logo_url
  const products = shipment.products?.map(p => p.title).join(', ') || '\u2014'

  const trackingDetails: [string, string | null | undefined][] = [
    ['Tracking #', shipment.tracking_number],
    ['Carrier', shipment.carrier?.name],
    ['Last-mile carrier', shipment.last_mile?.carrier_name],
    ['Transit time', shipment.transit_time ? `${shipment.transit_time} days` : null],
    ['Fulfillment date', fmtDate(shipment.fulfillment_date)],
    ['Delivery date', fmtDate(shipment.delivery_date)],
  ]

  return (
    <div
      className="bg-(--bg-row) border border-(--border) rounded-[14px] overflow-hidden shadow-[var(--shadow-row)] transition-all duration-200 hover:border-(--border-hover) hover:shadow-[var(--shadow-row-hover)] animate-[fadeUp_0.4s_ease_both]"
      style={{
        animationDelay: `${index * 35}ms`,
        borderColor: isAttention ? 'rgba(248,113,113,0.18)' : undefined,
      }}
    >
      {/* Summary row */}
      <div
        className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-4 items-center py-[15px] px-5 cursor-pointer"
        onClick={() => toggleExpandedOrderId(orderId)}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-[3px]">
            <span className="text-sm font-bold text-(--text-1)">{order.order_number}</span>
            <StatusBadge status={shipment.status} />
          </div>
          <p className="text-[12.5px] text-(--text-2) overflow-hidden text-ellipsis whitespace-nowrap">
            {order.customer?.name || '\u2014'}
          </p>
        </div>

        <p className="text-[12.5px] text-(--text-2) overflow-hidden text-ellipsis whitespace-nowrap">
          {products}
        </p>

        <CarrierBadge name={carrierName} logoUrl={carrierLogo} />

        <div className="text-right min-w-[90px]">
          <p className="text-[11px] text-(--text-3) mb-0.5">
            {shipment.status === 'DELIVERED'
              ? 'Delivered'
              : shipment.estimated_delivery_date
                ? 'Est. delivery'
                : 'Shipped'}
          </p>
          <p className="text-[12.5px] text-(--text-2) font-semibold">
            {shipment.status === 'DELIVERED'
              ? fmtDate(shipment.delivery_date)
              : shipment.estimated_delivery_date
                ? fmtDate(shipment.estimated_delivery_date)
                : fmtDate(shipment.fulfillment_date)}
          </p>
        </div>

        <div
          className="text-(--text-3) flex transition-transform duration-200"
          style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-(--divider) py-5 px-5 pl-6 animate-[fadeIn_0.2s_ease_both]">
          <div className="grid grid-cols-2 gap-7">
            {/* Left: tracking details */}
            <div>
              <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-[.08em] mb-3.5">
                Tracking Details
              </p>
              <div className="flex flex-col gap-2.5">
                {trackingDetails
                  .filter(([, v]) => v && v !== '\u2014')
                  .map(([label, val]) => (
                    <div key={label} className="flex gap-2 items-start">
                      <span className="text-xs text-(--text-3) min-w-[130px] shrink-0">{label}</span>
                      <span className="text-[12.5px] text-(--text-2) break-all">{val}</span>
                    </div>
                  ))}
              </div>

              {order.shipping_address && (
                <div className="mt-[18px]">
                  <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-[.08em] mb-2">
                    Ship to
                  </p>
                  <p className="text-[12.5px] text-(--text-2) leading-[1.65]">
                    {order.shipping_address.name}<br />
                    {order.shipping_address.city}
                    {order.shipping_address.province_code ? `, ${order.shipping_address.province_code}` : ''}{' '}
                    {order.shipping_address.zip}<br />
                    {order.shipping_address.country}
                  </p>
                </div>
              )}

              {order.tracking_link && (
                <a
                  href={order.tracking_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-4 py-2 px-3.5 rounded-lg bg-(--bg-surface-2) border border-(--border) text-(--text-2) text-[12.5px] font-semibold no-underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  Track on carrier site
                </a>
              )}
            </div>

            {/* Right: tracking events */}
            <div>
              <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-[.08em] mb-3.5">
                Tracking Events
              </p>
              <CheckpointTimeline checkpoints={shipment.checkpoints || []} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
