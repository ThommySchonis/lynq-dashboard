import { getAuthContext } from '../../../../lib/auth'
import { checkConnectionStatus } from '../../../../lib/services/shopify'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ connected: false })

  try {
    return NextResponse.json(await checkConnectionStatus(ctx.workspaceId))
  } catch {
    return NextResponse.json({ connected: false })
  }
}
