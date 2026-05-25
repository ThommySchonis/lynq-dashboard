import { supabaseAdmin, getUserFromToken } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ADMIN_EMAILS = ['info@lynqagency.com', 'denver9523@gmail.com']

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user || !ADMIN_EMAILS.includes(user.email ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: clientId } = await params

  // Resolve workspace_id from the clients table
  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('workspace_id')
    .eq('id', clientId)
    .single()

  if (!client?.workspace_id) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  // Clear suspension
  const { error } = await supabaseAdmin
    .from('workspaces')
    .update({
      suspended_at: null,
      suspension_reason: null,
    })
    .eq('id', client.workspace_id)

  if (error) {
    console.error('[admin/unsuspend] update failed:', error.message)
    return NextResponse.json({ error: 'Failed to unsuspend workspace' }, { status: 500 })
  }

  console.log('[admin/unsuspend] workspace', client.workspace_id, 'unsuspended by', user.email)
  return NextResponse.json({ ok: true })
}
