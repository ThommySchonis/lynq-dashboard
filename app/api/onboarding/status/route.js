import { NextResponse } from 'next/server'
import { getAuthContext } from '../../../../lib/auth'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

// GET /api/onboarding/status
//
// Single endpoint feeding the welcome banner + setup checklist on
// /home and the sidebar widget. Returns:
//   - 4 spec counts (macros, email, shopify, team)
//   - workspace meta (subscription_status, name) — gating for trial-only UI
//   - user meta (first_name, dismissals) — used by banner + widget
//
// Workspace-scoped via getAuthContext. RLS bypassed since we go via
// supabaseAdmin (service role).
export async function GET(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [
    workspaceRes,
    profileRes,
    macrosRes,
    emailRes,
    integrationRes,
    membersRes,
  ] = await Promise.all([
    supabaseAdmin
      .from('workspaces')
      .select('id, name, subscription_status, trial_ends_at')
      .eq('id', ctx.workspaceId)
      .maybeSingle(),
    supabaseAdmin
      .from('user_profiles')
      .select('display_name, welcome_dismissed_at, setup_checklist_dismissed_at')
      .eq('user_id', ctx.user.id)
      .maybeSingle(),
    supabaseAdmin
      .from('macros')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', ctx.workspaceId)
      .is('archived_at', null),
    supabaseAdmin
      .from('email_accounts')
      .select('status')
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle(),
    supabaseAdmin
      .from('integrations')
      .select('shopify_domain, status')
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle(),
    supabaseAdmin
      .from('workspace_members')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', ctx.workspaceId),
  ])

  const fullName =
    profileRes.data?.display_name ||
    ctx.user.user_metadata?.name ||
    ctx.user.email?.split('@')[0] ||
    ''
  const firstName = fullName.split(/\s+/)[0]

  return NextResponse.json({
    // Spec-required counts/flags. status === 'connected' is the new
    // truth signal — pending intents (typed shop URL / picked Gmail
    // but no OAuth yet) blijven 'pending' en tellen niet als done.
    macros_count:      macrosRes.count ?? 0,
    email_connected:   emailRes.data?.status === 'connected',
    shopify_connected: integrationRes.data?.status === 'connected'
                       && !!integrationRes.data?.shopify_domain,
    team_member_count: membersRes.count ?? 0,

    // Meta for trial-only gating + UI copy
    subscription_status: workspaceRes.data?.subscription_status ?? null,
    trial_ends_at:       workspaceRes.data?.trial_ends_at ?? null,
    workspace_name:      workspaceRes.data?.name ?? null,
    user: {
      first_name:                   firstName,
      welcome_dismissed_at:         profileRes.data?.welcome_dismissed_at ?? null,
      setup_checklist_dismissed_at: profileRes.data?.setup_checklist_dismissed_at ?? null,
    },
  })
}
