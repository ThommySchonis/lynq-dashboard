'use client'

import { useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { useFinance, adminKeys } from '@/hooks/admin'
import { fmtUsd, fmtEur } from '@/lib/admin-utils'
import { AiCreditsCard } from './ai-credits-card'
import { UsageByRouteCard } from './usage-by-route-card'
import { SubscriptionsCard } from './subscriptions-card'
import { DailyCostsCard } from './daily-costs-card'

export function FinanceView() {
  const { data: finance, isLoading } = useFinance()
  const qc = useQueryClient()

  if (isLoading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
  }

  if (!finance) {
    return <div className="py-8 text-center text-sm text-muted-foreground">No finance data available.</div>
  }

  const f = finance.finance
  const ai = finance.ai

  const metrics = [
    {
      label: 'MRR',
      value: fmtEur(f.mrr),
      colorClass: 'text-foreground',
      sub: `${f.activeClients} active clients`,
    },
    {
      label: 'Costs this month',
      value: fmtEur(f.totalCostMonth),
      colorClass: 'text-foreground',
      sub: `Fixed \u20AC${f.fixedCosts} + AI $${f.aiCostMonth.toFixed(4)}`,
    },
    {
      label: 'Net margin',
      value: fmtEur(f.netMargin),
      colorClass: f.netMargin >= 0 ? 'text-emerald-600' : 'text-red-500',
      sub: `${f.marginPct}% of MRR`,
    },
    {
      label: 'AI costs today',
      value: fmtUsd(ai.today.cost),
      colorClass: 'text-foreground',
      sub: `${ai.today.calls} calls`,
    },
  ]

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: adminKeys.finance() })
  }

  return (
    <div>
      {/* Top metrics */}
      <div className="mb-5 grid grid-cols-4 gap-3">
        {metrics.map(({ label, value, colorClass, sub }) => (
          <Card key={label}>
            <CardContent>
              <div className={`text-2xl font-extrabold leading-none tracking-tight ${colorClass}`}>
                {value}
              </div>
              <div className="mb-0.5 mt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {label}
              </div>
              <div className="text-[11px] text-muted-foreground">{sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* AI Credits + Usage by route */}
      <div className="mb-4 grid grid-cols-2 gap-4">
        <AiCreditsCard ai={ai} />
        <UsageByRouteCard byRoute={ai.byRoute} />
      </div>

      {/* Subscriptions + Daily costs */}
      <div className="grid grid-cols-2 gap-4">
        <SubscriptionsCard subscriptions={finance.subscriptions} totalFixed={f.fixedCosts} />
        <DailyCostsCard daily={ai.daily} onRefresh={handleRefresh} />
      </div>
    </div>
  )
}
