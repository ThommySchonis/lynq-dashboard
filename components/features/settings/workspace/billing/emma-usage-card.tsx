'use client'

import { useEmmaUsage } from '@/hooks/billing/use-billing-data'

function fmtEur(n: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'EUR',
  }).format(n)
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function EmmaUsageCard() {
  const usageQ = useEmmaUsage()

  if (usageQ.isLoading) {
    return (
      <section className="rounded-lg border border-border bg-card p-6">
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-4 h-8 w-28 animate-pulse rounded bg-muted" />
      </section>
    )
  }

  if (usageQ.isError || !usageQ.data) {
    return (
      <section className="rounded-lg border border-border bg-card p-6 text-destructive">
        Failed to load Emma usage.
      </section>
    )
  }

  const usage = usageQ.data
  const periodLabel = `${fmtDate(usage.period_start)} – ${fmtDate(usage.period_end)}`

  return (
    <section className="rounded-lg border border-border bg-card p-6 space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-medium">Emma usage this cycle</h2>
        <span className="text-xs text-muted-foreground">{periodLabel}</span>
      </div>

      <div>
        <div className="text-2xl font-semibold">{fmtEur(usage.total_cost_eur)}</div>
        <p className="text-sm text-muted-foreground">
          {usage.total_count.toLocaleString()} Emma generations × {fmtEur(usage.rate_eur)}
        </p>
      </div>

      {usage.stores.length === 0 ? (
        <p className="text-sm text-muted-foreground">No Emma activity this cycle.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 font-normal">Store</th>
              <th className="py-1 font-normal text-right">Generations</th>
              <th className="py-1 font-normal text-right">Cost</th>
            </tr>
          </thead>
          <tbody>
            {usage.stores.map((s) => (
              <tr key={s.store_id} className="border-t border-border">
                <td className="py-1.5">{s.store_name}</td>
                <td className="py-1.5 text-right">{s.count.toLocaleString()}</td>
                <td className="py-1.5 text-right">{fmtEur(s.cost_eur)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="text-xs text-muted-foreground">
        Rate: {fmtEur(usage.rate_eur)} / generation. Shown for transparency — not charged
        separately from your subscription.
      </p>
    </section>
  )
}
