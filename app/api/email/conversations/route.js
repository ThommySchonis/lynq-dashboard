import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { getAuthContext } from '../../../../lib/auth'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || 'open'

  const { data: conversations } = await supabaseAdmin
    .from('email_conversations')
    .select('*')
    .eq('workspace_id', ctx.workspaceId)
    .eq('status', status)
    .order('last_message_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ conversations: conversations || [] })
}
