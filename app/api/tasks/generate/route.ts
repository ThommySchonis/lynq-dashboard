import { getAuthContext } from '../../../../lib/auth'
import { getShopifyCredentialsByWorkspace } from '../../../../lib/shopifyCredentials'
import { can } from '../../../../lib/permissions'
import { generatePatternTasks } from '../../../../lib/services/tasks'
import { getRefunds } from '../../../../lib/services/shopify'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Role } from '@/types/database'
import type { Refund } from '@/types/analytics'

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.manageTasks(ctx.role as Role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const credentials = await getShopifyCredentialsByWorkspace(ctx.workspaceId)
  if (!credentials) return NextResponse.json({ error: 'Shopify not configured' }, { status: 400 })

  try {
    // Fetch all refunds (last 365 days) for pattern analysis
    const from = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10)
    const to = new Date().toISOString().slice(0, 10)
    const refunds = await getRefunds(credentials, { from, to }) as unknown as Refund[]
    const result = await generatePatternTasks(ctx.workspaceId, refunds)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
