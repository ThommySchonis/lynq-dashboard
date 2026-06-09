'use client'

import { Sparkles, ThumbsUp, ThumbsDown, MessageSquareText } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useCountUp } from '@/hooks/use-count-up'
import type { EmmaStats } from '@/types/ai-drafts'

function computeValues(stats: EmmaStats) {
  const approvalRate = stats.total_resolved > 0
    ? ((stats.approved + stats.edited + stats.auto_sent) / stats.total_resolved) * 100
    : 0
  const declineRate = stats.total_resolved > 0
    ? (stats.declined / stats.total_resolved) * 100
    : 0
  const coverageRate = stats.total_conversations > 0
    ? (stats.conversations_with_draft / stats.total_conversations) * 100
    : 0

  return { approvalRate, declineRate, coverageRate }
}

interface KpiCardProps {
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  rawValue: number
  isPercentage: boolean
  fallback?: string
  sub: string
}

function KpiCard({ label, icon: Icon, rawValue, isPercentage, fallback, sub }: KpiCardProps) {
  const animTarget = isPercentage ? Math.round(rawValue * 10) : rawValue
  const animCount = useCountUp(animTarget)

  let display: string
  if (fallback && rawValue === 0) {
    display = fallback
  } else if (isPercentage) {
    display = `${(animCount / 10).toFixed(1)}%`
  } else {
    display = animCount.toLocaleString()
  }

  return (
    <div className="motion-reduce:animate-none animate-fade-up rounded-[10px] border border-black/[0.07] bg-white p-[18px_20px] relative overflow-hidden transition-all duration-200 hover:border-black/[0.12] hover:shadow-md hover:-translate-y-px">
      <div className="mb-3.5 flex items-start justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[.06em] text-gray-400">
          {label}
        </div>
        <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[7px] bg-purple-500/[0.08]">
          <Icon size={14} className="text-foreground-4" />
        </div>
      </div>
      <div className="mb-2 text-2xl font-bold leading-none text-gray-900 tabular-nums">
        {display}
      </div>
      <div className="text-[11px] text-gray-400">{sub}</div>
    </div>
  )
}

interface EmmaPerformanceProps {
  stats: EmmaStats
  loaded: boolean
}

export function EmmaPerformance({ stats, loaded }: EmmaPerformanceProps) {
  if (!loaded) {
    return (
      <div className="mb-6 grid grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="motion-reduce:animate-none animate-fade-up rounded-[10px] border border-white/65 bg-white/80 p-[18px_20px] shadow-sm backdrop-blur-xl">
            <Skeleton className="mb-3.5 h-[11px] w-[55%]" />
            <Skeleton className="mb-2 h-[30px] w-[70%]" />
            <Skeleton className="h-[9px] w-[85%]" />
          </div>
        ))}
      </div>
    )
  }

  const { approvalRate, declineRate, coverageRate } = computeValues(stats)
  const noData = stats.total_suggestions === 0

  const coverageSub = stats.total_conversations > 0
    ? `${stats.conversations_with_draft} of ${stats.total_conversations} conversations`
    : 'No conversations'

  const resolvedSub = stats.total_resolved > 0
    ? 'of resolved suggestions'
    : 'No resolved suggestions'

  return (
    <>
      <div className="mb-6 grid grid-cols-4 gap-4">
        <KpiCard
          label="TOTAL SUGGESTIONS"
          icon={Sparkles}
          rawValue={stats.total_suggestions}
          isPercentage={false}
          sub="AI replies generated"
        />
        <KpiCard
          label="APPROVAL RATE"
          icon={ThumbsUp}
          rawValue={approvalRate}
          isPercentage
          fallback={stats.total_resolved === 0 ? '—' : undefined}
          sub={resolvedSub}
        />
        <KpiCard
          label="DECLINE RATE"
          icon={ThumbsDown}
          rawValue={declineRate}
          isPercentage
          fallback={stats.total_resolved === 0 ? '—' : undefined}
          sub={resolvedSub}
        />
        <KpiCard
          label="EMMA COVERAGE"
          icon={MessageSquareText}
          rawValue={coverageRate}
          isPercentage
          fallback={stats.total_conversations === 0 ? '—' : undefined}
          sub={coverageSub}
        />
      </div>

      {noData && (
        <div className="motion-reduce:animate-none animate-fade-up rounded-[10px] border border-black/[0.07] bg-white p-6 text-center">
          <Sparkles size={20} className="mx-auto mb-2 text-gray-300" />
          <p className="text-[13px] font-medium text-gray-500">No Emma suggestions in this period</p>
          <p className="mt-1 text-[11px] text-gray-400">Emma generates suggestions when new inbound messages arrive in the inbox</p>
        </div>
      )}
    </>
  )
}
