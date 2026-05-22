import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthContext } from '@/lib/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Fixed monthly infrastructure costs (update these as needed)
const INFRA_COSTS = [
  { name: 'Anthropic (Claude)', cost: 0, note: 'Pay-as-you-go' },
  { name: 'Supabase Pro', cost: 25 },
  { name: 'Vercel Pro', cost: 20 },
  { name: 'Lovable', cost: 25 },
  { name: 'Whop', cost: 0, note: '3% transaction fee' },
]

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (ctx.user.email !== 'info@lynqagency.com') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString()
  const monthStart = now.toISOString().slice(0, 7) + '-01'
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10)

  const [todayRes, weekRes, monthRes, lastMonthRes, byRouteRes, activeSubsRes] = await Promise.all([
    supabaseAdmin.from('ai_usage').select('cost_usd, input_tokens, output_tokens').gte('created_at', todayStr),
    supabaseAdmin.from('ai_usage').select('cost_usd, input_tokens, output_tokens').gte('created_at', weekAgo),
    supabaseAdmin.from('ai_usage').select('cost_usd, input_tokens, output_tokens, created_at').gte('created_at', monthStart),
    supabaseAdmin.from('ai_usage').select('cost_usd').gte('created_at', lastMonthStart).lte('created_at', lastMonthEnd),
    supabaseAdmin.from('ai_usage').select('route, cost_usd, input_tokens, output_tokens').gte('created_at', monthStart),
    supabaseAdmin
      .from('workspace_subscriptions')
      .select('plan_id, plans!inner(price_eur)')
      .eq('status', 'active'),
  ])

  const sum = (rows: Array<Record<string, unknown>> | null | undefined, field: string) =>
    (rows || []).reduce((acc, r) => acc + ((r[field] as number) || 0), 0)

  // Daily breakdown for this month
  const dailyMap: Record<string, { cost: number; calls: number }> = {}
  for (const row of (monthRes.data || []) as Array<Record<string, unknown>>) {
    const day = (row.created_at as string).slice(0, 10)
    if (!dailyMap[day]) dailyMap[day] = { cost: 0, calls: 0 }
    dailyMap[day].cost += (row.cost_usd as number) || 0
    dailyMap[day].calls += 1
  }
  const dailyBreakdown = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, cost: v.cost, calls: v.calls }))

  // Per-route breakdown this month
  const routeMap: Record<string, { cost: number; calls: number; input_tokens: number; output_tokens: number }> = {}
  for (const row of (byRouteRes.data || []) as Array<Record<string, unknown>>) {
    const route = row.route as string
    if (!routeMap[route]) routeMap[route] = { cost: 0, calls: 0, input_tokens: 0, output_tokens: 0 }
    routeMap[route].cost += (row.cost_usd as number) || 0
    routeMap[route].calls += 1
    routeMap[route].input_tokens += (row.input_tokens as number) || 0
    routeMap[route].output_tokens += (row.output_tokens as number) || 0
  }

  // MRR calculation
  const mrr = (activeSubsRes.data ?? []).reduce((total, sub) => {
    const plans = sub.plans as unknown as { price_eur: number | null } | Array<{ price_eur: number | null }>
    const price = Array.isArray(plans) ? (plans[0]?.price_eur ?? 0) : (plans?.price_eur ?? 0)
    return total + price
  }, 0)

  const fixedCosts = INFRA_COSTS.filter(s => s.cost > 0).reduce((acc, s) => acc + s.cost, 0)
  const aiCostMonth = sum(monthRes.data as Array<Record<string, unknown>>, 'cost_usd')
  const totalCostMonth = fixedCosts + aiCostMonth
  const netMargin = mrr - totalCostMonth

  return NextResponse.json({
    ai: {
      today: { cost: sum(todayRes.data as Array<Record<string, unknown>>, 'cost_usd'), calls: todayRes.data?.length || 0 },
      week: { cost: sum(weekRes.data as Array<Record<string, unknown>>, 'cost_usd'), calls: weekRes.data?.length || 0, input_tokens: sum(weekRes.data as Array<Record<string, unknown>>, 'input_tokens'), output_tokens: sum(weekRes.data as Array<Record<string, unknown>>, 'output_tokens') },
      month: { cost: aiCostMonth, calls: monthRes.data?.length || 0, input_tokens: sum(monthRes.data as Array<Record<string, unknown>>, 'input_tokens'), output_tokens: sum(monthRes.data as Array<Record<string, unknown>>, 'output_tokens') },
      lastMonth: { cost: sum(lastMonthRes.data as Array<Record<string, unknown>>, 'cost_usd') },
      byRoute: routeMap,
      daily: dailyBreakdown,
    },
    subscriptions: INFRA_COSTS,
    finance: {
      mrr,
      activeClients: activeSubsRes.data?.length || 0,
      fixedCosts,
      aiCostMonth,
      totalCostMonth,
      netMargin,
      marginPct: mrr > 0 ? Math.round((netMargin / mrr) * 100) : 0,
    },
  })
}
