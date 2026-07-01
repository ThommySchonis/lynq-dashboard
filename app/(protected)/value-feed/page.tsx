'use client'

import { useState } from 'react'
import { FeedSkeleton } from '@/components/features/value-feed/feed-skeleton'
import { FeedEmptyState } from '@/components/features/value-feed/feed-empty-state'
import { ValueFeedBackground } from '@/components/features/value-feed/value-feed-background'
import { ValueFeedHero } from '@/components/features/value-feed/value-feed-hero'
import { FeaturedCard } from '@/components/features/value-feed/featured-card'
import { FilterTabs } from '@/components/features/value-feed/filter-tabs'
import { ArticleRow } from '@/components/features/value-feed/article-row'
import { FeedPagination } from '@/components/features/value-feed/feed-pagination'
import { ValueFeedSidebar } from '@/components/features/value-feed/sidebar/value-feed-sidebar'
import { ArticleModal } from '@/components/features/value-feed/article-modal'
import { useValueFeedData, useSavedIds } from '@/hooks/value-feed'
import type { FilterId } from '@/lib/value-feed-utils'

const PAGE_SIZE = 4

export default function ValueFeedPage() {
  const [filter, setFilter] = useState<FilterId>('all')
  const [page, setPage] = useState(1)
  const [activeId, setActiveId] = useState<string | null>(null)
  const { items, isLoading } = useValueFeedData()

  const activeItem = items.find((it) => it.id === activeId) ?? null
  const openNext = () => {
    if (!activeItem) return
    const idx = items.findIndex((it) => it.id === activeItem.id)
    setActiveId(items[(idx + 1) % items.length].id)
  }
  const savedIds = useSavedIds()

  const featured = items[0]
  const rest = featured ? items.slice(1) : items
  const savedSet = new Set(savedIds)

  const filtered =
    filter === 'all'
      ? rest
      : filter === 'saved'
        ? rest.filter((it) => savedSet.has(it.id))
        : rest.filter((it) => it.kind === filter)

  const counts: Record<FilterId, number> = {
    all:         rest.length,
    tip:         rest.filter((it) => it.kind === 'tip').length,
    masterclass: rest.filter((it) => it.kind === 'masterclass').length,
    update:      rest.filter((it) => it.kind === 'update').length,
    saved:       rest.filter((it) => savedSet.has(it.id)).length,
  }

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pageCount)
  const paged = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)

  const changeFilter = (id: FilterId) => {
    setFilter(id)
    setPage(1)
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

              <FilterTabs active={filter} counts={counts} onChange={changeFilter} />

              {isLoading ? (
                <div className="flex flex-col gap-[22px]">
                  {[0, 1, 2].map((i) => (
                    <FeedSkeleton key={i} delay={i * 60} />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <FeedEmptyState hasFilter={filter !== 'all'} onClear={() => changeFilter('all')} />
              ) : (
                <>
                  <div className="flex flex-col gap-[22px]">
                    {paged.map((item) => (
                      <ArticleRow key={item.id} item={item} onOpen={() => setActiveId(item.id)} />
                    ))}
                  </div>
                  <FeedPagination
                    page={current}
                    pageSize={PAGE_SIZE}
                    total={filtered.length}
                    onPageChange={setPage}
                  />
                </>
              )}
            </div>

            <ValueFeedSidebar />
          </div>
        </div>
      </main>

      {activeItem && (
        <ArticleModal item={activeItem} onClose={() => setActiveId(null)} onNext={openNext} />
      )}
    </div>
  )
}
