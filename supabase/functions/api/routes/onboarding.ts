import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.ts'
import { getAdminClient } from '../lib/supabase.ts'
import { isPlatformAdmin, isPlatformAdminOrTester } from '../lib/platform-admin.ts'
import type { AuthContext } from '../lib/types.ts'

interface ProfileRow { display_name?: string; welcome_dismissed_at?: string | null; setup_checklist_dismissed_at?: string | null }
interface WorkspaceRow { id: string; name?: string }
interface SubscriptionRow { status?: string; trial_ends_at?: string }
interface EmailRow { status?: string }
interface IntegrationRow { shopify_domain?: string; status?: string }

const app = new Hono()

app.use('*', authMiddleware)

app.get('/status', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const sb = getAdminClient()

  const [
    workspaceRes,
    profileRes,
    macrosRes,
    emailRes,
    integrationRes,
    membersRes,
    subscriptionRes,
  ] = await Promise.all([
    sb.from('workspaces').select('id, name').eq('id', ctx.workspaceId).maybeSingle(),
    sb.from('user_profiles').select('display_name, welcome_dismissed_at, setup_checklist_dismissed_at').eq('user_id', ctx.user.id).maybeSingle(),
    sb.from('macros').select('id', { count: 'exact', head: true }).eq('workspace_id', ctx.workspaceId).is('archived_at', null),
    sb.from('email_accounts').select('status').eq('workspace_id', ctx.workspaceId).maybeSingle(),
    sb.from('integrations').select('shopify_domain, status').eq('workspace_id', ctx.workspaceId).maybeSingle(),
    sb.from('workspace_members').select('id', { count: 'exact', head: true }).eq('workspace_id', ctx.workspaceId),
    sb.from('workspace_subscriptions').select('status, trial_ends_at').eq('workspace_id', ctx.workspaceId).maybeSingle(),
  ])

  const profileData = profileRes.data as unknown as ProfileRow | null
  const wsData = workspaceRes.data as unknown as WorkspaceRow | null
  const subData = subscriptionRes.data as unknown as SubscriptionRow | null
  const emailData = emailRes.data as unknown as EmailRow | null
  const integrationData = integrationRes.data as unknown as IntegrationRow | null

  const fullName =
    profileData?.display_name ||
    (ctx.user.user_metadata as Record<string, string> | undefined)?.name ||
    ctx.user.email?.split('@')[0] ||
    ''
  const firstName = String(fullName).split(/\s+/)[0]

  return c.json({
    macros_count: macrosRes.count ?? 0,
    email_connected: emailData?.status === 'connected',
    shopify_connected: integrationData?.status === 'connected' && !!integrationData?.shopify_domain,
    team_member_count: membersRes.count ?? 0,
    subscription_status: subData?.status ?? null,
    trial_ends_at: subData?.trial_ends_at ?? null,
    workspace_name: wsData?.name ?? null,
    is_payment_exempt: await isPlatformAdminOrTester(ctx.user.email ?? ''),
    is_platform_admin: await isPlatformAdmin(ctx.user.email ?? ''),
    user: {
      first_name: firstName,
      welcome_dismissed_at: profileData?.welcome_dismissed_at ?? null,
      setup_checklist_dismissed_at: profileData?.setup_checklist_dismissed_at ?? null,
    },
  })
})

export { app as onboardingRoutes }
