import { getAuthContext, requireWriteAccess } from '@/lib/auth'
import { can } from '@/lib/permissions'
import type { Role } from '@/types/database'
import { sendReply } from '@/lib/conversationEngine'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { RouteContext } from '@/types/api'
import { validateBody, validateParams } from '@/lib/validation'
import { conversationParams, replyBody } from '@/lib/schemas/inbox'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest, { params: routeParams }: RouteContext<{ id: string }>) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const blocked = requireWriteAccess(ctx)
  if (blocked) return blocked
  if (!can.replyToTickets(ctx.role as Role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

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

  const [body, bodyErr] = await validateBody(request, replyBody)
  if (bodyErr) return bodyErr

  try {
    const result = await sendReply(ctx.workspaceId, params.id, ctx.user.email ?? '', {
      to: (body.to ?? []).map(e => ({ email: e })),
      cc: (body.cc ?? []).map(e => ({ email: e })),
      bcc: (body.bcc ?? []).map(e => ({ email: e })),
      subject: body.subject ?? '',
      bodyHtml: body.bodyHtml ?? '',
      bodyText: body.bodyText ?? '',
    }, ctx.memberId)

    if ('error' in result) {
      return NextResponse.json(result, { status: 429 })
    }

    return NextResponse.json(result)
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
