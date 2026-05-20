import { getAuthContext } from '@/lib/auth'
import { linkCustomer } from '@/lib/conversationEngine'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { RouteContext } from '@/types/api'
import { validateBody, validateParams } from '@/lib/validation'
import { conversationParams, linkCustomerBody } from '@/lib/schemas/inbox'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest, { params: routeParams }: RouteContext<{ id: string }>) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = checkRateLimit(`ws:${ctx.workspaceId}:inbox`, 60, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfterMs: rl.resetMs },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(rl.resetMs / 1000)),
          'X-RateLimit-Limit': '60',
          'X-RateLimit-Remaining': '0',
        },
      }
    )
  }

  const [params, paramErr] = validateParams(await routeParams, conversationParams)
  if (paramErr) return paramErr

  const [body, bodyErr] = await validateBody(request, linkCustomerBody)
  if (bodyErr) return bodyErr

  try {
    const result = await linkCustomer(ctx.workspaceId, params.id, body.shopifyCustomerId)
    return NextResponse.json(result)
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
