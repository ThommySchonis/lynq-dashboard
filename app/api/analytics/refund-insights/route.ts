import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { getAuthContext } from '@/lib/auth'
import { getStoreCredentials } from '@/lib/store-credentials'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { DEMO_SHOP, DEMO_INSIGHTS } from '@/lib/demoData'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { validateBody, validateQuery } from '@/lib/validation'
import { refundInsightsBody, refundInsightsQuery } from '@/lib/schemas/analytics'
import { resilientSdkCall } from '@/lib/resilient-fetch'
import { serviceCatchHandler } from '@/lib/service-catch-handler'

interface RefundItem {
  orderId: string | number
  refundAmount: string | number
  refundPct: string | number
  reason?: string
  products?: string[]
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [query, qErr] = validateQuery(request, refundInsightsQuery)
  if (qErr) return qErr

  const credentials = await getStoreCredentials(query.store_id, ctx.workspaceId)
  if (!credentials) return NextResponse.json({ error: 'Store not connected to Shopify' }, { status: 422 })
  if (credentials.domain === DEMO_SHOP) return NextResponse.json({ insights: DEMO_INSIGHTS })

  const [body, bErr] = await validateBody(request, refundInsightsBody)
  if (bErr) return bErr

  const { refunds } = body

  if (refunds.length === 0) return NextResponse.json({ insights: [] })

  const totalRefunded = refunds.reduce((s: number, r: RefundItem) => s + parseFloat(String(r.refundAmount || 0)), 0)

  const reasonMap: Record<string, number> = {}
  refunds.forEach((r: RefundItem) => {
    const key = r.reason || 'No reason given'
    reasonMap[key] = (reasonMap[key] || 0) + 1
  })
  const topReasons = Object.entries(reasonMap).sort((a, b) => b[1] - a[1]).slice(0, 6)

  const productMap: Record<string, number> = {}
  refunds.forEach((r: RefundItem) => {
    ;(r.products || []).forEach((p: string) => {
      productMap[p] = (productMap[p] || 0) + 1
    })
  })
  const topProducts = Object.entries(productMap).sort((a, b) => b[1] - a[1]).slice(0, 5)

  const highValue = [...refunds]
    .sort((a: RefundItem, b: RefundItem) => parseFloat(String(b.refundAmount)) - parseFloat(String(a.refundAmount)))
    .slice(0, 3)
    .map(r => `${r.orderId} (€${r.refundAmount}, ${r.refundPct}% of order value, reason: ${r.reason || 'none'})`)

  const prompt = `You are a Shopify store operations manager. Based on the refund data below, generate 3-5 specific executable to-do tasks for the store owner to take action on today.

STRICT RULES — violating any rule means the output is rejected:
- Every task MUST reference a real product name, order ID, or reason from the data below
- NO generic best practices (forbidden: "add a size guide", "improve packaging", "update your return policy")
- Each task has one clear next step: contact supplier, email a customer, fix a specific listing, or investigate a specific order
- Tasks should directly help recover or prevent money loss

Refund data for this period:
- Total refunds: ${refunds.length}, Total lost: €${totalRefunded.toFixed(2)}

Top refund reasons:
${topReasons.map(([r, c]) => `- "${r}": ${c} time${c > 1 ? 's' : ''}`).join('\n')}

Most refunded products:
${topProducts.length > 0 ? topProducts.map(([p, c]) => `- "${p}": refunded ${c} time${c > 1 ? 's' : ''}`).join('\n') : '- No specific products identified'}

Highest-value refunds:
${highValue.join('\n')}

Return ONLY a valid JSON array. No markdown, no explanation, no extra text:
[{"priority":"high","category":"Supplier","title":"Task title max 8 words","action":"Specific next step referencing actual product names and numbers from the data. State what outcome to expect."}]

category must be one of: "Supplier", "Customer Outreach", "Listing Fix", "Quality Control", "Operations"
priority: "high" if product appears 3+ times or >€100 lost on one issue, "medium" if 2 times or €30-100, "low" otherwise`

  try {
    const { text, usage } = await resilientSdkCall('anthropic', () =>
      generateText({
        model: anthropic('claude-haiku-4-5-20251001'),
        prompt,
        maxOutputTokens: 700,
      })
    )

    try {
      await supabaseAdmin.from('ai_usage').insert({
        route: 'refund-insights',
        model: 'claude-haiku-4-5-20251001',
        input_tokens: usage.inputTokens,
        output_tokens: usage.outputTokens,
        cost_usd: ((usage.inputTokens ?? 0) * 0.0000008) + ((usage.outputTokens ?? 0) * 0.000004),
        user_email: ctx.user.email,
      })
    } catch {
      // best-effort usage tracking
    }

    const clean = text.trim().replace(/^```json?\n?/i, '').replace(/\n?```$/i, '')
    const insights: unknown = JSON.parse(clean)
    return NextResponse.json({ insights: Array.isArray(insights) ? insights : [] })
  } catch (err) {
    return serviceCatchHandler(err, 'anthropic', {
      fallbackData: { insights: [] },
    })
  }
}
