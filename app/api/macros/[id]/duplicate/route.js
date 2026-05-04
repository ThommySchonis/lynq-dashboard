import { NextResponse } from 'next/server'
import { getAuthContext } from '../../../../../lib/auth'
import { can } from '../../../../../lib/permissions'
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'

// POST /api/macros/[id]/duplicate — clone a macro with " (copy)" suffix
export async function POST(request, { params }) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.manageMacros(ctx.role)) {
    return NextResponse.json({ error: 'You do not have permission to duplicate macros.', code: 'permission_denied' }, { status: 403 })
  }

  const { id } = await params

  const { data: source, error: lookupError } = await supabaseAdmin
    .from('macros')
    .select('name, body, language, tags')
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  if (lookupError) {
    console.error('[macros duplicate] lookup failed:', lookupError.message)
    return NextResponse.json({ error: lookupError.message, code: 'lookup_failed' }, { status: 500 })
  }
  if (!source) return NextResponse.json({ error: 'Macro not found', code: 'not_found' }, { status: 404 })

  const { data: copy, error: insertError } = await supabaseAdmin
    .from('macros')
    .insert({
      workspace_id: ctx.workspaceId,
      name:         `${source.name} (copy)`.slice(0, 200),
      body:         source.body,
      language:     source.language,
      tags:         source.tags,
      created_by:   ctx.user.id,
    })
    .select()
    .single()

  if (insertError || !copy) {
    console.error('[macros duplicate] insert failed:', insertError?.message)
    return NextResponse.json({ error: insertError?.message ?? 'Failed to duplicate macro', code: 'insert_failed' }, { status: 500 })
  }

  console.log('[macros duplicate] cloned', id, '→', copy.id)
  return NextResponse.json({ macro: copy }, { status: 201 })
}
