'use client'

import { Card, CardContent } from '@/components/ui/card'
import type { FinanceData } from '@/types/admin'
import { fmtUsd, fmtNum } from '@/lib/admin-utils'

interface AiCreditsCardProps {
  ai: FinanceData['ai']
}

export function AiCreditsCard({ ai }: AiCreditsCardProps) {
  const rows = [
    {
      label: 'Today',
      cost: ai.today.cost,
      calls: ai.today.calls,
      tokens: null as number | null,
    },
    {
      label: 'Last 7 days',
      cost: ai.week.cost,
      calls: ai.week.calls,
      tokens: ai.week.input_tokens + ai.week.output_tokens,
    },
    {
      label: 'This month',
      cost: ai.month.cost,
      calls: ai.month.calls,
      tokens: ai.month.input_tokens + ai.month.output_tokens,
    },
    {
      label: 'Last month',
      cost: ai.lastMonth.cost,
      calls: null as number | null,
      tokens: null,
    },
  ]

  return (
    <Card>
      <CardContent>
        <div className="mb-0.5 text-[15px] font-semibold text-foreground">AI Credits usage</div>
        <div className="mb-4 text-sm text-muted-foreground">Claude Haiku 4.5</div>

        {rows.map(({ label, cost, calls, tokens }) => (
          <div
            key={label}
            className="flex items-center justify-between border-b border-border/25 py-2.5"
          >
            <div>
              <div className="text-sm font-medium text-foreground">{label}</div>
              {tokens != null && (
                <div className="mt-px text-[11px] text-muted-foreground">
                  {fmtNum(tokens)} tokens &middot; {calls} calls
                </div>
              )}
              {tokens == null && calls != null && (
                <div className="mt-px text-[11px] text-muted-foreground">{calls} calls</div>
              )}
            </div>
            <div className="text-sm font-bold text-violet-600">{fmtUsd(cost)}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
