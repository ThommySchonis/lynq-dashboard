'use client'

import { timeAgo } from '@/lib/date-utils'
import { truncate, initialsFor } from '@/lib/feedback-utils'
import { TYPE_META } from '@/lib/feedback-constants'
import type { FeedbackType } from '@/lib/feedback-constants'
import type { FeedbackSubmission } from '@/hooks/lynq-admin'

interface FeedbackRowProps {
  row: FeedbackSubmission
  onClick: () => void
}

export function FeedbackRow({ row, onClick }: FeedbackRowProps) {
  const meta = TYPE_META[row.type as FeedbackType] ?? TYPE_META.other
  const { Icon } = meta
  return (
    <div
      onClick={onClick}
      className="grid gap-3 px-4 py-3.5 border-b border-[#F0EDF4] cursor-pointer transition-colors duration-[120ms] items-center hover:bg-secondary"
      style={{ gridTemplateColumns: '110px 1fr 200px 160px 200px 110px' }}
    >
      {/* Type badge */}
      <div>
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-[6px] text-[12px] font-medium uppercase tracking-[.04em] ${meta.badgeBg} ${meta.badgeText}`}>
          <Icon size={12} strokeWidth={1.75} />
          {meta.label}
        </span>
      </div>

      {/* Message */}
      <div className="text-sm text-foreground overflow-hidden text-ellipsis whitespace-nowrap">
        {truncate(row.message, 80)}
      </div>

      {/* User */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-semibold shrink-0">
          {initialsFor(row.user)}
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-foreground overflow-hidden text-ellipsis whitespace-nowrap">
            {row.user?.name ?? row.user?.email?.split('@')[0] ?? 'Unknown'}
          </div>
          <div className="text-[12px] text-foreground-4 overflow-hidden text-ellipsis whitespace-nowrap">
            {row.user?.email ?? '—'}
          </div>
        </div>
      </div>

      {/* Workspace */}
      <div className="text-[13px] text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">
        {row.workspace?.name ?? '—'}
      </div>

      {/* Page URL */}
      <div className="text-[12px] text-foreground-4 font-mono overflow-hidden text-ellipsis whitespace-nowrap">
        {row.page_url ?? '—'}
      </div>

      {/* Time */}
      <div className="text-[13px] text-muted-foreground">
        {timeAgo(row.created_at)}
      </div>
    </div>
  )
}
