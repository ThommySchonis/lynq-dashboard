import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getUserFromToken, supabaseAdmin } from '@/lib/supabaseAdmin'
import { validateBody } from '@/lib/validation'
import { updateProfileBody } from '@/lib/schemas/profile'
import { logger } from '@/lib/logger'

interface ProfileRow { display_name?: string; bio?: string; avatar_url?: string; theme?: string; welcome_dismissed_at?: string | null; setup_checklist_dismissed_at?: string | null }

function sanitizeName(raw: string): string {
  return raw.replace(/[\x00-\x1F\x7F]/g, '').replace(/\s+/g, ' ').trim().slice(0, 50)
}
function sanitizeBio(raw: string): string {
  return raw.replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, 200)
}

// PATCH /api/profile — update name/bio/theme. Avatar handled separately.
export async function PATCH(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = await getUserFromToken(authHeader.replace('Bearer ', ''))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [body, bodyErr] = await validateBody(request, updateProfileBody)
  if (bodyErr) return bodyErr

  const update: Record<string, unknown> = {}
  if (body.display_name !== undefined) {
    const name = sanitizeName(body.display_name)
    if (!name) return NextResponse.json({ error: 'Name is required', code: 'name_required' }, { status: 400 })
    update.display_name = name
  }
  if (body.bio !== undefined) {
    update.bio = sanitizeBio(body.bio) || null
  }
  if (body.theme !== undefined) {
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
  const upsertResult = await supabaseAdmin
    .from('user_profiles')
    .upsert({ user_id: user.id, ...update }, { onConflict: 'user_id' })
    .select('display_name, bio, avatar_url, theme, welcome_dismissed_at, setup_checklist_dismissed_at, updated_at')
    .single()

  const patchRow = upsertResult.data as ProfileRow | null
  if (upsertResult.error || !patchRow) {
    logger.error('[profile]', 'PATCH upsert failed', { error: upsertResult.error?.message })
    return NextResponse.json({ error: upsertResult.error?.message ?? 'Failed to save profile', code: 'upsert_failed' }, { status: 500 })
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
      logger.error('[profile]', 'PATCH auth metadata sync failed', { error: metaError.message })
      // Non-fatal — user_profiles is the source of truth for the profile page itself
    }
  }

  return NextResponse.json({
    profile: {
      email:                        user.email,
      display_name:                 patchRow.display_name,
      bio:                          patchRow.bio,
      avatar_url:                   patchRow.avatar_url,
      theme:                        patchRow.theme,
      welcome_dismissed_at:         patchRow.welcome_dismissed_at,
      setup_checklist_dismissed_at: patchRow.setup_checklist_dismissed_at,
    },
  })
}
