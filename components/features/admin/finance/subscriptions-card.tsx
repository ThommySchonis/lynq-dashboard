'use client'

import { Card, CardContent } from '@/components/ui/card'
import type { FinanceData } from '@/types/admin'

interface SubscriptionsCardProps {
  subscriptions: FinanceData['subscriptions']
  totalFixed: number
}

export function SubscriptionsCard({ subscriptions, totalFixed }: SubscriptionsCardProps) {
  return (
    <Card>
      <CardContent>
        <div className="mb-0.5 text-[15px] font-semibold text-foreground">Fixed subscriptions</div>
        <div className="mb-4 text-sm text-muted-foreground">Monthly fixed costs</div>

        {subscriptions.map((sub) => (
          <div
            key={sub.name}
            className="flex items-center justify-between border-b border-border/25 py-2.5"
          >
            <div>
              <div className="text-sm font-medium text-foreground">{sub.name}</div>
              {sub.note && (
                <div className="mt-px text-[11px] text-muted-foreground">{sub.note}</div>
              )}
            </div>
            <div
              className={`text-sm font-bold ${sub.cost > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}
            >
              {sub.cost > 0 ? `$${sub.cost}/mo` : '\u2014'}
            </div>
          </div>
        ))}

        <div className="flex justify-between pt-3">
          <span className="text-sm font-semibold text-foreground">Total</span>
          <span className="text-sm font-extrabold text-amber-600">${totalFixed}/mo</span>
        </div>
      </CardContent>
    </Card>
  )
}
