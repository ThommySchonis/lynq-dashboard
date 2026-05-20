import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { listAddons } from '@/lib/services/billing'

// GET /api/billing/addons
// All add-ons in the catalog with this workspace's per-addon status.
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const addons = await listAddons(ctx.workspaceId)
  return NextResponse.json({ addons })
}
