import { getAuthContext } from '../../../../../lib/auth'
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function DELETE(request, { params }) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { error } = await supabaseAdmin
    .from('email_accounts')
    .update({ status: 'disconnected' })
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
