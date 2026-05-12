'use client'

import { useState } from 'react'
import { Zap, CheckCircle, Info, CircleAlert, Loader2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { BADGE_COLORS, fmtEur } from '@/lib/analytics-constants'
import type { PatternAction, AiInsight } from '@/types/analytics'

// ── CatBadge ────────────────────────────────────────────────────────────────

interface CatBadgeProps {
  cat: string
  small?: boolean
}

export function CatBadge({ cat, small }: CatBadgeProps) {
  const c = BADGE_COLORS[cat] || BADGE_COLORS['Other']
  return (
    <span
      className="inline-block whitespace-nowrap rounded-full font-bold uppercase tracking-[.05em]"
      style={{
        fontSize: small ? 9.5 : 10.5,
        color: c.color,
        background: c.bg,
        border: c.border || 'none',
        padding: small ? '1px 7px' : '2px 9px',
      }}
    >
      {cat}
    </span>
  )
}

// ── Types ───────────────────────────────────────────────────────────────────

interface ActionStatus {
  status: string
  pickedUpBy?: string | null
  pickedUpAt?: string | null
  resultNote?: string | null
}

interface ActionBoardProps {
  patternActions: PatternAction[]
  aiInsights: AiInsight[]
  noRefunds: boolean
  loaded: boolean
  onStatusChange: (id: string, status: string, pickedUpBy: string, resultNote: string) => void
  statuses: Record<string, ActionStatus>
  usingFallback: boolean
}

type ActionItem = (PatternAction | (AiInsight & { type: string })) & { id: string }

// ── Component ───────────────────────────────────────────────────────────────

export function ActionBoard({ patternActions, aiInsights, noRefunds, loaded, onStatusChange, statuses, usingFallback }: ActionBoardProps) {
  const [activeTab, setActiveTab] = useState<'open' | 'picked_up' | 'done'>('open')
  const [nameInps, setNameInps] = useState<Record<string, string>>({})
  const [noteInps, setNoteInps] = useState<Record<string, string>>({})

  const aiItems: ActionItem[] = (aiInsights || []).map((ins, i) => ({
    ...ins,
    id: `ai-${ins.category?.replace(/\s+/g, '-').toLowerCase() ?? i}`,
    type: 'ai',
  }))
  const allItems: ActionItem[] = noRefunds ? [...patternActions] : [...patternActions, ...aiItems]
  const getStatus = (id: string) => statuses[id]?.status || 'open'
  const openItems = allItems.filter(a => getStatus(a.id) === 'open')
  const pickupItems = allItems.filter(a => getStatus(a.id) === 'picked_up')
  const doneItems = allItems.filter(a => getStatus(a.id) === 'done')
  const tabItems = activeTab === 'open' ? openItems : activeTab === 'picked_up' ? pickupItems : doneItems

  if (!loaded) {
    return (
      <div className="mb-6 rounded-xl border border-white/65 bg-white/80 p-[22px_24px] shadow-sm backdrop-blur-xl">
        <div className="mb-5 flex items-center gap-2.5">
          <Loader2 size={16} className="animate-spin text-gray-500" />
          <div className="text-sm font-bold text-foreground-2">Analysing refund patterns...</div>
        </div>
        <div className="flex flex-col gap-2.5">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      </div>
    )
  }

  const TABS = ['open', 'picked_up', 'done'] as const
  const TAB_LABELS: Record<string, string> = { open: 'Open', picked_up: 'Picked Up', done: 'Done' }

  return (
    <div className="mb-6 animate-fade-up rounded-xl border border-white/65 bg-white/80 p-[22px_24px] shadow-sm backdrop-blur-xl transition-shadow duration-200 hover:shadow-lg">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            {noRefunds
              ? <CheckCircle size={16} className="text-green-500" />
              : <Zap size={16} className="text-orange-500" />}
            <span className="text-[15px] font-bold text-foreground">
              {noRefunds ? 'No refunds — stay ahead' : 'Action Board'}
            </span>
            {!noRefunds && (
              <span className="text-[11px] text-muted-foreground">
                — {allItems.length} action{allItems.length !== 1 ? 's' : ''}
                {patternActions.length > 0 && ` \u00B7 ${patternActions.length} pattern-detected`}
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {noRefunds ? 'No refunds in this period — all clear' : 'Real-time tasks based on your refund data — assign to your team'}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {usingFallback && (
            <div className="rounded-full border border-[var(--border)] px-2.5 py-0.5 text-[10px] text-muted-foreground">Local only</div>
          )}
          {!noRefunds && TABS.map(tab => {
            const cnt = tab === 'open' ? openItems.length : tab === 'picked_up' ? pickupItems.length : doneItems.length
            const isAct = activeTab === tab
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-full border px-3.5 py-1 text-[11.5px] font-semibold transition-all duration-150 ${
                  isAct
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-black/[0.08] bg-transparent text-gray-400 hover:bg-gray-50'
                }`}
              >
                {TAB_LABELS[tab]}
                {cnt > 0 && <span className="ml-1.5 text-[10px] opacity-65">{cnt}</span>}
              </button>
            )
          })}
          {noRefunds && (
            <div className="rounded-md border border-green-600/20 bg-green-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[.05em] text-green-700">
              Store healthy
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {!noRefunds && allItems.length > 0 && (
        <div className="mb-4 h-[3px] overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-gray-900 transition-[width] duration-400"
            style={{ width: `${(doneItems.length / allItems.length) * 100}%` }}
          />
        </div>
      )}

      {/* Empty state per tab */}
      {tabItems.length === 0 && !noRefunds && (
        <div className="py-9 text-center">
          {activeTab === 'done'
            ? <CheckCircle size={32} className="mx-auto mb-2.5 text-green-700/35" />
            : <CircleAlert size={32} className="mx-auto mb-2.5 text-gray-300" />}
          <div className="text-[13px] text-muted-foreground">
            {activeTab === 'open'
              ? 'All actions picked up or done'
              : activeTab === 'picked_up'
                ? 'No actions currently in progress'
                : 'No completed actions yet'}
          </div>
        </div>
      )}

      {/* Action cards */}
      <div className="flex flex-col gap-2.5">
        {tabItems.map(item => {
          const status = getStatus(item.id)
          const st = statuses[item.id] || {} as ActionStatus
          const isDone = status === 'done'
          const isPattern = 'type' in item && item.type === 'pattern'

          return (
            <div
              key={item.id}
              className={`rounded-lg border border-white/60 bg-white/75 p-3 shadow-sm backdrop-blur-[10px] transition-all duration-150 hover:-translate-y-px hover:border-white/85 hover:bg-white/90 hover:shadow-md ${isDone ? 'opacity-45' : ''}`}
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                    {'priority' in item && item.priority === 'high' && (
                      <span className="inline-block rounded border border-red-500/15 bg-red-500/[0.08] px-[7px] py-0.5 text-[10px] font-semibold text-red-600">
                        URGENT
                      </span>
                    )}
                    <CatBadge cat={item.category} small />
                    {isPattern && 'refundCount' in item && item.refundCount && (
                      <span className="text-[10.5px] tabular-nums text-gray-400">
                        {item.refundCount}&times; &middot; {fmtEur(Number(item.totalAmount))} lost
                      </span>
                    )}
                  </div>
                  <div className={`mb-1.5 text-[13px] font-semibold leading-snug ${isDone ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                    {item.title}
                  </div>
                  <div className={`text-xs leading-relaxed text-gray-600 ${status !== 'open' ? 'mb-2.5' : ''}`}>
                    {'action' in item ? item.action : 'body' in item ? item.body : ''}
                  </div>
                  {status === 'picked_up' && st.pickedUpBy && (
                    <div className="mb-2 text-[11px] text-muted-foreground">
                      Picked up by <strong className="text-foreground-2">{st.pickedUpBy}</strong>
                    </div>
                  )}
                  {isDone && (
                    <div className="mb-2 text-[11px] text-gray-400">
                      {st.pickedUpBy && <>Completed by <strong className="text-gray-600">{st.pickedUpBy}</strong>{st.resultNote ? ' — ' : ''}</>}
                      {st.resultNote && <span className="text-gray-600">{st.resultNote}</span>}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-[5px]">
                  {status === 'open' && (
                    <>
                      <input
                        className="w-[140px] rounded-[7px] border border-black/[0.08] bg-gray-100 px-2.5 py-1 text-[11.5px] text-gray-900 placeholder:text-gray-300 focus:border-black/[0.18] focus:outline-none"
                        placeholder="Your name (optional)"
                        value={nameInps[item.id] || ''}
                        onChange={e => setNameInps(p => ({ ...p, [item.id]: e.target.value }))}
                      />
                      <button
                        className="rounded-md border border-black/[0.08] bg-gray-100 px-3.5 py-[5px] text-xs font-medium text-gray-700 transition-all duration-150 hover:bg-gray-200"
                        onClick={() => onStatusChange(item.id, 'picked_up', nameInps[item.id] || '', '')}
                      >
                        Pick Up
                      </button>
                    </>
                  )}
                  {status === 'picked_up' && (
                    <>
                      <input
                        className="w-[140px] rounded-[7px] border border-black/[0.08] bg-gray-100 px-2.5 py-1 text-[11.5px] text-gray-900 placeholder:text-gray-300 focus:border-black/[0.18] focus:outline-none"
                        placeholder="Result note (optional)"
                        value={noteInps[item.id] || ''}
                        onChange={e => setNoteInps(p => ({ ...p, [item.id]: e.target.value }))}
                      />
                      <div className="flex gap-[5px]">
                        <button
                          className="rounded-full border border-black/[0.08] bg-transparent px-[11px] py-1 text-[11px] font-medium text-gray-400 transition-all duration-150 hover:bg-gray-100 hover:text-gray-600"
                          onClick={() => onStatusChange(item.id, 'open', '', '')}
                        >
                          Re-open
                        </button>
                        <button
                          className="rounded-full border border-green-700/25 bg-green-50 px-3.5 py-[5px] text-xs font-semibold text-green-700 transition-all duration-150 hover:bg-green-100"
                          onClick={() => onStatusChange(item.id, 'done', st.pickedUpBy || '', noteInps[item.id] || '')}
                        >
                          Mark Done
                        </button>
                      </div>
                    </>
                  )}
                  {isDone && (
                    <button
                      className="rounded-full border border-black/[0.08] bg-transparent px-[11px] py-1 text-[11px] font-medium text-gray-400 transition-all duration-150 hover:bg-gray-100 hover:text-gray-600"
                      onClick={() => onStatusChange(item.id, 'open', '', '')}
                    >
                      Re-open
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
