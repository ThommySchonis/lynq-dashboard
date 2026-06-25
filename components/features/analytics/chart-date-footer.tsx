'use client'

interface ChartDateFooterProps {
  /** Tailwind background class for the accent bar (e.g. 'bg-emerald-500'). */
  dotClassName: string
  label: string
}

/** Centered accent bar + date-range label shown under the Revenue / Monthly charts. */
export function ChartDateFooter({ dotClassName, label }: ChartDateFooterProps) {
  return (
    <div className="flex items-center justify-center gap-2.5">
      <span className={`h-0.5 w-3.5 rounded-full ${dotClassName}`} />
      <span className="text-[12px] font-medium leading-4 text-foreground-4">{label}</span>
    </div>
  )
}
