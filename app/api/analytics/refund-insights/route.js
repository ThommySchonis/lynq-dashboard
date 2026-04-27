import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { supabaseAdmin, getUserFromToken } from '../../../../lib/supabaseAdmin'
import { getShopifyCredentials } from '../../../../lib/shopifyCredentials'
import { DEMO_SHOP, DEMO_INSIGHTS } from '../../../../lib/demoData'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const creds = await getShopifyCredentials(user.id, user.email)
  if (creds?.domain === DEMO_SHOP) return NextResponse.json({ insights: DEMO_INSIGHTS })

  const { refunds = [] } = await request.json()

  if (refunds.length === 0) return NextResponse.json({ insights: [] })

  const totalRefunded = refunds.reduce((s, r) => s + parseFloat(r.refundAmount || 0), 0)

  const reasonMap = {}
  refunds.forEach(r => {
    const key = r.reason || 'No reason given'
    reasonMap[key] = (reasonMap[key] || 0) + 1
  })
  const topReasons = Object.entries(reasonMap).sort((a, b) => b[1] - a[1]).slice(0, 6)

  const productMap = {}
  refunds.forEach(r => {
    ;(r.products || []).forEach(p => {
      productMap[p] = (productMap[p] || 0) + 1
    })
  })
  const topProducts = Object.entries(productMap).sort((a, b) => b[1] - a[1]).slice(0, 5)

  const highValue = [...refunds]
    .sort((a, b) => parseFloat(b.refundAmount) - parseFloat(a.refundAmount))
    .slice(0, 3)
    .map(r => `${r.orderId} (€${r.refundAmount}, ${r.refundPct}% of order value, reason: ${r.reason || 'none'})`)

  const prompt = `You are an e-commerce analyst for a Shopify store. Based on this refund data, provide 4-5 specific, actionable recommendations to reduce refunds.

Refund summary:
- Total refunds: ${refunds.length}
- Total amount lost: €${totalRefunded.toFixed(2)}

Top refund reasons:
${topReasons.map(([r, c]) => `- "${r}": ${c} refund${c > 1 ? 's' : ''}`).join('\n')}

Most refunded products:
${topProducts.length > 0 ? topProducts.map(([p, c]) => `- "${p}": ${c} refund${c > 1 ? 's' : ''}`).join('\n') : '- No specific products identified'}

Highest-value refunds:
${highValue.join('\n')}

Return ONLY a JSON array, no markdown, no explanation:
[{"priority":"high","category":"Category","title":"Short title","action":"Specific actionable step"}]

Rules:
- priority: "high", "medium", or "low"
- category examples: "Product Quality", "Shipping", "Customer Communication", "Inventory", "Operations"
- title: max 8 words
- action: 1-2 sentences, specific, reference actual product names or reasons from the data`

  try {
    const { text, usage } = await generateText({
      model: anthropic('claude-haiku-4-5-20251001'),
      prompt,
      maxTokens: 700,
    })

    await supabaseAdmin.from('ai_usage').insert({
      route: 'refund-insights',
      model: 'claude-haiku-4-5-20251001',
      input_tokens: usage.promptTokens,
      output_tokens: usage.completionTokens,
      cost_usd: (usage.promptTokens * 0.0000008) + (usage.completionTokens * 0.000004),
      user_email: user.email,
    }).catch(() => {})

    const clean = text.trim().replace(/^```json?\n?/i, '').replace(/\n?```$/i, '')
    const insights = JSON.parse(clean)
    return NextResponse.json({ insights: Array.isArray(insights) ? insights : [] })
  } catch {
    return NextResponse.json({ insights: [] })
  }
}
