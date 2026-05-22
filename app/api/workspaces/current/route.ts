import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Role } from '@/types/database'
import { getAuthContext, requireWriteAccess } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { validateBody } from '@/lib/validation'
import { updateWorkspaceBody } from '@/lib/schemas/workspaces'

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: workspace, error } = await supabaseAdmin
    .from('workspaces')
    .select('id, name, slug, logo_url, timezone, locale, date_format, time_format, first_day_of_week, show_order_data, auto_translate, allow_deletion, created_at, updated_at')
    .eq('id', ctx.workspaceId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ workspace, role: ctx.role })
}

export async function PATCH(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const blocked = requireWriteAccess(ctx)
  if (blocked) return blocked
  if (!can.manageWorkspace(ctx.role as Role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [body, bodyErr] = await validateBody(request, updateWorkspaceBody)
  if (bodyErr) return bodyErr

  const updates: Record<string, unknown> = {}

  if (body.name !== undefined) {
    updates.name = body.name.trim()
  }

  if (body.slug !== undefined) {
    const slug = body.slug
    if (slug && !/^[a-z0-9][a-z0-9-]{1,}[a-z0-9]$/.test(slug)) {
      return NextResponse.json({ error: 'Slug must be 3–40 characters, lowercase letters, numbers, and hyphens' }, { status: 400 })
    }
    // Check uniqueness
    if (slug) {
      const { data: existing } = await supabaseAdmin
        .from('workspaces')
        .select('id')
        .eq('slug', slug)
        .neq('id', ctx.workspaceId)
        .maybeSingle()
      if (existing) return NextResponse.json({ error: 'This URL is already taken' }, { status: 409 })
    }
    updates.slug = slug || null
  }

  if (body.logo_url !== undefined)        updates.logo_url = body.logo_url ?? null
  if (body.timezone !== undefined)        updates.timezone = body.timezone
  if (body.locale !== undefined)          updates.locale = body.locale
  if (body.date_format !== undefined)     updates.date_format = body.date_format
  if (body.time_format !== undefined)     updates.time_format = body.time_format
  if (body.first_day_of_week !== undefined) updates.first_day_of_week = body.first_day_of_week
  if (body.show_order_data !== undefined) updates.show_order_data = body.show_order_data
  if (body.auto_translate !== undefined)  updates.auto_translate = body.auto_translate
  if (body.allow_deletion !== undefined)  updates.allow_deletion = body.allow_deletion

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const wsUpdateResult = await supabaseAdmin
    .from('workspaces')
    .update(updates)
    .eq('id', ctx.workspaceId)
    .select()
    .single()

  if (wsUpdateResult.error) return NextResponse.json({ error: wsUpdateResult.error.message }, { status: 500 })
  return NextResponse.json({ workspace: wsUpdateResult.data as Record<string, unknown> })
}
