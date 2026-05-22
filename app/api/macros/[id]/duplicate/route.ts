import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { RouteContext } from '@/types/api'
import type { Role } from '@/types/database'
import { getAuthContext, requireWriteAccess } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { validateParams } from '@/lib/validation'
import { macroParams } from '@/lib/schemas/macros'

interface MacroSource {
  name: string
  body: unknown
  language: unknown
  tags: unknown
}

// POST /api/macros/[id]/duplicate — clone a macro with " (copy)" suffix
export async function POST(request: NextRequest, { params }: RouteContext<{ id: string }>) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const blocked = requireWriteAccess(ctx)
  if (blocked) return blocked
  if (!can.manageMacros(ctx.role as Role)) {
    return NextResponse.json({ error: 'You do not have permission to duplicate macros.', code: 'permission_denied' }, { status: 403 })
  }

  const [p, pErr] = validateParams(await params, macroParams)
  if (pErr) return pErr
  const { id } = p

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

  const copyResult = await supabaseAdmin
    .from('macros')
    .insert({
      workspace_id: ctx.workspaceId,
      name:         `${(source as MacroSource).name} (copy)`.slice(0, 200),
      body:         (source as MacroSource).body,
      language:     (source as MacroSource).language,
      tags:         (source as MacroSource).tags,
      created_by:   ctx.user.id,
    })
    .select()
    .single()

  const copy = copyResult.data as Record<string, unknown> | null
  if (copyResult.error || !copy) {
    console.error('[macros duplicate] insert failed:', copyResult.error?.message)
    return NextResponse.json({ error: copyResult.error?.message ?? 'Failed to duplicate macro', code: 'insert_failed' }, { status: 500 })
  }

  console.log('[macros duplicate] cloned', id, '→', copy.id)
  return NextResponse.json({ macro: copy }, { status: 201 })
}
