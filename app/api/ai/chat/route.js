import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { supabaseAdmin, getUserFromToken } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { message, context } = await request.json()
  if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 })

  const systemPrompt = `You are Lynq AI, an intelligent business analyst embedded in the Lynq customer support dashboard.
You have access to real-time store data and answer questions about business performance, orders, refunds, and customer trends with precision.

Guidelines:
- Be concise, confident, and data-driven — like a trusted business advisor
- Always reference specific numbers from the context when available
- Format currency with the € symbol
- Use bullet points only when listing multiple items; use prose for simple answers
- Highlight actionable insights where relevant
- If asked something you don't have data for, say so clearly
- Never make up numbers or orders that aren't in the context`

  const storeContextBlock = context
    ? `## Store Data (This Month)
KPIs:
- Total orders: ${context.kpis?.totalOrders ?? 'N/A'}
- Net revenue: €${context.kpis?.netRevenue ?? 'N/A'}
- Cancelled orders: ${context.kpis?.cancelledOrders ?? 'N/A'}
- Total refunds: ${context.kpis?.totalRefunds ?? 'N/A'}
- Refund rate: ${context.kpis?.refundRate ?? 'N/A'}%
- Refund amount: €${context.kpis?.refundAmount ?? 'N/A'}

Recent orders (last 50):
${(context.orders || []).slice(0, 50).map(o =>
  `- ${o.name}: €${o.total}, ${o.financialStatus}, ${o.fulfillmentStatus}, customer: ${o.customer}${o.hasRefund ? ' [refunded]' : ''}${o.cancelReason ? ` [cancelled: ${o.cancelReason}]` : ''}`
).join('\n')}

Refunded orders:
${(context.refunds || []).slice(0, 20).map(r =>
  `- Order ${r.orderId}: €${r.refundAmount} refunded, ${r.itemCount} item(s), products: ${r.products?.join(', ')}, customer: ${r.customer}`
).join('\n')}`
    : 'No store data loaded yet.'

  const result = streamText({
    model: anthropic('claude-haiku-4-5-20251001'),
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `${storeContextBlock}\n\n---\nUser question: ${message}`,
      },
    ],
    maxTokens: 800,
    onFinish: async ({ usage }) => {
      await supabaseAdmin.from('ai_usage').insert({
        route: 'chat',
        model: 'claude-haiku-4-5-20251001',
        input_tokens: usage.promptTokens,
        output_tokens: usage.completionTokens,
        cost_usd: (usage.promptTokens * 0.0000008) + (usage.completionTokens * 0.000004),
        user_email: user.email,
      }).catch(() => {})
    },
  })

  return result.toTextStreamResponse()
}
