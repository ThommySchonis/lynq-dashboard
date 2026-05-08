import { getAuthContext } from '../../../../lib/auth'
import { syncAllAccounts } from '../../../../lib/conversationEngine'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await syncAllAccounts(ctx.workspaceId)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
