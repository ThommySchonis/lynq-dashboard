import { NextResponse } from 'next/server'
import { getUserFromToken, supabaseAdmin } from '../../../lib/supabaseAdmin'

const VALID_THEMES = ['system', 'dark', 'light']

function sanitizeName(raw) {
  if (typeof raw !== 'string') return ''
  return raw.replace(/[\x00-\x1F\x7F]/g, '').replace(/\s+/g, ' ').trim().slice(0, 50)
}
function sanitizeBio(raw) {
  if (typeof raw !== 'string') return ''
  return raw.replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, 200)
}

// GET /api/profile — current user's profile + email (read-only)
export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = await getUserFromToken(authHeader.replace('Bearer ', ''))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: row, error } = await supabaseAdmin
    .from('user_profiles')
    .select('display_name, bio, avatar_url, theme, welcome_dismissed_at, setup_checklist_dismissed_at, created_at, updated_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[profile GET] failed:', error.message)
    return NextResponse.json({ error: error.message, code: 'lookup_failed' }, { status: 500 })
  }

  // Fall back to auth.users.raw_user_meta_data when no profile row yet.
  // This is what existing UI (e.g. workspace_member_details view) reads,
  // so the first PATCH will sync both layers and they stay aligned.
  const meta = user.user_metadata || {}
  const profile = {
    email:                          user.email,
    display_name:                   row?.display_name ?? meta.name ?? null,
    bio:                            row?.bio ?? null,
    avatar_url:                     row?.avatar_url ?? meta.avatar_url ?? null,
    theme:                          row?.theme ?? 'system',
    welcome_dismissed_at:           row?.welcome_dismissed_at ?? null,
    setup_checklist_dismissed_at:   row?.setup_checklist_dismissed_at ?? null,
  }

  return NextResponse.json({ profile })
}

// PATCH /api/profile — update name/bio/theme. Avatar handled separately.
export async function PATCH(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = await getUserFromToken(authHeader.replace('Bearer ', ''))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))

  const update = {}
  if (body.display_name !== undefined) {
    const name = sanitizeName(body.display_name)
    if (!name) return NextResponse.json({ error: 'Name is required', code: 'name_required' }, { status: 400 })
    update.display_name = name
  }
  if (body.bio !== undefined) {
    update.bio = sanitizeBio(body.bio) || null
  }
  if (body.theme !== undefined) {
    if (!VALID_THEMES.includes(body.theme)) {
      return NextResponse.json({ error: 'Invalid theme', code: 'invalid_theme' }, { status: 400 })
    }
    update.theme = body.theme
  }

  // Onboarding UI dismissals — server stamps the timestamp so we don't
  // trust client clock skew. Pass true to dismiss; pass null to revive.
  if (body.dismiss_welcome === true) {
    update.welcome_dismissed_at = new Date().toISOString()
  } else if (body.welcome_dismissed_at === null) {
    update.welcome_dismissed_at = null
  }
  if (body.dismiss_setup_checklist === true) {
    update.setup_checklist_dismissed_at = new Date().toISOString()
  } else if (body.setup_checklist_dismissed_at === null) {
    update.setup_checklist_dismissed_at = null
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update', code: 'no_changes' }, { status: 400 })
  }

  // Upsert the user_profiles row
  const { data: row, error: upsertError } = await supabaseAdmin
    .from('user_profiles')
    .upsert({ user_id: user.id, ...update }, { onConflict: 'user_id' })
    .select('display_name, bio, avatar_url, theme, welcome_dismissed_at, setup_checklist_dismissed_at, updated_at')
    .single()

  if (upsertError || !row) {
    console.error('[profile PATCH] upsert failed:', upsertError?.message)
    return NextResponse.json({ error: upsertError?.message ?? 'Failed to save profile', code: 'upsert_failed' }, { status: 500 })
  }

  // Mirror the display_name into auth.users.raw_user_meta_data so existing
  // reads (workspace_member_details view, sidebar avatar initials) update
  // immediately. Bio + theme stay only in user_profiles.
  if (update.display_name !== undefined) {
    const newMeta = {
      ...(user.user_metadata || {}),
      name: update.display_name,
    }
    const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: newMeta,
    })
    if (metaError) {
      console.error('[profile PATCH] auth metadata sync failed:', metaError.message)
      // Non-fatal — user_profiles is the source of truth for the profile page itself
    }
  }

  return NextResponse.json({
    profile: {
      email:                        user.email,
      display_name:                 row.display_name,
      bio:                          row.bio,
      avatar_url:                   row.avatar_url,
      theme:                        row.theme,
      welcome_dismissed_at:         row.welcome_dismissed_at,
      setup_checklist_dismissed_at: row.setup_checklist_dismissed_at,
    },
  })
}
