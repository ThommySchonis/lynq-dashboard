import { generateText } from 'ai'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { getAuthContext } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { aiMacrosBody } from '@/lib/schemas/ai'
import { resilientSdkCall } from '@/lib/resilient-fetch'
import { serviceCatchHandler } from '@/lib/service-catch-handler'
import { getAiModel, getAiModelId } from '@/lib/ai/model'
import { computeCost } from '@/lib/ai/pricing'
import { loadWorkspaceBrandContext, buildBrandContextLine } from '@/lib/ai/brand-context'

interface Macro {
  id: string
  name: string
  body: string
}

const MACROS: Macro[] = [
  { id: 'tracking',   name: 'Order Tracking',      body: "Hi,\n\nThank you for reaching out! Your order is on its way. You can track it using the tracking link in your confirmation email. If you haven't received that email, please let me know and I'll send you the tracking details directly.\n\nBest regards,\nLynq & Flow" },
  { id: 'refund',     name: 'Refund Initiated',    body: "Hi,\n\nThank you for contacting us. I've initiated the refund process for your order. You should see the amount returned to your original payment method within 3–5 business days.\n\nPlease don't hesitate to reach out if you have any questions.\n\nBest regards,\nLynq & Flow" },
  { id: 'cancel',     name: 'Cancel Subscription', body: "Hi,\n\nI've cancelled your subscription as requested. You won't be charged further and can continue using the service until the end of your current billing period.\n\nWe're sorry to see you go — if there's anything we could have done better, we'd love to hear your feedback.\n\nBest regards,\nLynq & Flow" },
  { id: 'delay',      name: 'Shipping Delay',      body: "Hi,\n\nI sincerely apologize for the delay with your order. There has been an unexpected delay in our shipping process. We're actively working to get this resolved and your order is being prioritized.\n\nThank you for your patience and understanding.\n\nBest regards,\nLynq & Flow" },
  { id: 'quality',    name: 'Quality Issue',       body: "Hi,\n\nI'm sorry to hear about the quality issue with your order — this is not the standard we hold ourselves to. Could you please send us a photo of the item? We'll arrange a replacement or full refund for you right away.\n\nBest regards,\nLynq & Flow" },
  { id: 'thanks',     name: 'General Response',    body: "Hi,\n\nThank you for reaching out! I'm happy to help with your request. Please let me know if there's anything else I can assist you with.\n\nBest regards,\nLynq & Flow" },
  { id: 'wrongitem',  name: 'Wrong Item Received', body: "Hi,\n\nI'm really sorry to hear you received the wrong item — that's definitely not okay. Could you confirm your order number and the item you received? We'll send the correct item or issue a full refund right away.\n\nBest regards,\nLynq & Flow" },
  { id: 'outofstock', name: 'Out of Stock',        body: "Hi,\n\nThank you for your interest! Unfortunately, the item you're looking for is currently out of stock. I'd be happy to notify you as soon as it's available again — just let me know!\n\nBest regards,\nLynq & Flow" },
]

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = ctx.user

  const rl = checkRateLimit(`user:${user.id}:ai`, 10, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfterMs: rl.resetMs },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(rl.resetMs / 1000)),
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': '0',
        },
      }
    )
  }

  const raw: unknown = await request.json().catch(() => ({}))
  const parsed = aiMacrosBody.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }
  const { subject, snippet } = parsed.data

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ macros: MACROS.slice(0, 3) })
  }

  const macroList = MACROS.map(m => `${m.id}: ${m.name}`).join('\n')

  const policies = await loadWorkspaceBrandContext(ctx.workspaceId)
  const brandLine = buildBrandContextLine(policies)

  const promptBody = `You are a customer service assistant. Based on this customer email, pick the 3 most relevant macro IDs to suggest as quick replies. Return only the 3 IDs, comma-separated, nothing else.

Email subject: ${subject}
Email content: ${snippet}

Available macros:
${macroList}

Return exactly 3 IDs, comma-separated:`

  const fullPrompt = brandLine ? `${brandLine}\n\n${promptBody}` : promptBody

  try {
    const { text, usage } = await resilientSdkCall('anthropic', () =>
      generateText({
        model: getAiModel(),
        prompt: fullPrompt,
        maxOutputTokens: 60,
      })
    )

    await supabaseAdmin.from('ai_usage').insert({
      route: 'macros',
      model: getAiModelId(),
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      cost_usd: computeCost(getAiModelId(), usage),
      user_email: user.email,
    })

    const suggested: Macro[] = text.trim()
      .split(',')
      .map(id => id.trim())
      .map(id => MACROS.find(m => m.id === id))
      .filter((m): m is Macro => m !== undefined)

    // Fill up to 3 with fallbacks
    const used = new Set(suggested.map(m => m.id))
    for (const macro of MACROS) {
      if (suggested.length >= 3) break
      if (!used.has(macro.id)) { suggested.push(macro); used.add(macro.id) }
    }

    return NextResponse.json({ macros: suggested.slice(0, 3) }, {
      headers: {
        'X-RateLimit-Limit': '10',
        'X-RateLimit-Remaining': String(rl.remaining),
      },
    })
  } catch (err) {
    return serviceCatchHandler(err, 'anthropic', {
      fallbackData: { macros: MACROS.slice(0, 3) },
    })
  }
}
