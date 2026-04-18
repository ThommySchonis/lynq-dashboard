import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

const ADMIN_EMAIL = 'info@lynqagency.com'

// Fixed monthly subscriptions (update these as needed)
const SUBSCRIPTIONS = [
  { name: 'Anthropic (Claude)', cost: 0, note: 'Pay-as-you-go' },
  { name: 'Supabase Pro', cost: 25 },
  { name: 'Vercel Pro', cost: 20 },
  { name: 'Lovable', cost: 25 },
  { name: 'Whop', cost: 0, note: '3% transaction fee' },
]

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  const adminEmail = request.headers.get('x-admin-email')
  if (!authHeader || adminEmail !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const weekAgo = new Date(now - 7 * 86400000).toISOString()
  const monthStart = now.toISOString().slice(0, 7) + '-01'
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10)

  const [todayRes, weekRes, monthRes, lastMonthRes, byRouteRes, activeSubsRes] = await Promise.all([
    supabaseAdmin.from('ai_usage').select('cost_usd, input_tokens, output_tokens').gte('created_at', todayStr),
    supabaseAdmin.from('ai_usage').select('cost_usd, input_tokens, output_tokens').gte('created_at', weekAgo),
    supabaseAdmin.from('ai_usage').select('cost_usd, input_tokens, output_tokens, created_at').gte('created_at', monthStart),
    supabaseAdmin.from('ai_usage').select('cost_usd').gte('created_at', lastMonthStart).lte('created_at', lastMonthEnd),
    supabaseAdmin.from('ai_usage').select('route, cost_usd, input_tokens, output_tokens').gte('created_at', monthStart),
    supabaseAdmin.from('subscriptions').select('plan, status').eq('status', 'active'),
  ])

  const sum = (rows, field) => (rows || []).reduce((acc, r) => acc + (r[field] || 0), 0)

  // Daily breakdown for this month
  const dailyMap = {}
  for (const row of monthRes.data || []) {
    const day = row.created_at.slice(0, 10)
    if (!dailyMap[day]) dailyMap[day] = { cost: 0, calls: 0 }
    dailyMap[day].cost += row.cost_usd || 0
    dailyMap[day].calls += 1
  }
  const dailyBreakdown = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, cost: v.cost, calls: v.calls }))

  // Per-route breakdown this month
  const routeMap = {}
  for (const row of byRouteRes.data || []) {
    if (!routeMap[row.route]) routeMap[row.route] = { cost: 0, calls: 0, input_tokens: 0, output_tokens: 0 }
    routeMap[row.route].cost += row.cost_usd || 0
    routeMap[row.route].calls += 1
    routeMap[row.route].input_tokens += row.input_tokens || 0
    routeMap[row.route].output_tokens += row.output_tokens || 0
  }

  // MRR calculation
  const planPrices = { starter: 29, pro: 59, scale: 119 }
  const mrr = (activeSubsRes.data || []).reduce((acc, s) => acc + (planPrices[s.plan] || 0), 0)

  const fixedCosts = SUBSCRIPTIONS.filter(s => s.cost > 0).reduce((acc, s) => acc + s.cost, 0)
  const aiCostMonth = sum(monthRes.data, 'cost_usd')
  const totalCostMonth = fixedCosts + aiCostMonth
  const netMargin = mrr - totalCostMonth

  return NextResponse.json({
    ai: {
      today: { cost: sum(todayRes.data, 'cost_usd'), calls: todayRes.data?.length || 0 },
      week: { cost: sum(weekRes.data, 'cost_usd'), calls: weekRes.data?.length || 0, input_tokens: sum(weekRes.data, 'input_tokens'), output_tokens: sum(weekRes.data, 'output_tokens') },
      month: { cost: aiCostMonth, calls: monthRes.data?.length || 0, input_tokens: sum(monthRes.data, 'input_tokens'), output_tokens: sum(monthRes.data, 'output_tokens') },
      lastMonth: { cost: sum(lastMonthRes.data, 'cost_usd') },
      byRoute: routeMap,
      daily: dailyBreakdown,
    },
    subscriptions: SUBSCRIPTIONS,
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
