import { getAuthContext } from '../../../../lib/auth'
import { syncAllAccounts } from '../../../../lib/conversationEngine'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    console.log('[sync] Starting sync for workspace:', ctx.workspaceId)
    const result = await syncAllAccounts(ctx.workspaceId)
    console.log('[sync] Result:', JSON.stringify(result))
    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const stack = err instanceof Error ? err.stack : undefined
    console.error('[sync] Error:', message, stack)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
