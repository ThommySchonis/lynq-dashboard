import { getAuthContext, requireWriteAccess } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { eodReportBody } from '@/lib/schemas/ai'
import { serviceCatchHandler } from '@/lib/service-catch-handler'
import { generateEodReport } from '@/lib/services/eod-report'

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const blocked = requireWriteAccess(ctx)
  if (blocked) return blocked

  // Same shared AI rate-limit bucket as /api/ai/reply.
  const rl = checkRateLimit(`ws:${ctx.workspaceId}:ai`, 10, 60_000)
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
      },
    )
  }

  const raw: unknown = await request.json().catch(() => ({}))
  const parsed = eodReportBody.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  try {
    const report = await generateEodReport(parsed.data)
    return NextResponse.json(
      { report },
      { headers: { 'X-RateLimit-Limit': '10', 'X-RateLimit-Remaining': String(rl.remaining) } },
    )
  } catch (err) {
    return serviceCatchHandler(err, 'anthropic')
  }
}
