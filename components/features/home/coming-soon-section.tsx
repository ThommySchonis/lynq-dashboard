'use client'

import { COMING_SOON_ITEMS } from '@/lib/home-constants'

export function ComingSoonSection() {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        Coming soon to Lynq
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {COMING_SOON_ITEMS.map(({ key, icon: Icon, title, description }) => (
          <div
            key={key}
            className="flex flex-col gap-3 rounded-[14px] border border-border bg-card p-5 shadow-card"
          >
            <div className="flex items-center justify-between">
              <div className="flex size-9 items-center justify-center rounded-[10px] bg-accent-soft text-primary">
                <Icon className="size-[18px]" />
              </div>
              <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-foreground-3">
                Coming soon
              </span>
            </div>
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="text-[13px] leading-normal text-foreground-3">{description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
