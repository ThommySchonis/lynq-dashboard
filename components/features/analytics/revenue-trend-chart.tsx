'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { fmtEur } from '@/lib/analytics-constants'
import type { RevenueTrendPoint } from '@/types/analytics'

interface RevenueTrendChartProps {
  trend: RevenueTrendPoint[]
  loaded: boolean
  rangeLabel: string
}

export function RevenueTrendChart({ trend, loaded, rangeLabel }: RevenueTrendChartProps) {
  if (!loaded) {
    return (
      <div className="mb-6 rounded-xl border border-white/65 bg-white/80 p-[22px_24px] shadow-sm backdrop-blur-xl">
        <Skeleton className="mb-1.5 h-[13px] w-[30%]" />
        <Skeleton className="mb-5 h-[10px] w-[20%]" />
        <Skeleton className="h-[120px] rounded-lg" />
      </div>
    )
  }

  if (!trend.length || trend.every(d => d.revenue === 0)) return null

  const W = 800, H = 130, pL = 48, pR = 12, pT = 10, pB = 24
  const mx = Math.max(...trend.map(d => d.revenue), 1)
  const tot = trend.reduce((s, d) => s + d.revenue, 0)
  const pts = trend.map((d, i) => ({
    x: pL + (i / Math.max(trend.length - 1, 1)) * (W - pL - pR),
    y: pT + (1 - d.revenue / mx) * (H - pT - pB),
    ...d,
  }))
  const line = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const area = `${pts[0].x.toFixed(1)},${(H - pB).toFixed(1)} ${line} ${pts[pts.length - 1].x.toFixed(1)},${(H - pB).toFixed(1)}`
  const step = Math.ceil(trend.length / 6)
  const xlbls = pts.filter((_, i) => i === 0 || i % step === 0 || i === pts.length - 1)

  return (
    <div className="mb-6 animate-fade-in rounded-xl border border-white/65 bg-white/80 p-[22px_24px] shadow-sm backdrop-blur-xl transition-shadow duration-200 hover:shadow-lg">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="mb-0.5 text-[13px] font-semibold text-[var(--text-1)]">Revenue Trend</div>
          <div className="text-[11px] text-[var(--text-3)]">{rangeLabel} &middot; daily net revenue</div>
        </div>
        <div className="text-base font-bold tracking-tight text-[var(--text-1)]">{fmtEur(tot)}</div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" aria-hidden>
        <defs>
          <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10B981" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((s, i) => {
          const y = pT + s * (H - pT - pB)
          return <line key={i} x1={pL} y1={y} x2={W - pR} y2={y} stroke="rgba(0,0,0,0.04)" strokeWidth="1" />
        })}
        <polygon points={area} fill="url(#tg)" />
        <polyline points={line} fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {pts.filter(p => p.revenue > 0).map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#10B981" />
        ))}
        {xlbls.map((p, i) => (
          <text key={i} x={p.x} y={H} textAnchor="middle" fontSize="9" fill="#BDBDBD" fontFamily="'Switzer', sans-serif">
            {new Date(p.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </text>
        ))}
        {[0, mx / 2, mx].map((v, i) => {
          const y = pT + (1 - v / mx) * (H - pT - pB)
          const lbl = v >= 1000 ? `\u20AC${(v / 1000).toFixed(1)}k` : `\u20AC${Math.round(v)}`
          return <text key={i} x={pL - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#BDBDBD" fontFamily="'Switzer', sans-serif">{lbl}</text>
        })}
      </svg>
    </div>
  )
}
