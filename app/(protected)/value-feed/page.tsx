'use client'

import { useState } from 'react'
import PostCard from '@/components/features/value-feed/post-card'
import { FeedSkeleton } from '@/components/features/value-feed/feed-skeleton'
import { FeedEmptyState } from '@/components/features/value-feed/feed-empty-state'
import { ValueFeedBackground } from '@/components/features/value-feed/value-feed-background'
import { ValueFeedHero } from '@/components/features/value-feed/value-feed-hero'
import { FeaturedCard } from '@/components/features/value-feed/featured-card'
import { useValueFeedData } from '@/hooks/value-feed'
import type { FeedItemKind } from '@/hooks/value-feed'
import { FILTERS } from '@/lib/value-feed-utils'

export default function ValueFeedPage() {
  const [filter, setFilter] = useState<'all' | FeedItemKind>('all')
  const [, setActiveId] = useState<string | null>(null)
  const { items, isLoading } = useValueFeedData()

  const featured = items[0]
  const rest = featured ? items.slice(1) : items
  const filtered = filter === 'all' ? rest : rest.filter(it => it.kind === filter)

  const counts: Record<string, number> = {
    all:         rest.length,
    tip:         rest.filter(it => it.kind === 'tip').length,
    masterclass: rest.filter(it => it.kind === 'masterclass').length,
    update:      rest.filter(it => it.kind === 'update').length,
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-card">
      <ValueFeedBackground />

      <main className="relative z-[1] h-screen overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[1170px] flex-col gap-7 px-6 pt-10 pb-14">
          <ValueFeedHero />

          {/* Blog body — content + sidebar */}
          <div className="flex gap-8">
            <div className="flex min-w-0 flex-1 flex-col gap-[22px]">
              {featured && <FeaturedCard item={featured} onOpen={() => setActiveId(featured.id)} />}

              {/* ─── Filter tabs (transitional — replaced in PR2) ─── */}
              <div className="flex flex-wrap items-center gap-2">
                {FILTERS.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilter(f.id)}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                      filter === f.id
                        ? 'bg-accent-soft text-primary'
                        : 'border border-border bg-card text-foreground-3 hover:text-foreground'
                    }`}
                  >
                    {f.label}
                    <span className="text-xs tabular-nums text-foreground-4">{counts[f.id] ?? 0}</span>
                  </button>
                ))}
              </div>

              {/* ─── Feed list (transitional — replaced in PR2) ─── */}
              {isLoading ? (
                <div className="flex flex-col gap-4">
                  {[0, 1, 2].map(i => (
                    <FeedSkeleton key={i} delay={i * 60} />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <FeedEmptyState hasFilter={filter !== 'all'} onClear={() => setFilter('all')} />
              ) : (
                <div className="flex flex-col gap-4">
                  {filtered.map(item => (
                    <PostCard
                      key={item.id}
                      kind={item.kind}
                      title={item.title}
                      dateText={item.dateText}
                      body={item.body ?? undefined}
                      author={item.author ?? undefined}
                      zoomUrl={item.zoomUrl}
                      calUrl={item.calUrl}
                      youtubeUrl={item.youtubeUrl}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Sidebar — populated in PR3 */}
            <aside className="hidden w-[340px] shrink-0 lg:block" />
          </div>
        </div>
      </main>
    </div>
  )
}
