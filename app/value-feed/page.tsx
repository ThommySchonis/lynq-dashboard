'use client'

import { useState } from 'react'
import PostCard from '@/components/features/value-feed/post-card'
import { FeedSkeleton } from '@/components/features/value-feed/feed-skeleton'
import { FeedEmptyState } from '@/components/features/value-feed/feed-empty-state'
import { useValueFeedData } from '@/hooks/value-feed'
import type { FeedItemKind } from '@/hooks/value-feed'
import { FILTERS } from '@/lib/value-feed-utils'

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ValueFeedPage() {
  const [filter, setFilter] = useState<'all' | FeedItemKind>('all')
  const { items, isLoading } = useValueFeedData()

  const filtered = filter === 'all' ? items : items.filter(it => it.kind === filter)

  const counts: Record<string, number> = {
    all:         items.length,
    tip:         items.filter(it => it.kind === 'tip').length,
    masterclass: items.filter(it => it.kind === 'masterclass').length,
    update:      items.filter(it => it.kind === 'update').length,
  }

  return (
    <div className="flex min-h-screen bg-[#FAFAF9] text-[#2A2825] [font-family:var(--font-dm-sans,var(--font-sans))]">

      {/* ─── Background orbs — position:fixed so they're not clipped by overflow-y:auto ─── */}
      <div
        aria-hidden="true"
        className="vf-orb pointer-events-none fixed z-0 rounded-full blur-[140px]"
        style={{
          top:        '-12%',
          left:       '-8%',
          width:      800,
          height:     800,
          background: 'radial-gradient(circle, rgba(127, 119, 221, 0.28) 0%, rgba(127, 119, 221, 0.10) 40%, transparent 75%)',
          animation:  'orbDriftA 75s ease-in-out infinite',
        }}
      />
      <div
        aria-hidden="true"
        className="vf-orb pointer-events-none fixed z-0 rounded-full blur-[150px]"
        style={{
          top:        '-8%',
          right:      '-10%',
          width:      700,
          height:     700,
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.24) 0%, rgba(99, 102, 241, 0.08) 40%, transparent 75%)',
          animation:  'orbDriftB 90s ease-in-out infinite',
        }}
      />
      <div
        aria-hidden="true"
        className="vf-orb pointer-events-none fixed z-0 rounded-full blur-[160px]"
        style={{
          bottom:     '-22%',
          left:       '18%',
          width:      750,
          height:     750,
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.18) 0%, rgba(6, 182, 212, 0.06) 40%, transparent 75%)',
          animation:  'orbDriftC 80s ease-in-out infinite',
        }}
      />

      <main className="relative flex-1 overflow-y-auto p-6">
        <div className="relative z-[1] mx-auto max-w-[720px]">

          {/* ─── HERO ─── */}
          <header className="mb-20 pt-2 text-center sm:mb-14">
            <div
              className="opacity-0 animate-fade-up-quick motion-reduce:opacity-100 motion-reduce:animate-none mb-6 text-[12px] font-semibold uppercase tracking-[0.20em] text-[rgba(107,107,102,0.55)]"
              style={{ animationDelay: '0ms' }}
            >
              Value Feed
            </div>

            <h1
              className="m-0 font-normal leading-[1.05] tracking-[-0.02em] text-[#0A0612] text-[clamp(48px,5.5vw,68px)] sm:text-[clamp(36px,9vw,48px)] [font-family:var(--font-display,Georgia,serif)]"
            >
              <span className="inline-block opacity-0 animate-word-reveal motion-reduce:opacity-100 motion-reduce:animate-none" style={{ animationDelay: '0ms'   }}>Value,</span>{' '}
              <span className="inline-block opacity-0 animate-word-reveal motion-reduce:opacity-100 motion-reduce:animate-none" style={{ animationDelay: '100ms' }}>weekly.</span>
            </h1>

            {/* Decorative rule */}
            <div
              aria-hidden="true"
              className="opacity-0 animate-fade-up-quick motion-reduce:opacity-100 motion-reduce:animate-none mx-auto my-6 h-px w-[140px]"
              style={{
                animationDelay: '320ms',
                background:     'linear-gradient(90deg, transparent 0%, rgba(127, 119, 221, 0.45) 50%, transparent 100%)',
              }}
            />

            <p
              className="opacity-0 animate-fade-up-quick motion-reduce:opacity-100 motion-reduce:animate-none mx-auto max-w-[480px] text-[16px] leading-[1.7] text-[#6B6B66]"
              style={{ animationDelay: '420ms' }}
            >
              Tips, masterclasses, and updates from Lynq &amp; Flow.
            </p>
          </header>

          {/* ─── FILTER TABS ─── */}
          <div
            className="opacity-0 animate-fade-up-quick motion-reduce:opacity-100 motion-reduce:animate-none mb-12 flex flex-wrap gap-8 border-b border-[#EFEDE8] sm:mb-8"
            style={{ animationDelay: '540ms' }}
          >
            {FILTERS.map(f => (
              <button
                key={f.id}
                type="button"
                className={`inline-flex items-center gap-1.5 border-none bg-transparent py-2 text-sm font-normal text-[#6B6B66] cursor-pointer font-[inherit] border-b border-b-transparent transition-[color,border-color,opacity,font-weight] duration-150 ${filter === f.id ? 'opacity-100 text-[#0A0612] font-medium border-b-[#0A0612]' : 'opacity-50 hover:opacity-100 hover:text-[#0A0612]'}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
                <span className={`text-[11px] tabular-nums ${filter === f.id ? 'text-[#6B6B66]' : 'text-[#999893]'}`}>{counts[f.id] ?? 0}</span>
              </button>
            ))}
          </div>

          {/* ─── FEED ─── */}
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
              {filtered.map((item, i) => (
                <div
                  key={item.id}
                  className="opacity-0 animate-fade-up-quick motion-reduce:opacity-100 motion-reduce:animate-none"
                  style={{ animationDelay: `${640 + i * 60}ms` }}
                >
                  <PostCard
                    kind={item.kind}
                    title={item.title}
                    dateText={item.dateText}
                    body={item.body ?? undefined}
                    author={item.author ?? undefined}
                    zoomUrl={item.zoomUrl}
                    calUrl={item.calUrl}
                    youtubeUrl={item.youtubeUrl}
                  />
                </div>
              ))}
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
