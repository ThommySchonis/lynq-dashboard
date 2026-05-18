import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Role } from '@/types/database'
import { getAuthContext } from '../../../../lib/auth'
import { can } from '../../../../lib/permissions'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

const ALLOWED_TIMEZONES = [
  'Europe/Amsterdam', 'Europe/London', 'Europe/Berlin', 'Europe/Paris',
  'Europe/Madrid', 'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'America/Sao_Paulo', 'Asia/Tokyo', 'Asia/Singapore',
  'Asia/Shanghai', 'Australia/Sydney', 'Pacific/Auckland',
]

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: workspace, error } = await supabaseAdmin
    .from('workspaces')
    .select('id, name, slug, logo_url, timezone, locale, date_format, time_format, first_day_of_week, show_order_data, auto_translate, allow_deletion, owner_id, created_at, updated_at')
    .eq('id', ctx.workspaceId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ workspace, role: ctx.role })
}

export async function PATCH(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.manageWorkspace(ctx.role as Role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json() as Record<string, unknown>
  const updates: Record<string, unknown> = {}

  if ('name' in body) {
    if (!(body.name as string)?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    updates.name = (body.name as string).trim()
  }

  if ('slug' in body) {
    const slug = ((body.slug as string) ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '')
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

  if ('logo_url' in body) {
    updates.logo_url = (body.logo_url as string) ?? null
  }

  if ('timezone' in body) {
    if (!ALLOWED_TIMEZONES.includes(body.timezone as string)) {
      return NextResponse.json({ error: 'Invalid timezone' }, { status: 400 })
    }
    updates.timezone = body.timezone
  }

  if ('locale' in body) {
    if (!['en', 'nl', 'de', 'fr', 'es'].includes(body.locale as string)) {
      return NextResponse.json({ error: 'Invalid locale' }, { status: 400 })
    }
    updates.locale = body.locale
  }

  if ('date_format' in body) {
    if (!['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'].includes(body.date_format as string)) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }
    updates.date_format = body.date_format
  }

  if ('time_format' in body) {
    if (!['12h', '24h'].includes(body.time_format as string)) {
      return NextResponse.json({ error: 'Invalid time format' }, { status: 400 })
    }
    updates.time_format = body.time_format
  }

  if ('first_day_of_week' in body) {
    if (!['Sunday', 'Monday'].includes(body.first_day_of_week as string)) {
      return NextResponse.json({ error: 'Invalid first day of week' }, { status: 400 })
    }
    updates.first_day_of_week = body.first_day_of_week
  }

  if ('show_order_data' in body)  updates.show_order_data  = Boolean(body.show_order_data)
  if ('auto_translate' in body)   updates.auto_translate   = Boolean(body.auto_translate)
  if ('allow_deletion' in body)   updates.allow_deletion   = Boolean(body.allow_deletion)

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
