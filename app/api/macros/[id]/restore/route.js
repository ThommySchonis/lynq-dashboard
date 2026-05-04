import { NextResponse } from 'next/server'
import { getAuthContext } from '../../../../../lib/auth'
import { can } from '../../../../../lib/permissions'
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'

// POST /api/macros/[id]/restore — clear archived_at
export async function POST(request, { params }) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.manageMacros(ctx.role)) {
    return NextResponse.json({ error: 'You do not have permission to restore macros.', code: 'permission_denied' }, { status: 403 })
  }

  const { id } = await params

  const { data: macro, error } = await supabaseAdmin
    .from('macros')
    .update({ archived_at: null })
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)
    .select()
    .single()

  if (error || !macro) {
    const status = error?.code === 'PGRST116' ? 404 : 500
    return NextResponse.json(
      { error: error?.message ?? 'Failed to restore macro', code: status === 404 ? 'not_found' : 'update_failed' },
      { status }
    )
  }

  return NextResponse.json({ macro })
}
