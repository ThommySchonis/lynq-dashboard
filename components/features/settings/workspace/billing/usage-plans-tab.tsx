'use client'
import { useManageUrl, usePlans } from '@/hooks/billing/use-billing-data'
import type { Plan } from '@/types/billing'

function planFeatures(p: Plan): string[] {
  const tickets = p.ticket_limit === null
    ? 'Unlimited tickets / month'
    : `${p.ticket_limit.toLocaleString()} tickets / month`
  const ai = p.ai_suggest_limit === null
    ? 'Unlimited AI replies / month'
    : `${p.ai_suggest_limit.toLocaleString()} AI replies / month`
  const out = [tickets, ai]
  if (p.features?.priority_support) out.push('Priority support')
  if (p.features?.academy_access) out.push('Academy access')
  return out
}

function fmtEur(price: number | null): string {
  return price === null ? '—' : `€${price.toLocaleString()}`
}

export function UsagePlansTab() {
  const manageQ = useManageUrl()
  const plansQ = usePlans()
  const plans = plansQ.data ?? []

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        All plans include a 7-day free trial. Prices are in EUR; Shopify bills in your store&apos;s local
        currency. Choose or change your plan in Shopify.
      </p>
      {plansQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading plans…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <article key={plan.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
              <header>
                <h3 className="text-sm font-medium">{plan.display_name}</h3>
                <p className="text-lg font-semibold">
                  {fmtEur(plan.price_eur)} <span className="text-xs font-normal text-muted-foreground">/ month</span>
                </p>
              </header>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {planFeatures(plan).map((f) => <li key={f}>• {f}</li>)}
              </ul>
              {manageQ.data && (
                <a
                  href={manageQ.data}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  Choose in Shopify ↗
                </a>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
