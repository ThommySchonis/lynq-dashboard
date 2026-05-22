import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getWorkspaceFeatures, getSubscriptionWithUsage } from '@/lib/services/billing'

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [features, subWithUsage] = await Promise.all([
    getWorkspaceFeatures(ctx.workspaceId),
    getSubscriptionWithUsage(ctx.workspaceId),
  ])

  const sent = subWithUsage?.usage?.tickets_used ?? 0

  return NextResponse.json(
    {
      sent,
      limit: features.email_limit,
      plan: subWithUsage?.plan?.display_name?.toLowerCase() ?? null,
    },
    {
      headers: { 'Cache-Control': 'private, max-age=300' },
    }
  )
}
