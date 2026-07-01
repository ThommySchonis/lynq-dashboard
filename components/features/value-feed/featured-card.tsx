'use client'

import { CoverDecor } from './cover-decor'
import { KIND_LABEL, readTimeOf } from '@/lib/value-feed-utils'
import type { NormalizedFeedItem } from '@/hooks/value-feed'

interface FeaturedCardProps {
  item: NormalizedFeedItem
  onOpen: () => void
}

/**
 * Hero "Featured" article card (Figma node 400:793). Bound to the newest feed
 * item. Cover with decorative orbs + badge, then meta / title / excerpt /
 * author + "Read more".
 */
export function FeaturedCard({ item, onOpen }: FeaturedCardProps) {
  const kindLabel = KIND_LABEL[item.kind]

  return (
    <article className="overflow-hidden rounded-[20px] border border-border bg-card shadow-[0_12px_32px_rgba(28,15,54,0.07)]">
      {/* Cover */}
      <div className="relative h-[200px] overflow-hidden bg-[linear-gradient(111deg,#F1ECFF_0%,#FFFFFF_74%)] p-[18px]">
        <CoverDecor />
        <span className="relative inline-flex items-center rounded-full bg-white/[0.92] px-3 py-1.5 text-xs font-semibold uppercase leading-[14px] tracking-[0.08em] text-primary">
          ★&nbsp;&nbsp;FEATURED {kindLabel}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-3.5 bg-card px-8 pb-7 pt-6">
        {/* Meta */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase leading-[14px] tracking-[0.08em] text-foreground-3">
            {kindLabel}
          </span>
          <span className="text-xs leading-4 text-foreground-4">·</span>
          <span className="text-xs uppercase leading-4 tracking-[0.08em] text-foreground-4">
            {readTimeOf(item.body)}
          </span>
          <span aria-hidden="true" className="w-2.5" />
          <span className="text-xs leading-4 text-foreground-4">{item.dateText}</span>
        </div>

        {/* Title */}
        <h3 className="text-base font-semibold leading-[22px] text-foreground">{item.title}</h3>

        {/* Excerpt */}
        {item.body && <p className="text-sm leading-5 text-foreground-2">{item.body}</p>}

        {/* Footer */}
        <div className="flex items-center justify-between">
          {item.author ? (
            <div className="flex items-center gap-2.5 pt-1">
              <span aria-hidden="true" className="size-8 shrink-0 rounded-full bg-black/[0.14]" />
              <div className="flex flex-col gap-px">
                <span className="text-sm font-semibold leading-5 text-foreground">{item.author.name}</span>
                <span className="text-xs leading-4 text-foreground-4">Lynq &amp; Flow</span>
              </div>
            </div>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onOpen}
            className="cursor-pointer text-xs font-medium leading-4 text-primary transition-colors hover:text-primary-hover"
          >
            Read more&nbsp;&nbsp;→
          </button>
        </div>
      </div>
    </article>
  )
}
