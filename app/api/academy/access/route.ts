import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getWorkspaceFeatures, listAddons } from '@/lib/services/billing'

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const features = await getWorkspaceFeatures(ctx.workspaceId)

  // Plan-level access
  if (features.academy_access) {
    return NextResponse.json({ hasAccess: true })
  }

  // Addon-purchased access (check workspace_addons)
  const addons = await listAddons(ctx.workspaceId)
  const academyAddon = addons.find(a => a.id === 'academy')
  if (academyAddon?.workspace_status === 'active') {
    return NextResponse.json({ hasAccess: true })
  }

  return NextResponse.json({
    hasAccess: false,
    canPurchase: true,
    addonPrice: academyAddon?.price_eur ?? 100,
  })
}
