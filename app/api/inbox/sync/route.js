import { getAuthContext } from '../../../../lib/auth'
import { syncAllAccounts } from '../../../../lib/conversationEngine'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    console.log('[sync] Starting sync for workspace:', ctx.workspaceId)
    const result = await syncAllAccounts(ctx.workspaceId)
    console.log('[sync] Result:', JSON.stringify(result))
    return NextResponse.json(result)
  } catch (err) {
    console.error('[sync] Error:', err.message, err.stack)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
