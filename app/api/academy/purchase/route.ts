import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getWorkspaceFeatures, subscribeAddon, listAddons } from '@/lib/services/billing'

export async function POST(request: NextRequest) {
  if (process.env.PAYMENTS_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Payments are not enabled' }, { status: 503 })
  }

  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check if already has access via plan
  const features = await getWorkspaceFeatures(ctx.workspaceId)
  if (features.academy_access) {
    return NextResponse.json(
      { error: 'Academy access already included in your plan' },
      { status: 400 }
    )
  }

  // Check if already purchased via addon
  const addons = await listAddons(ctx.workspaceId)
  const academyAddon = addons.find(a => a.id === 'academy')
  if (academyAddon?.workspace_status === 'active') {
    return NextResponse.json(
      { error: 'Academy access already active' },
      { status: 400 }
    )
  }

  const result = await subscribeAddon(ctx.workspaceId, 'academy')

  return NextResponse.json({
    success: true,
    addon: 'academy',
    status: result.status,
  })
}
