'use client'

import { Skeleton } from '@/components/ui/skeleton'
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

function resolveAgentName(agentId: string, members: WorkspaceMember[]): string {
  const member = members.find((m) => m.id === agentId)
  return member?.name || 'Unknown'
}

export function AgentTable({ data, members, isLoading }: AgentTableProps) {
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <h3 className="mb-4 text-sm font-semibold text-foreground">Agent Productivity</h3>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="pb-2 text-left font-medium text-muted-foreground">Agent</th>
              <th className="pb-2 text-right font-medium text-muted-foreground">Messages Sent</th>
              <th className="pb-2 text-right font-medium text-muted-foreground">Tickets Resolved</th>
              <th className="pb-2 text-right font-medium text-muted-foreground">One-Touch</th>
              <th className="pb-2 text-right font-medium text-muted-foreground">One-Touch Rate</th>
              <th className="pb-2 text-right font-medium text-muted-foreground">Avg Msgs/Ticket</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="py-3"><Skeleton className="h-4 w-28" /></td>
                  <td className="py-3 text-right"><Skeleton className="ml-auto h-4 w-12" /></td>
                  <td className="py-3 text-right"><Skeleton className="ml-auto h-4 w-12" /></td>
                  <td className="py-3 text-right"><Skeleton className="ml-auto h-4 w-12" /></td>
                  <td className="py-3 text-right"><Skeleton className="ml-auto h-4 w-14" /></td>
                  <td className="py-3 text-right"><Skeleton className="ml-auto h-4 w-12" /></td>
                </tr>
              ))
            ) : !data || data.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No agent data available
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr
                  key={row.agent_id}
                  className={`border-b border-border last:border-0 ${i % 2 === 1 ? 'bg-muted/30' : ''}`}
                >
                  <td className="py-3 font-medium text-foreground">
                    {resolveAgentName(row.agent_id, members)}
                  </td>
                  <td className="py-3 text-right tabular-nums text-foreground">
                    {row.messages_sent.toLocaleString()}
                  </td>
                  <td className="py-3 text-right tabular-nums text-foreground">
                    {row.tickets_resolved.toLocaleString()}
                  </td>
                  <td className="py-3 text-right tabular-nums text-foreground">
                    {row.one_touch_count.toLocaleString()}
                  </td>
                  <td className="py-3 text-right tabular-nums text-foreground">
                    {row.one_touch_rate.toFixed(1)}%
                  </td>
                  <td className="py-3 text-right tabular-nums text-foreground">
                    {row.avg_messages_per_ticket.toFixed(1)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
