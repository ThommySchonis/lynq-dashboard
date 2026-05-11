export interface PricingPlan {
  name: string
  price: string
  ticketLimit: string
  highlighted: boolean
  badge?: string
}

export const PRICING_PLANS: PricingPlan[] = [
  { name: 'Starter', price: '$39',  ticketLimit: '250 tickets / month',   highlighted: false },
  { name: 'Growth',  price: '$79',  ticketLimit: '1,000 tickets / month', highlighted: false },
  { name: 'Pro',     price: '$129', ticketLimit: '2,000 tickets / month', highlighted: true, badge: 'Most popular' },
  { name: 'Scale',   price: '$179', ticketLimit: '3,000 tickets / month', highlighted: false },
]
