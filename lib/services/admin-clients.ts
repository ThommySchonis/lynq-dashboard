import { supabaseAdmin } from '@/lib/supabaseAdmin'
import type { ClientOverviewItem, ClientOverviewResponse } from '@/types/admin-client-overview'
import type { SubscriptionStatus } from '@/types/billing'

export async function getClientOverview(): Promise<ClientOverviewResponse> {
  // 1. Fetch all clients with workspace + subscription + plan data
  const { data: clients, error: clientsErr } = await supabaseAdmin
    .from('clients')
    .select(`
      id,
      company_name,
      email,
      status,
      created_at,
      workspace_id,
      workspaces (
        suspended_at,
        suspension_reason
      )
    `)
    .order('created_at', { ascending: false })

  if (clientsErr) throw new Error(`Failed to fetch clients: ${clientsErr.message}`)
  if (!clients) return { clients: [], summary: { total: 0, overdue: 0, disconnected: 0, inactive7d: 0 } }

  // Collect workspace IDs for parallel lookups
  const workspaceIds = clients
    .map((c) => c.workspace_id as string)
    .filter(Boolean)

  // 2-5. Fetch subscriptions, integrations, email accounts, and owners in parallel
  const [
    { data: subscriptions },
    { data: integrations },
    { data: emailAccounts },
    { data: owners },
  ] = await Promise.all([
    supabaseAdmin
      .from('workspace_subscriptions')
      .select('workspace_id, status, plans ( display_name )')
      .in('workspace_id', workspaceIds),
    supabaseAdmin
      .from('integrations')
      .select('workspace_id')
      .in('workspace_id', workspaceIds)
      .eq('provider', 'shopify'),
    supabaseAdmin
      .from('email_accounts')
      .select('workspace_id, provider')
      .in('workspace_id', workspaceIds),
    supabaseAdmin
      .from('workspace_members')
      .select('workspace_id, user_id')
      .in('workspace_id', workspaceIds)
      .eq('role', 'owner'),
  ])

  // Fetch auth.users for owner last_sign_in_at
  const ownerUserIds = (owners ?? []).map((o) => o.user_id as string)
  const userLastLogins = new Map<string, string | null>()

  if (ownerUserIds.length > 0) {
    // Supabase admin API: list users doesn't support filtering by IDs,
    // so fetch individually (client count is small, ~tens)
    const loginPromises = (owners ?? []).map(async (owner) => {
      const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(owner.user_id as string)
      userLastLogins.set(
        owner.workspace_id as string,
        user?.last_sign_in_at ?? null
      )
    })
    await Promise.all(loginPromises)
  }

  // Build lookup maps
  const subMap = new Map<string, { status: SubscriptionStatus; planName: string | null }>()
  for (const sub of subscriptions ?? []) {
    const plans = sub.plans as { display_name: string } | null
    subMap.set(sub.workspace_id as string, {
      status: sub.status as SubscriptionStatus,
      planName: plans?.display_name ?? null,
    })
  }

  const shopifySet = new Set<string>()
  for (const i of integrations ?? []) {
    shopifySet.add(i.workspace_id as string)
  }

  const gmailSet = new Set<string>()
  const outlookSet = new Set<string>()
  for (const ea of emailAccounts ?? []) {
    const wsId = ea.workspace_id as string
    if (ea.provider === 'gmail') gmailSet.add(wsId)
    if (ea.provider === 'outlook') outlookSet.add(wsId)
  }

  // Assemble response
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  let overdue = 0
  let disconnected = 0
  let inactive7d = 0

  const items: ClientOverviewItem[] = clients.map((c) => {
    const wsId = c.workspace_id as string
    const ws = c.workspaces as { suspended_at: string | null; suspension_reason: string | null } | null
    const sub = subMap.get(wsId)
    const hasShopify = shopifySet.has(wsId)
    const hasGmail = gmailSet.has(wsId)
    const hasOutlook = outlookSet.has(wsId)
    const lastLoginAt = userLastLogins.get(wsId) ?? null

    // Count summary metrics
    if (sub?.status === 'past_due') overdue++
    if (!hasShopify || !hasGmail || !hasOutlook) disconnected++
    if (!lastLoginAt || lastLoginAt < sevenDaysAgo) inactive7d++

    return {
      id: c.id as string,
      companyName: c.company_name as string,
      email: c.email as string,
      status: c.status as 'active' | 'inactive',
      createdAt: c.created_at as string,
      workspaceId: wsId,
      suspendedAt: ws?.suspended_at ?? null,
      suspensionReason: ws?.suspension_reason ?? null,
      billingStatus: sub?.status ?? null,
      planName: sub?.planName ?? null,
      hasShopify,
      hasGmail,
      hasOutlook,
      lastLoginAt,
    }
  })

  return {
    clients: items,
    summary: {
      total: items.length,
      overdue,
      disconnected,
      inactive7d,
    },
  }
}
