'use client'
import { useManageUrl } from '@/hooks/billing/use-billing-data'

const PLANS = [
  { name: 'Starter',    price: '€30', features: ['100 tickets / month', '50 AI replies / month'] },
  { name: 'Growth',     price: '€89', features: ['1,500 tickets / month', '500 AI replies / month', 'Priority support'] },
  { name: 'Scale',      price: '€249', features: ['5,000 tickets / month', '2,000 AI replies / month', 'Priority support', 'Academy access'] },
  { name: 'Enterprise', price: '€599', features: ['Unlimited tickets', 'Unlimited AI replies', 'Dedicated support', 'Academy access'] },
]

export function UsagePlansTab() {
  const manageQ = useManageUrl()
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        All plans include a 14-day free trial. Choose or change your plan in Shopify.
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan) => (
          <article key={plan.name} className="rounded-lg border border-border bg-card p-4 space-y-3">
            <header>
              <h3 className="text-sm font-medium">{plan.name}</h3>
              <p className="text-lg font-semibold">{plan.price} <span className="text-xs font-normal text-muted-foreground">/ month</span></p>
            </header>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {plan.features.map((f) => <li key={f}>• {f}</li>)}
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
    </div>
  )
}
