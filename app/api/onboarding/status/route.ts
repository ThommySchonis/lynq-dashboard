import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

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
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [
    workspaceRes,
    profileRes,
    macrosRes,
    emailRes,
    integrationRes,
    membersRes,
    subscriptionRes,
  ] = await Promise.all([
    supabaseAdmin
      .from('workspaces')
      .select('id, name')
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
    supabaseAdmin
      .from('workspace_subscriptions')
      .select('status, trial_ends_at')
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle(),
  ])

  interface ProfileRow { display_name?: string; welcome_dismissed_at?: string | null; setup_checklist_dismissed_at?: string | null }
  interface WorkspaceRow { id: string; name?: string }
  interface SubscriptionRow { status?: string; trial_ends_at?: string }
  interface EmailRow { status?: string }
  interface IntegrationRow { shopify_domain?: string; status?: string }

  const profileData = profileRes.data as ProfileRow | null
  const wsData = workspaceRes.data as WorkspaceRow | null
  const subData = subscriptionRes.data as SubscriptionRow | null
  const emailData = emailRes.data as EmailRow | null
  const integrationData = integrationRes.data as IntegrationRow | null

  const fullName =
    profileData?.display_name ||
    (ctx.user.user_metadata as Record<string, unknown> | undefined)?.name as string ||
    ctx.user.email?.split('@')[0] ||
    ''
  const firstName = String(fullName).split(/\s+/)[0]

  return NextResponse.json({
    // Spec-required counts/flags. status === 'connected' is the new
    // truth signal — pending intents (typed shop URL / picked Gmail
    // but no OAuth yet) blijven 'pending' en tellen niet als done.
    macros_count:      macrosRes.count ?? 0,
    email_connected:   emailData?.status === 'connected',
    shopify_connected: integrationData?.status === 'connected'
                       && !!integrationData?.shopify_domain,
    team_member_count: membersRes.count ?? 0,

    // Meta for trial-only gating + UI copy
    subscription_status: subData?.status ?? null,
    trial_ends_at:       subData?.trial_ends_at ?? null,
    workspace_name:      wsData?.name ?? null,
    user: {
      first_name:                   firstName,
      welcome_dismissed_at:         profileData?.welcome_dismissed_at ?? null,
      setup_checklist_dismissed_at: profileData?.setup_checklist_dismissed_at ?? null,
    },
  })
}
