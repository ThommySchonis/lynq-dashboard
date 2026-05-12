'use client'

import { AlertTriangle } from 'lucide-react'

interface AlertBannerProps {
  rate: number | string | undefined
  loaded: boolean
}

export function AlertBanner({ rate, loaded }: AlertBannerProps) {
  if (!loaded) return null
  const r = parseFloat(String(rate || 0))
  if (r < 5) return null
  const isCrit = r >= 20

  return (
    <div className="mb-4 flex animate-fade-up items-center gap-3 rounded-[10px] border border-red-600/15 bg-gradient-to-br from-red-50 to-red-50/80 border-l-[3px] border-l-red-600 px-4 py-3">
      <AlertTriangle size={14} className="shrink-0 text-red-600" />
      <span className="text-xs font-semibold text-red-600 mr-1">
        {isCrit ? 'Critical' : 'Warning'}:
      </span>
      <span className="text-xs leading-relaxed text-red-600">
        {isCrit
          ? `Refund rate ${r}% — industry average is 2–5%. Immediate action required.`
          : `Refund rate ${r}% is above the 2–5% benchmark.`}
      </span>
    </div>
  )
}
