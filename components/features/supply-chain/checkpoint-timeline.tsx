'use client'

import { getStatus, fmtDateTime } from '@/lib/supply-chain-constants'
import type { Checkpoint } from '@/types/supply-chain'

interface CheckpointTimelineProps {
  checkpoints: Checkpoint[]
}

export function CheckpointTimeline({ checkpoints }: CheckpointTimelineProps) {
  if (!checkpoints?.length) {
    return <p className="text-[12.5px] text-muted-foreground py-3">No tracking events yet.</p>
  }

  return (
    <div className="flex flex-col">
      {checkpoints.map((cp, i) => {
        const s = getStatus(cp.status)
        const isFirst = i === 0
        const isLast = i === checkpoints.length - 1

        return (
          <div key={i} className="flex gap-3">
            {/* Dot + line column */}
            <div className="flex flex-col items-center w-2.5">
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0 mt-[3px]"
                style={{
                  background: isFirst ? s.color : 'var(--secondary)',
                  boxShadow: isFirst ? `0 0 8px ${s.color}80` : 'none',
                }}
              />
              {!isLast && (
                <div className="w-px flex-1 min-h-[18px] bg-(--border) my-[3px] ml-[4.5px] -ml-0" />
              )}
            </div>

            {/* Content */}
            <div className="pb-4 flex-1 min-w-0">
              <p className={`text-[13px] leading-[1.45] mb-[3px] ${isFirst ? 'text-foreground' : 'text-foreground-2'}`}>
                {cp.detail}
              </p>
              {cp.location && (
                <p className="text-[11px] text-muted-foreground mb-0.5">{cp.location}</p>
              )}
              <p className="text-[11.5px] text-muted-foreground">{fmtDateTime(cp.checkpoint_time)}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
