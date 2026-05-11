'use client'

import { Card, CardContent } from '@/components/ui/card'
import type { FinanceData } from '@/types/admin'
import { fmtUsd, fmtNum } from '@/lib/admin-utils'

interface UsageByRouteCardProps {
  byRoute: FinanceData['ai']['byRoute']
}

export function UsageByRouteCard({ byRoute }: UsageByRouteCardProps) {
  const entries = Object.entries(byRoute).sort(([, a], [, b]) => b.cost - a.cost)
  const maxCalls = Math.max(...Object.values(byRoute).map((r) => r.calls), 1)

  return (
    <Card>
      <CardContent>
        <div className="mb-0.5 text-[15px] font-semibold text-foreground">Usage by route</div>
        <div className="mb-4 text-sm text-muted-foreground">This month</div>

        {entries.length === 0 && (
          <div className="text-sm text-muted-foreground">No AI calls logged.</div>
        )}

        {entries.map(([route, v]) => {
          const pct = Math.min(100, (v.calls / maxCalls) * 100)
          return (
            <div key={route} className="border-b border-border/25 py-2.5">
              <div className="mb-1 flex justify-between">
                <span className="text-sm font-medium capitalize text-foreground">{route}</span>
                <span className="text-sm font-bold text-violet-600">{fmtUsd(v.cost)}</span>
              </div>
              <div className="mb-1.5 text-[11px] text-muted-foreground">
                {fmtNum(v.calls)} calls &middot; {fmtNum(v.input_tokens)} in &middot;{' '}
                {fmtNum(v.output_tokens)} out
              </div>
              <div className="h-[3px] rounded-sm bg-muted">
                <div
                  className="h-[3px] rounded-sm bg-violet-600/60"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
