import { getAuthContext } from '../../../../../../lib/auth'
import { sendReply } from '../../../../../../lib/conversationEngine'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { RouteContext } from '@/types/api'
import { parseBody } from '@/lib/utils/typed-json'
import { checkRateLimit } from '@/lib/rate-limit'

interface ReplyBody {
  to?: string[]
  cc?: string[]
  bcc?: string[]
  subject?: string
  bodyHtml?: string
  bodyText?: string
}

export async function POST(request: NextRequest, { params }: RouteContext<{ id: string }>) {
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

  const { id } = await params
  const body = await parseBody<ReplyBody>(request)

  if (!body.bodyHtml && !body.bodyText) {
    return NextResponse.json({ error: 'Message body required' }, { status: 400 })
  }

  try {
    const result = await sendReply(ctx.workspaceId, id, ctx.user.email ?? '', {
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
