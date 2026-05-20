import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { RouteContext } from '@/types/api'
import type { Role } from '@/types/database'
import { getAuthContext } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { validateParams } from '@/lib/validation'
import { macroParams } from '@/lib/schemas/macros'

// POST /api/macros/[id]/restore — clear archived_at
export async function POST(request: NextRequest, { params }: RouteContext<{ id: string }>) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.manageMacros(ctx.role as Role)) {
    return NextResponse.json({ error: 'You do not have permission to restore macros.', code: 'permission_denied' }, { status: 403 })
  }

  const [p, pErr] = validateParams(await params, macroParams)
  if (pErr) return pErr
  const { id } = p

  const macroResult = await supabaseAdmin
    .from('macros')
    .update({ archived_at: null })
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)
    .select()
    .single()

  if (macroResult.error || !macroResult.data) {
    const status = macroResult.error?.code === 'PGRST116' ? 404 : 500
    return NextResponse.json(
      { error: macroResult.error?.message ?? 'Failed to restore macro', code: status === 404 ? 'not_found' : 'update_failed' },
      { status }
    )
  }

  return NextResponse.json({ macro: macroResult.data as Record<string, unknown> })
}
