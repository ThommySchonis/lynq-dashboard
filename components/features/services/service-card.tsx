'use client'

import { Check } from 'lucide-react'
import type { ServiceDef } from '@/lib/services-constants'
import { GuaranteeBlock } from './guarantee-block'

interface ServiceCardProps {
  svc: ServiceDef
  index: number
  onRequest: () => void
}

export function ServiceCard({ svc, index, onRequest }: ServiceCardProps) {
  const Icon = svc.icon
  const delay = `${index * 0.07}s`

  return (
    <div
      className="bg-white border border-black/[0.07] rounded-xl p-6 flex flex-col relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(0,0,0,0.10)] hover:border-black/[0.12] opacity-0 animate-[fadeInUp_0.5s_ease_forwards]"
      style={{ animationDelay: delay }}
    >
      {/* Badge */}
      {svc.badge && (
        <span
          className="absolute top-5 right-5 inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-[.04em] uppercase"
          style={{
            color: svc.badge.color,
            background: svc.badge.bg,
            border: svc.badge.border ? `1px solid ${svc.badge.border}` : 'none',
          }}
        >
          {svc.badge.label}
        </span>
      )}

      {/* Icon */}
      <div className="w-10 h-10 rounded-[10px] flex items-center justify-center mb-4 bg-primary/8">
        <Icon className="size-5 text-muted-foreground" strokeWidth={1.75} />
      </div>

      {/* Title */}
      <h2 className="text-[17px] font-bold text-foreground tracking-[-0.01em] mb-2">
        {svc.title}
      </h2>

      {/* Description */}
      <p className="text-[13px] text-muted-foreground leading-relaxed mb-4 flex-1">
        {svc.description}
      </p>

      {/* Features */}
      <div className="flex flex-col">
        {svc.features.map((f) => (
          <div key={f} className="flex items-center gap-2 mb-1.5">
            <Check className="size-3.5 text-foreground-4 shrink-0" strokeWidth={2.5} />
            <span className="text-[13px] text-foreground-2">{f}</span>
          </div>
        ))}
      </div>

      <GuaranteeBlock />

      <button
        onClick={onRequest}
        className="w-full h-[42px] px-5 rounded-lg text-[13px] font-semibold tracking-[-0.01em] cursor-pointer bg-[#0F0F10] text-white border-none mt-4 transition-all duration-150 hover:bg-[#1a1a1a] hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)]"
      >
        Request More Info
      </button>
    </div>
  )
}
