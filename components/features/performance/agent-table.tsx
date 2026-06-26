'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { getAvatarInitials } from '@/lib/performance-utils'
import type { AgentProductivityRow } from '@/types/support-analytics'

// ── AgentTable ───────────────────────────────────────────────────────────────

interface WorkspaceMember {
  id: string
  name: string
  email: string
}

interface AgentTableProps {
  data: AgentProductivityRow[] | undefined
  members: WorkspaceMember[]
  isLoading: boolean
}

// Figma column track (sums to 1122 = 1170 card − 48 padding)
const GRID_COLS = 'grid-cols-[280px_180px_180px_150px_170px_162px]'

/** Agent rows whose id isn't a workspace member are the AI agent (Emma). */
function resolveAgent(agentId: string, members: WorkspaceMember[]): { name: string; isAI: boolean } {
  const member = members.find((m) => m.id === agentId)
  return member ? { name: member.name, isAI: false } : { name: 'Emma', isAI: true }
}

export function AgentTable({ data, members, isLoading }: AgentTableProps) {
  return (
    <div className="flex flex-col gap-[18px] rounded-xl border border-border bg-card py-[22px] px-6">
      <h3 className="text-base font-semibold leading-[22px] text-foreground">Agent Productivity</h3>

      <div className="overflow-x-auto">
        <div className="min-w-[1122px]">
          {/* Header */}
          <div className={cn('grid border-b border-border pb-3.5', GRID_COLS)}>
            {['Agent', 'Messages Sent', 'Tickets Resolved', 'One-Touch', 'One-Touch Rate', 'Avg Msgs/Ticket'].map((h) => (
              <span key={h} className="text-sm font-medium leading-5 text-foreground-3">{h}</span>
            ))}
          </div>

          {/* Body */}
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={cn('grid items-center border-t border-border py-3.5', GRID_COLS)}>
                <div className="flex items-center gap-2.5">
                  <Skeleton className="h-7 w-7 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
                {[0, 1, 2, 3, 4].map((c) => (
                  <Skeleton key={c} className="h-4 w-12" />
                ))}
              </div>
            ))
          ) : !data || data.length === 0 ? (
            <div className="flex justify-center pt-[26px] pb-5 text-sm font-medium leading-5 text-foreground-3">
              No agent data available
            </div>
          ) : (
            data.map((row) => {
              const agent = resolveAgent(row.agent_id, members)
              return (
                <div key={row.agent_id} className={cn('grid items-center border-t border-border py-3.5', GRID_COLS)}>
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white',
                        agent.isAI ? 'bg-primary' : 'bg-foreground-4',
                      )}
                    >
                      {getAvatarInitials(agent.name)}
                    </span>
                    <span className="truncate text-sm font-semibold leading-5 text-foreground">{agent.name}</span>
                  </div>
                  <span className="text-sm font-medium leading-5 text-foreground-3 tabular-nums">{row.messages_sent.toLocaleString()}</span>
                  <span className="text-sm font-medium leading-5 text-foreground-3 tabular-nums">{row.tickets_resolved.toLocaleString()}</span>
                  <span className="text-sm font-medium leading-5 text-foreground-3 tabular-nums">{row.one_touch_count.toLocaleString()}</span>
                  <span className="text-sm font-medium leading-5 text-foreground-3 tabular-nums">{row.one_touch_rate.toFixed(0)}%</span>
                  <span className="text-sm font-medium leading-5 text-foreground-3 tabular-nums">{row.avg_messages_per_ticket.toFixed(1)}</span>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
