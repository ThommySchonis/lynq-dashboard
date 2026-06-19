'use client'

import type { PromoCardConfig } from '@/lib/home-constants'

interface PromoCardProps {
  config: PromoCardConfig
  /** Action buttons rendered on the trailing edge. */
  actions: React.ReactNode
}

export function PromoCard({ config, actions }: PromoCardProps) {
  const { icon: Icon, title, titleEmphasis, description } = config

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-[14px] border border-accent-border bg-card p-4 px-[18px]">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-accent-soft text-primary">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">
          {title}
          {titleEmphasis ? <span className="text-primary"> {titleEmphasis}</span> : null}
        </p>
        <p className="mt-0.5 text-[13px] leading-normal text-foreground-3">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  )
}
