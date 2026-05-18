'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { useFeedbackList } from '@/hooks/lynq-admin'
import type { FeedbackSubmission } from '@/hooks/lynq-admin'
import { FILTER_TABS } from '@/lib/feedback-constants'
import type { TYPE_META } from '@/lib/feedback-constants'
import type { FilterKey } from '@/lib/feedback-constants'
import { FeedbackRow } from '@/components/features/lynq-admin/feedback-row'
import { FeedbackEmptyState } from '@/components/features/lynq-admin/feedback-empty-state'
import { FeedbackDetailPanel } from '@/components/features/lynq-admin/feedback-detail-panel'

export default function LynqAdminFeedbackPage() {
  const router = useRouter()
  const [filter, setFilter] = useState<FilterKey>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<FeedbackSubmission | null>(null)

  const { data, isLoading, error } = useFeedbackList()

  useEffect(() => {
    if (!error) return
    const status = (error as Error & { status?: number }).status
    if (status === 401 || status === 403) {
      toast.error('Access denied')
      setTimeout(() => router.replace('/inbox'), 400)
    } else {
      toast.error('Could not load feedback')
    }
  }, [error, router])

  const submissions = useMemo(() => data?.submissions ?? [], [data])

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = { all: submissions.length, bug: 0, feedback: 0, other: 0 }
    for (const s of submissions) {
      const t = s.type as keyof typeof TYPE_META
      c[t] = (c[t] || 0) + 1
    }
    return c
  }, [submissions])

  const visible = useMemo(() => {
    let list = submissions
    if (filter !== 'all') list = list.filter((s) => s.type === filter)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (s) =>
          (s.message || '').toLowerCase().includes(q) ||
          (s.user?.email || '').toLowerCase().includes(q) ||
          (s.workspace?.name || '').toLowerCase().includes(q),
      )
    }
    return list
  }, [submissions, filter, search])

  return (
    <div className="flex-1 min-h-screen overflow-auto bg-secondary text-foreground">
      <div className="min-h-screen">
        <main className="max-w-[1200px] mx-auto p-8">
          {/* Header */}
          <div className="border-b border-[#F0EDF4] pb-5 mb-6">
            <h1 className="text-[28px] font-semibold m-0 tracking-tight">Feedback</h1>
            <p className="text-sm text-muted-foreground mt-1.5 mb-0">
              Bug reports and suggestions from customers.
            </p>
          </div>

          {/* Filter bar */}
          <div className="flex justify-between items-center gap-4 mb-5 flex-wrap">
            <div className="flex gap-2">
              {FILTER_TABS.map(({ key, label }) => {
                const active = filter === key
                return (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={[
                      'h-9 px-3 rounded-lg text-[13px] inline-flex items-center gap-1.5 cursor-pointer border',
                      active
                        ? 'bg-primary/10 border-primary text-primary font-medium'
                        : 'bg-secondary border-[#E5E0EB] text-muted-foreground font-normal',
                    ].join(' ')}
                  >
                    {label}
                    <span className={['text-xs font-normal', active ? 'text-primary' : 'text-foreground-4'].join(' ')}>
                      ({counts[key] || 0})
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="relative w-[260px]">
              <Search
                size={14}
                strokeWidth={1.75}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-4 pointer-events-none z-10"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search messages..."
                className="pl-[34px] h-9 rounded-lg border-[#E5E0EB] bg-secondary text-[13px] text-foreground"
              />
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-[#E5E0EB] overflow-hidden">
            {isLoading ? (
              <div className="py-20 text-center text-foreground-4 text-[13px]">Loading…</div>
            ) : visible.length === 0 ? (
              <FeedbackEmptyState
                hasFilter={filter !== 'all' || search.trim().length > 0}
                onClear={() => { setFilter('all'); setSearch('') }}
              />
            ) : (
              <>
                {/* Header row */}
                <div className="grid gap-3 px-4 py-2.5 bg-secondary border-b border-[#F0EDF4] text-[11px] font-semibold tracking-[.08em] uppercase text-foreground-4"
                  style={{ gridTemplateColumns: '110px 1fr 200px 160px 200px 110px' }}>
                  <div>Type</div>
                  <div>Message</div>
                  <div>User</div>
                  <div>Workspace</div>
                  <div>Page</div>
                  <div>Submitted</div>
                </div>
                {visible.map((row) => (
                  <FeedbackRow key={row.id} row={row} onClick={() => setSelected(row)} />
                ))}
              </>
            )}
          </div>
        </main>
      </div>

      {selected && (
        <FeedbackDetailPanel row={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
