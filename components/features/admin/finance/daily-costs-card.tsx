'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import type { FinanceData } from '@/types/admin'
import { fmtUsd } from '@/lib/admin-utils'

interface DailyCostsCardProps {
  daily: FinanceData['ai']['daily']
  onRefresh: () => void
}

export function DailyCostsCard({ daily, onRefresh }: DailyCostsCardProps) {
  const maxCost = Math.max(...daily.map((d) => d.cost), 0.0001)

  return (
    <Card>
      <CardContent>
        <div className="mb-0.5 text-[15px] font-semibold text-foreground">AI costs per day</div>
        <div className="mb-4 text-sm text-muted-foreground">This month</div>

        {daily.length === 0 && (
          <div className="text-sm text-muted-foreground">No data yet.</div>
        )}

        <div className="max-h-[260px] overflow-y-auto">
          {[...daily].reverse().map(({ date, cost, calls }) => {
            const pct = Math.min(100, (cost / maxCost) * 100)
            return (
              <div key={date} className="border-b border-border/20 py-[7px]">
                <div className="mb-1 flex justify-between">
                  <span className="text-xs text-muted-foreground">
                    {new Date(date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                  </span>
                  <span className="text-xs font-semibold text-violet-600">
                    {fmtUsd(cost)}{' '}
                    <span className="font-normal text-muted-foreground">&middot; {calls}x</span>
                  </span>
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
        </div>

        <Button variant="default" className="mt-4 w-full" onClick={onRefresh}>
          <RefreshCw size={14} className="mr-1.5" />
          Refresh
        </Button>
      </CardContent>
    </Card>
  )
}
