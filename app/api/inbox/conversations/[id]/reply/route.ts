import { getAuthContext } from '../../../../../../lib/auth'
import { sendReply } from '../../../../../../lib/conversationEngine'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { RouteContext } from '@/types/api'

export async function POST(request: NextRequest, { params }: RouteContext<{ id: string }>) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json() as {
    to?: string[]
    cc?: string[]
    bcc?: string[]
    subject?: string
    bodyHtml?: string
    bodyText?: string
  }

  if (!body.bodyHtml && !body.bodyText) {
    return NextResponse.json({ error: 'Message body required' }, { status: 400 })
  }

  try {
    const result = await sendReply(ctx.workspaceId, id, ctx.user.email ?? '', {
      to: body.to,
      cc: body.cc,
      bcc: body.bcc,
      subject: body.subject,
      bodyHtml: body.bodyHtml,
      bodyText: body.bodyText,
    })

    if (result.error) {
      return NextResponse.json(result, { status: 429 })
    }

    return NextResponse.json(result)
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
