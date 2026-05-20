import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { RouteContext } from '@/types/api'
import type { Role } from '@/types/database'
import { getAuthContext } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sanitizeMacroInput, relativeTime } from '@/lib/macros'
import { ensureTagsByName, syncMacroTags } from '@/lib/tags'
import { validateParams } from '@/lib/validation'
import { macroParams } from '@/lib/schemas/macros'

interface TagLink {
  tag: unknown
}

interface MacroInputError {
  message?: string
  code?: string
}

// GET /api/macros/[id] — single macro detail
export async function GET(request: NextRequest, { params }: RouteContext<{ id: string }>) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.viewMacros(ctx.role as Role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [p, pErr] = validateParams(await params, macroParams)
  if (pErr) return pErr
  const { id } = p

  const { data: macro, error } = await supabaseAdmin
    .from('macros')
    .select(`
      id, name, body, language, tags, usage_count, last_used_at, archived_at, created_at, updated_at, created_by,
      tag_links:macro_tags(tag:tags(id, name, color))
    `)
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  if (error) {
    console.error('[macros GET id] failed:', error.message)
    return NextResponse.json({ error: error.message, code: 'lookup_failed' }, { status: 500 })
  }
  if (!macro) return NextResponse.json({ error: 'Macro not found', code: 'not_found' }, { status: 404 })

  const macroTyped = macro as Record<string, unknown>
  const tagObjects = Array.isArray(macroTyped.tag_links)
    ? (macroTyped.tag_links as TagLink[]).map((l: TagLink) => l.tag).filter(Boolean)
    : []
  const { tag_links: _tag_links, ...rest } = macroTyped

  return NextResponse.json({
    macro: {
      ...rest,
      tagObjects,
      last_updated_relative: relativeTime(macroTyped.updated_at as string | null | undefined),
      last_used_relative:    relativeTime(macroTyped.last_used_at as string | null | undefined),
    },
    currentUserRole: ctx.role,
  })
}

// PATCH /api/macros/[id] — update name/body/language/tags
export async function PATCH(request: NextRequest, { params }: RouteContext<{ id: string }>) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.manageMacros(ctx.role as Role)) {
    return NextResponse.json({ error: 'You do not have permission to edit macros.', code: 'permission_denied' }, { status: 403 })
  }

  const [p2, p2Err] = validateParams(await params, macroParams)
  if (p2Err) return p2Err
  const { id } = p2
  const body = await request.json().catch(() => ({})) as Record<string, unknown>

  let payload
  try {
    payload = sanitizeMacroInput(body, { partial: true })
  } catch (err: unknown) {
    const e = err as MacroInputError
    return NextResponse.json({ error: e.message, code: e.code }, { status: 400 })
  }

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: 'Nothing to update', code: 'no_changes' }, { status: 400 })
  }

  const macroResult = await supabaseAdmin
    .from('macros')
    .update(payload)
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)
    .select()
    .single()

  const macro = macroResult.data as Record<string, unknown> | null

  if (macroResult.error || !macro) {
    console.error('[macros PATCH] update failed:', macroResult.error?.message)
    const status = macroResult.error?.code === 'PGRST116' ? 404 : 500
    return NextResponse.json(
      { error: macroResult.error?.message ?? 'Failed to update macro', code: status === 404 ? 'not_found' : 'update_failed' },
      { status }
    )
  }

  // Sync macro_tags whenever the caller sent a tags field (even an empty
  // array, which means "remove all tags"). If tags wasn't in the payload,
  // leave existing macro_tags untouched.
  let tagObjects: unknown[] = []
  if (Array.isArray(payload.tags)) {
    try {
      const tagMap = await ensureTagsByName(supabaseAdmin, ctx.workspaceId, payload.tags as string[], ctx.user.id)
      const tagIds = Array.from(tagMap.values())
      await syncMacroTags(supabaseAdmin, macro.id as string, tagIds)
      const { data: linked } = await supabaseAdmin
        .from('tags')
        .select('id, name, color')
        .in('id', tagIds.length ? tagIds : ['00000000-0000-0000-0000-000000000000'])
      tagObjects = linked || []
    } catch (err: unknown) {
      console.error('[macros PATCH] tag sync failed (macro update succeeded):', err instanceof Error ? err.message : 'Unknown error')
    }
  }

  return NextResponse.json({ macro: { ...macro, tagObjects } })
}

// DELETE /api/macros/[id] — hard delete (UI confirms first)
export async function DELETE(request: NextRequest, { params }: RouteContext<{ id: string }>) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.deleteMacros(ctx.role as Role)) {
    return NextResponse.json({ error: 'Only owners and admins can delete macros.', code: 'permission_denied' }, { status: 403 })
  }

  const [p3, p3Err] = validateParams(await params, macroParams)
  if (p3Err) return p3Err
  const { id } = p3

  const { data: target, error: lookupError } = await supabaseAdmin
    .from('macros')
    .select('id, name')
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  if (lookupError) {
    console.error('[macros DELETE] lookup failed:', lookupError.message)
    return NextResponse.json({ error: lookupError.message, code: 'lookup_failed' }, { status: 500 })
  }
  if (!target) return NextResponse.json({ error: 'Macro not found', code: 'not_found' }, { status: 404 })

  const { error: deleteError } = await supabaseAdmin
    .from('macros')
    .delete()
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)

  if (deleteError) {
    console.error('[macros DELETE] failed:', deleteError.message)
    return NextResponse.json({ error: deleteError.message, code: 'delete_failed' }, { status: 500 })
  }

  console.log('[macros DELETE] removed', id, 'name:', target.name, 'in workspace', ctx.workspaceId)
  return NextResponse.json({ ok: true })
}
