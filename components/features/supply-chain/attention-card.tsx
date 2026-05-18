'use client'

import { useState } from 'react'
import { Copy, Check, CheckCircle } from 'lucide-react'
import type { AttentionItem } from '@/types/supply-chain'

interface AttentionCardProps {
  item: AttentionItem
  onDismiss: (key: string) => void
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-[5px] px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-150 bg-secondary text-foreground-2 border border-border"
    >
      {copied ? (
        <>
          <Check className="w-[11px] h-[11px]" />
          Copied!
        </>
      ) : (
        <>
          <Copy className="w-[11px] h-[11px]" />
          Copy message
        </>
      )}
    </button>
  )
}

export function AttentionCard({ item, onDismiss }: AttentionCardProps) {
  const { order, shipment, type: _type, daysSince, lastDetail, cfg } = item
  const firstName = order.customer?.name?.split(' ')[0] || 'there'
  const orderNum = order.order_number || '\u2014'
  const carrier = shipment.last_mile?.carrier_name || shipment.carrier?.name
  const phone = order.customer?.phone
  const msg = cfg.message(firstName, orderNum)

  return (
    <div
      className="rounded-[14px] overflow-hidden transition-all duration-200 hover:-translate-y-px hover:shadow-[var(--shadow-card-hover)]"
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderLeft: cfg.priority === 1 ? '3px solid #EF4444' : '3px solid #F59E0B',
      }}
    >
      <div className="p-4 px-[18px]">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div>
            <div className="flex items-center gap-[7px] mb-1">
              <span className="text-[13.5px] font-bold text-foreground">{orderNum}</span>
              <span
                className="text-[10.5px] font-bold px-2 py-0.5 rounded-full"
                style={{
                  color: cfg.color,
                  background: `${cfg.color}18`,
                  border: `1px solid ${cfg.color}30`,
                }}
              >
                {cfg.label}
              </span>
            </div>
            <p className="text-xs text-foreground-2">
              {order.customer?.name || 'Unknown customer'}
              {carrier && <span className="text-muted-foreground ml-1.5">&middot; {carrier}</span>}
            </p>
          </div>
          {daysSince !== null && (
            <span
              className="text-[11px] font-semibold shrink-0"
              style={{ color: daysSince >= 10 ? '#DC2626' : 'var(--foreground-3)' }}
            >
              {daysSince === 0 ? 'Today' : `${daysSince}d ago`}
            </span>
          )}
        </div>

        {/* Last event or description */}
        <p className="text-xs text-foreground-2 mb-3.5 leading-[1.55]">
          {lastDetail || cfg.desc}
        </p>

        {/* Action buttons */}
        <div className="flex items-center gap-[7px] flex-wrap">
          <CopyBtn text={msg} />
          {phone && (
            <a
              href={`https://wa.me/${phone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-[5px] px-3 py-1.5 rounded-lg text-xs font-semibold no-underline whitespace-nowrap bg-[rgba(37,211,102,0.08)] text-[#25d366] border border-[rgba(37,211,102,0.2)]"
            >
              WhatsApp
            </a>
          )}
          <button
            onClick={() => onDismiss(item.key)}
            className="inline-flex items-center gap-[5px] px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-150 bg-transparent text-muted-foreground border border-border"
          >
            <CheckCircle className="w-[11px] h-[11px]" />
            Mark resolved
          </button>
        </div>
      </div>
    </div>
  )
}
