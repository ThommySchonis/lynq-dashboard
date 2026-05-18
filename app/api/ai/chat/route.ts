import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { supabaseAdmin, getUserFromToken } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { parseBody } from '@/lib/utils/typed-json'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface StoreKPIs {
  totalOrders?: number
  netRevenue?: number
  refundRate?: number
  cancelledOrders?: number
}

interface StoreOrder {
  name: string
  total: number
  financialStatus: string
  fulfillmentStatus: string
  customer: string
  hasRefund?: boolean
  cancelReason?: string
}

interface StoreRefund {
  orderId: string
  refundAmount: number
  products?: string[]
  customer: string
}

interface StoreContext {
  kpis?: StoreKPIs
  orders?: StoreOrder[]
  refunds?: StoreRefund[]
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  interface ChatBody { message: string; history?: ChatMessage[]; context?: StoreContext }
  const { message, history = [], context } = await parseBody<ChatBody>(request)
  if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 })

  // Context block is only injected on the first message to avoid sending
  // the full dataset on every follow-up question in the conversation.
  const isFirstMessage = history.length === 0

  const storeContextBlock = (isFirstMessage && context)
    ? `## Store Data (This Month)
KPIs: ${context.kpis?.totalOrders ?? 0} orders · €${context.kpis?.netRevenue ?? 0} revenue · ${context.kpis?.refundRate ?? 0}% refund rate · ${context.kpis?.cancelledOrders ?? 0} cancelled

Recent orders (last 50):
${(context.orders || []).slice(0, 50).map(o =>
  `- ${o.name}: €${o.total}, ${o.financialStatus}, ${o.fulfillmentStatus}, customer: ${o.customer}${o.hasRefund ? ' [refunded]' : ''}${o.cancelReason ? ` [cancelled: ${o.cancelReason}]` : ''}`
).join('\n')}

Refunded orders:
${(context.refunds || []).slice(0, 20).map(r =>
  `- Order ${r.orderId}: €${r.refundAmount} refunded, products: ${r.products?.join(', ')}, customer: ${r.customer}`
).join('\n')}`
    : null

  const systemPrompt = `You are Lynq AI, an intelligent business analyst embedded in the Lynq customer support dashboard.
You have access to real-time store data and answer questions about business performance, orders, refunds, and customer trends.
Be concise, confident, and data-driven. Reference specific numbers when available. Format currency with €. Never make up data.`

  // Build messages array: prior history + current user message
  // Context is prepended only to the first user turn
  const historyMessages = (history || [])
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .slice(-10) // keep last 10 turns to avoid token bloat
    .map(m => ({ role: m.role, content: m.content }))

  const userContent = storeContextBlock
    ? `${storeContextBlock}\n\n---\n${message}`
    : message

  const result = streamText({
    model: anthropic('claude-haiku-4-5-20251001'),
    system: systemPrompt,
    messages: [
      ...historyMessages,
      { role: 'user', content: userContent },
    ],
    maxOutputTokens: 800,
    onFinish: async ({ usage }) => {
      await supabaseAdmin.from('ai_usage').insert({
        route: 'chat',
        model: 'claude-haiku-4-5-20251001',
        input_tokens: usage.inputTokens,
        output_tokens: usage.outputTokens,
        cost_usd: ((usage.inputTokens ?? 0) * 0.0000008) + ((usage.outputTokens ?? 0) * 0.000004),
        user_email: user.email,
      }).then(undefined, () => {})
    },
  })

  return result.toTextStreamResponse()
}
