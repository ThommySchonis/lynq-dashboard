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

  const accent = isCrit ? 'bg-red-500' : 'bg-amber-500'
  const border = isCrit ? 'border-red-500/[0.08]' : 'border-amber-500/[0.08]'
  const icon = isCrit ? 'text-red-500' : 'text-amber-500'
  const text = isCrit ? 'text-red-600' : 'text-amber-700'

  return (
    <div className={`mb-4 flex animate-fade-up items-stretch overflow-hidden rounded-[12px] border ${border}`}>
      <div className={`w-1 shrink-0 ${accent}`} />
      <div className="flex items-center gap-2.5 py-3.5 pl-4 pr-[18px]">
        <AlertTriangle size={16} className={`shrink-0 ${icon}`} />
        <div className="flex flex-wrap items-center gap-x-1.5">
          <span className={`text-[14px] font-bold ${text}`}>
            {isCrit ? 'Critical:' : 'Warning:'}
          </span>
          <span className={`text-[14px] font-medium ${text}`}>
            {isCrit
              ? `Refund rate ${r}% — industry average is 2–5%. Immediate action required.`
              : `Refund rate ${r}% is above the 2–5% benchmark.`}
          </span>
        </div>
      </div>
    </div>
  )
}
