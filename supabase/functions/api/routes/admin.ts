import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.ts'
import { getAdminClient } from '../lib/supabase.ts'
import { isPlatformAdmin } from '../lib/platform-admin.ts'
import { sendSuspensionEmail } from '../lib/email.ts'
import type { AuthContext } from '../lib/types.ts'

const app = new Hono()

app.use('*', authMiddleware)

app.use('*', async (c, next) => {
  const ctx = c.get('authContext') as AuthContext
  const isAdmin = await isPlatformAdmin(ctx.user.email)
  if (!isAdmin) return c.json({ error: 'Forbidden' }, 403)
  return next()
})

// ── Candidates ─────────────────────────────────────────────────────

app.get('/candidates', async (c) => {
  const sb = getAdminClient()
  const status = c.req.query('status')

  let dbQuery = sb
    .from('profiles')
    .select('id, full_name, exam_status, exam_type_taken, exam_score, is_certified, created_at')
    .eq('user_role', 'agent_candidate')
    .order('created_at', { ascending: false })

  if (status) dbQuery = dbQuery.eq('exam_status', status)

  const { data: candidates } = await dbQuery

  const enriched = await Promise.all((candidates || []).map(async (c: Record<string, unknown>) => {
    const talentRes = await sb
      .from('talent_profiles')
      .select('id, display_code, hourly_rate, visible, role')
      .eq('user_id', c.id as string)
      .maybeSingle()

    const purchaseRes = talentRes.data?.id
      ? await sb
        .from('talent_purchases')
        .select('id, payment_status, created_at')
        .eq('talent_profile_id', talentRes.data.id as string)
        .limit(5)
      : { data: [] }

    return {
      ...c,
      talent_profile: talentRes.data || null,
      purchases: purchaseRes.data || [],
    }
  }))

  return c.json({ candidates: enriched })
})

// ── Validate candidate ─────────────────────────────────────────────

app.patch('/candidates/:id/validate', async (c) => {
  const sb = getAdminClient()
  const id = c.req.param('id')
  const body = await c.req.json<{ action: string; display_code?: string }>()

  const { data: candidate } = await sb
    .from('profiles')
    .select('id')
    .eq('id', id)
    .eq('user_role', 'agent_candidate')
    .maybeSingle()

  if (!candidate) return c.json({ error: 'Candidate not found' }, 404)

  if (body.action === 'call_validated') {
    await sb.from('profiles').update({ exam_status: 'call_validated' }).eq('id', id)
    return c.json({ success: true, message: 'Candidate validated. Training access unlocked.' })
  }

  if (body.action === 'make_visible') {
    const code = body.display_code || await generateDisplayCode(sb, id)
    await Promise.all([
      sb.from('profiles').update({ exam_status: 'certified', is_certified: true }).eq('id', id),
      sb.from('talent_profiles').update({
        visible: true,
        display_code: code,
        verified_at: new Date().toISOString(),
      }).eq('user_id', id),
    ])
    return c.json({ success: true, display_code: code, message: 'Candidate is now live in the marketplace.' })
  }

  if (body.action === 'hide') {
    await sb.from('talent_profiles').update({ visible: false }).eq('user_id', id)
    return c.json({ success: true, message: 'Candidate hidden from marketplace.' })
  }

  if (body.action === 'reject') {
    await sb.from('profiles').update({ exam_status: 'rejected' }).eq('id', id)
    return c.json({ success: true, message: 'Candidate rejected.' })
  }

  return c.json({ error: 'Invalid action' }, 400)
})

interface RoleRow { role?: string }

async function generateDisplayCode(sb: ReturnType<typeof getAdminClient>, userId: string): Promise<string> {
  const roleMap: Record<string, string> = {
    customer_service: 'CS',
    supply_chain: 'SC',
    dispute_management: 'DM',
    overall_manager: 'OM',
  }
  const { data: profile } = await sb
    .from('talent_profiles')
    .select('role')
    .eq('user_id', userId)
    .single()

  const prefix = roleMap[(profile as RoleRow | null)?.role ?? ''] || 'LQ'
  const num = String(Math.floor(Math.random() * 900) + 100)
  return `${prefix}-${num}`
}

// ── Client suspend ────────────────────────────────────────────────

app.post('/clients/:id/suspend', async (c) => {
  const sb = getAdminClient()
  const clientId = c.req.param('id')

  const body = await c.req.json<{ reason?: string }>().catch(() => ({}))
  const reason = (body as { reason?: string }).reason?.trim() || null

  const { data: client } = await sb
    .from('clients')
    .select('workspace_id, company_name')
    .eq('id', clientId)
    .single()

  if (!client?.workspace_id) return c.json({ error: 'Client not found' }, 404)

  const { error } = await sb
    .from('workspaces')
    .update({
      suspended_at: new Date().toISOString(),
      suspension_reason: reason,
    })
    .eq('id', client.workspace_id)

  if (error) return c.json({ error: 'Failed to suspend workspace' }, 500)

  const { data: workspace } = await sb
    .from('workspaces')
    .select('name')
    .eq('id', client.workspace_id)
    .single()

  const { data: ownerMember } = await sb
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', client.workspace_id)
    .eq('role', 'owner')
    .single()

  if (ownerMember?.user_id) {
    const { data: { user: ownerUser } } = await sb.auth.admin.getUserById(ownerMember.user_id)
    if (ownerUser?.email) {
      await sendSuspensionEmail({
        to: ownerUser.email,
        workspaceName: (workspace as { name?: string } | null)?.name || (client as { company_name?: string }).company_name || '',
        reason,
      })
    }
  }

  return c.json({ ok: true })
})

// ── Client unsuspend ───────────────────────────────────────────────

app.post('/clients/:id/unsuspend', async (c) => {
  const sb = getAdminClient()
  const clientId = c.req.param('id')

  const { data: client } = await sb
    .from('clients')
    .select('workspace_id')
    .eq('id', clientId)
    .single()

  if (!client?.workspace_id) return c.json({ error: 'Client not found' }, 404)

  const { error } = await sb
    .from('workspaces')
    .update({ suspended_at: null, suspension_reason: null })
    .eq('id', client.workspace_id)

  if (error) return c.json({ error: 'Failed to unsuspend workspace' }, 500)

  return c.json({ ok: true })
})

// ── Client overview ────────────────────────────────────────────────

app.get('/clients/overview', async (c) => {
  const sb = getAdminClient()

  const { data: clients, error: clientsErr } = await sb
    .from('clients')
    .select(`id, company_name, email, status, created_at, workspace_id, workspaces (suspended_at, suspension_reason)`)
    .order('created_at', { ascending: false })

  if (clientsErr) return c.json({ error: `Failed to fetch clients: ${clientsErr.message}` }, 500)
  if (!clients) return c.json({ clients: [], summary: { total: 0, overdue: 0, disconnected: 0, inactive7d: 0 } })

  const workspaceIds = clients.map((cl: Record<string, unknown>) => cl.workspace_id as string).filter(Boolean)

  const [
    { data: subscriptions },
    { data: integrations },
    { data: emailAccounts },
    { data: owners },
  ] = await Promise.all([
    sb.from('workspace_subscriptions').select('workspace_id, status, is_grandfathered, grandfather_reason, plans ( display_name )').in('workspace_id', workspaceIds),
    sb.from('integrations').select('workspace_id').in('workspace_id', workspaceIds).eq('provider', 'shopify'),
    sb.from('email_accounts').select('workspace_id, provider').in('workspace_id', workspaceIds),
    sb.from('workspace_members').select('workspace_id, user_id').in('workspace_id', workspaceIds).eq('role', 'owner'),
  ])

  const ownerUserIds = (owners ?? []).map((o: Record<string, unknown>) => o.user_id as string)
  const userLastLogins = new Map<string, string | null>()

  if (ownerUserIds.length > 0) {
    const loginPromises = (owners ?? []).map(async (owner: Record<string, unknown>) => {
      const { data: { user } } = await sb.auth.admin.getUserById(owner.user_id as string)
      userLastLogins.set(owner.workspace_id as string, user?.last_sign_in_at ?? null)
    })
    await Promise.all(loginPromises)
  }

  const subMap = new Map<string, { status: string; planName: string | null; isGrandfathered: boolean; grandfatherReason: string | null }>()
  for (const sub of (subscriptions ?? []) as Array<Record<string, unknown>>) {
    const rawPlans = sub.plans as unknown
    const plans = (Array.isArray(rawPlans) ? rawPlans[0] : rawPlans) as { display_name: string } | null
    subMap.set(sub.workspace_id as string, {
      status: sub.status as string,
      planName: plans?.display_name ?? null,
      isGrandfathered: (sub.is_grandfathered as boolean) ?? false,
      grandfatherReason: (sub.grandfather_reason as string | null) ?? null,
    })
  }

  const shopifySet = new Set<string>()
  for (const i of (integrations ?? []) as Array<Record<string, unknown>>) shopifySet.add(i.workspace_id as string)

  const gmailSet = new Set<string>()
  const outlookSet = new Set<string>()
  for (const ea of (emailAccounts ?? []) as Array<Record<string, unknown>>) {
    const wsId = ea.workspace_id as string
    if (ea.provider === 'gmail') gmailSet.add(wsId)
    if (ea.provider === 'outlook') outlookSet.add(wsId)
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  let overdue = 0, disconnected = 0, inactive7d = 0

  const items = clients.map((cl: Record<string, unknown>) => {
    const wsId = cl.workspace_id as string
    const rawWs = cl.workspaces as unknown
    const ws = (Array.isArray(rawWs) ? rawWs[0] : rawWs) as { suspended_at: string | null; suspension_reason: string | null } | null
    const sub = subMap.get(wsId)
    const hasShopify = shopifySet.has(wsId)
    const hasGmail = gmailSet.has(wsId)
    const hasOutlook = outlookSet.has(wsId)
    const lastLoginAt = userLastLogins.get(wsId) ?? null

    if (sub?.status === 'past_due') overdue++
    if (!hasShopify || !hasGmail || !hasOutlook) disconnected++
    if (!lastLoginAt || lastLoginAt < sevenDaysAgo) inactive7d++

    return {
      id: cl.id,
      companyName: cl.company_name,
      email: cl.email,
      status: cl.status,
      createdAt: cl.created_at,
      workspaceId: wsId,
      suspendedAt: ws?.suspended_at ?? null,
      suspensionReason: ws?.suspension_reason ?? null,
      billingStatus: sub?.status ?? null,
      planName: sub?.planName ?? null,
      isGrandfathered: sub?.isGrandfathered ?? false,
      grandfatherReason: sub?.grandfatherReason ?? null,
      hasShopify,
      hasGmail,
      hasOutlook,
      lastLoginAt,
    }
  })

  return c.json({
    clients: items,
    summary: { total: items.length, overdue, disconnected, inactive7d },
  })
})

// ── Create user ────────────────────────────────────────────────────

app.post('/create-user', async (c) => {
  const sb = getAdminClient()
  const ctx = c.get('authContext') as AuthContext

  const body = await c.req.json<{ name: string; email: string; password: string; role: string }>()

  const { data: authData, error: authError } = await sb.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true,
  })
  if (authError || !authData?.user) {
    return c.json({ error: authError?.message || 'Failed to create auth user' }, 400)
  }

  const newUserId = authData.user.id

  const { error: memberError } = await sb
    .from('workspace_members')
    .insert({ workspace_id: ctx.workspace.id, user_id: newUserId, role: body.role })

  if (memberError) {
    await sb.auth.admin.deleteUser(newUserId)
    return c.json({ error: memberError.message }, 500)
  }

  await sb.from('user_profiles').upsert(
    { user_id: newUserId, display_name: body.name.trim() },
    { onConflict: 'user_id' },
  )

  return c.json({ ok: true, userId: newUserId })
})

// ── Delete user ────────────────────────────────────────────────────

app.delete('/delete-user', async (c) => {
  const sb = getAdminClient()
  const ctx = c.get('authContext') as AuthContext
  const id = c.req.query('id')
  if (!id) return c.json({ error: 'Missing id query parameter' }, 400)

  await sb.from('workspace_members').delete().eq('user_id', id).eq('workspace_id', ctx.workspace.id)
  await sb.auth.admin.deleteUser(id)

  return c.json({ ok: true })
})

// ── Cron runs ──────────────────────────────────────────────────────

app.get('/cron-runs', async (c) => {
  const sb = getAdminClient()
  const jobName = c.req.query('jobName')
  const status = c.req.query('status')
  const from = c.req.query('from')
  const to = c.req.query('to')
  const limit = parseInt(c.req.query('limit') || '50', 10)

  let dbQuery = sb.from('cron_job_runs').select('*').order('started_at', { ascending: false }).limit(limit)

  if (jobName) dbQuery = dbQuery.eq('job_name', jobName)
  if (status) {
    const statuses = status.split(',').map(s => s.trim())
    dbQuery = statuses.length === 1 ? dbQuery.eq('status', statuses[0]) : dbQuery.in('status', statuses)
  }
  if (from) dbQuery = dbQuery.gte('started_at', from)
  if (to) dbQuery = dbQuery.lte('started_at', to)

  const { data, error } = await dbQuery
  if (error) return c.json({ error: error.message }, 500)

  return c.json({ runs: data ?? [] })
})

app.get('/cron-runs/latest', async (c) => {
  const sb = getAdminClient()

  const { data, error } = await sb
    .from('cron_job_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(50)

  if (error) return c.json({ error: error.message }, 500)

  const seen = new Set<string>()
  const latest = (data ?? []).filter((row: Record<string, unknown>) => {
    const name = row.job_name as string
    if (seen.has(name)) return false
    seen.add(name)
    return true
  })

  return c.json({ runs: latest })
})

// ── Finance ────────────────────────────────────────────────────────

const INFRA_COSTS = [
  { name: 'Anthropic (Claude)', cost: 0, note: 'Pay-as-you-go' },
  { name: 'Supabase Pro', cost: 25 },
  { name: 'Vercel Pro', cost: 20 },
  { name: 'Lovable', cost: 25 },
  { name: 'Whop', cost: 0, note: '3% transaction fee' },
]

app.get('/finance', async (c) => {
  const sb = getAdminClient()

  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString()
  const monthStart = now.toISOString().slice(0, 7) + '-01'
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10)

  const [todayRes, weekRes, monthRes, lastMonthRes, byRouteRes, activeSubsRes] = await Promise.all([
    sb.from('ai_usage').select('cost_usd, input_tokens, output_tokens').gte('created_at', todayStr),
    sb.from('ai_usage').select('cost_usd, input_tokens, output_tokens').gte('created_at', weekAgo),
    sb.from('ai_usage').select('cost_usd, input_tokens, output_tokens, created_at').gte('created_at', monthStart),
    sb.from('ai_usage').select('cost_usd').gte('created_at', lastMonthStart).lte('created_at', lastMonthEnd),
    sb.from('ai_usage').select('route, cost_usd, input_tokens, output_tokens').gte('created_at', monthStart),
    sb.from('workspace_subscriptions').select('plan_id, plans!inner(price_eur)').eq('status', 'active'),
  ])

  const sum = (rows: Array<Record<string, unknown>> | null | undefined, field: string) =>
    (rows || []).reduce((acc, r) => acc + ((r[field] as number) || 0), 0)

  const dailyMap: Record<string, { cost: number; calls: number }> = {}
  for (const row of (monthRes.data || []) as Array<Record<string, unknown>>) {
    const day = (row.created_at as string).slice(0, 10)
    if (!dailyMap[day]) dailyMap[day] = { cost: 0, calls: 0 }
    dailyMap[day].cost += (row.cost_usd as number) || 0
    dailyMap[day].calls += 1
  }
  const dailyBreakdown = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, cost: v.cost, calls: v.calls }))

  const routeMap: Record<string, { cost: number; calls: number; input_tokens: number; output_tokens: number }> = {}
  for (const row of (byRouteRes.data || []) as Array<Record<string, unknown>>) {
    const route = row.route as string
    if (!routeMap[route]) routeMap[route] = { cost: 0, calls: 0, input_tokens: 0, output_tokens: 0 }
    routeMap[route].cost += (row.cost_usd as number) || 0
    routeMap[route].calls += 1
    routeMap[route].input_tokens += (row.input_tokens as number) || 0
    routeMap[route].output_tokens += (row.output_tokens as number) || 0
  }

  const mrr = (activeSubsRes.data ?? []).reduce((total: number, sub: Record<string, unknown>) => {
    const plans = sub.plans as unknown as { price_eur: number | null } | Array<{ price_eur: number | null }>
    const price = Array.isArray(plans) ? (plans[0]?.price_eur ?? 0) : (plans?.price_eur ?? 0)
    return total + price
  }, 0)

  const fixedCosts = INFRA_COSTS.filter(s => s.cost > 0).reduce((acc, s) => acc + s.cost, 0)
  const aiCostMonth = sum(monthRes.data as Array<Record<string, unknown>>, 'cost_usd')
  const totalCostMonth = fixedCosts + aiCostMonth
  const netMargin = mrr - totalCostMonth

  return c.json({
    ai: {
      today: { cost: sum(todayRes.data as Array<Record<string, unknown>>, 'cost_usd'), calls: todayRes.data?.length || 0 },
      week: { cost: sum(weekRes.data as Array<Record<string, unknown>>, 'cost_usd'), calls: weekRes.data?.length || 0, input_tokens: sum(weekRes.data as Array<Record<string, unknown>>, 'input_tokens'), output_tokens: sum(weekRes.data as Array<Record<string, unknown>>, 'output_tokens') },
      month: { cost: aiCostMonth, calls: monthRes.data?.length || 0, input_tokens: sum(monthRes.data as Array<Record<string, unknown>>, 'input_tokens'), output_tokens: sum(monthRes.data as Array<Record<string, unknown>>, 'output_tokens') },
      lastMonth: { cost: sum(lastMonthRes.data as Array<Record<string, unknown>>, 'cost_usd') },
      byRoute: routeMap,
      daily: dailyBreakdown,
    },
    subscriptions: INFRA_COSTS,
    finance: { mrr, activeClients: activeSubsRes.data?.length || 0, fixedCosts, aiCostMonth, totalCostMonth, netMargin, marginPct: mrr > 0 ? Math.round((netMargin / mrr) * 100) : 0 },
  })
})

// ── Retention status ───────────────────────────────────────────────

const TRIAL_RETENTION_DAYS = 60

app.get('/retention-status', async (c) => {
  const sb = getAdminClient()

  const now = Date.now()
  const last30Iso = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()
  const cutoffIso = new Date(now - TRIAL_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const [scheduledRes, retentionRes, recentLogRes, counterRes] = await Promise.all([
    sb.from('workspaces')
      .select('id, name, scheduled_for_deletion_at, created_at, workspace_subscriptions!inner(status, trial_ends_at)')
      .not('scheduled_for_deletion_at', 'is', null)
      .order('scheduled_for_deletion_at', { ascending: true }),
    sb.from('workspaces')
      .select('id, name, created_at, workspace_subscriptions!inner(status, trial_ends_at)')
      .neq('workspace_subscriptions.status', 'active')
      .is('scheduled_for_deletion_at', null)
      .not('workspace_subscriptions.trial_ends_at', 'is', null)
      .lte('workspace_subscriptions.trial_ends_at', new Date(now).toISOString())
      .order('workspace_subscriptions.trial_ends_at', { ascending: true }),
    sb.from('workspace_deletion_log').select('*').order('created_at', { ascending: false }).limit(50),
    sb.from('workspace_deletion_log').select('event').gte('created_at', last30Iso),
  ])

  type DeletionEvent = 'scheduled' | 'deleted' | 'cancelled' | 'error'
  const counters: Record<DeletionEvent, number> = { scheduled: 0, deleted: 0, cancelled: 0, error: 0 }
  for (const row of (counterRes.data as Array<{ event: DeletionEvent }>) || []) {
    if (counters[row.event] !== undefined) counters[row.event]++
  }

  interface WorkspaceRow {
    id: string; name: string | null; scheduled_for_deletion_at?: string | null; created_at: string
    workspace_subscriptions: { status: string | null; trial_ends_at: string | null }
  }

  const scheduled = ((scheduledRes.data as unknown as WorkspaceRow[]) || []).map(ws => {
    const msUntil = ws.scheduled_for_deletion_at ? new Date(ws.scheduled_for_deletion_at).getTime() - now : 0
    return { ...ws, days_until_deletion: Math.ceil(msUntil / (24 * 60 * 60 * 1000)) }
  })

  const retention = ((retentionRes.data as unknown as WorkspaceRow[]) || []).map(ws => {
    const trialEndMs = ws.workspace_subscriptions.trial_ends_at ? new Date(ws.workspace_subscriptions.trial_ends_at).getTime() : now
    const daysPast = Math.floor((now - trialEndMs) / (24 * 60 * 60 * 1000))
    return { ...ws, days_since_trial_end: daysPast, days_until_scheduling: Math.max(0, TRIAL_RETENTION_DAYS - daysPast) }
  })

  return c.json({
    now: new Date(now).toISOString(),
    config: { trial_retention_days: TRIAL_RETENTION_DAYS, grace_days: 7, cutoff: cutoffIso },
    scheduled,
    retention,
    next_deletion: scheduled[0] ?? null,
    recent_log: recentLogRes.data || [],
    counters_30d: counters,
  })
})

// ── Team ───────────────────────────────────────────────────────────

app.get('/team', async (c) => {
  const sb = getAdminClient()
  const ctx = c.get('authContext') as AuthContext

  const { data: memberships, error: membersErr } = await sb
    .from('workspace_members')
    .select('user_id, workspace_id, role, joined_at')
    .eq('workspace_id', ctx.workspace.id)
    .order('joined_at', { ascending: true })

  if (membersErr || !memberships || memberships.length === 0) {
    return c.json([], { headers: { 'Cache-Control': 'private, no-store' } })
  }

  const userIds = Array.from(new Set(memberships.map((m: Record<string, unknown>) => m.user_id as string)))

  const [{ data: usersPayload }, { data: profiles }] = await Promise.all([
    sb.auth.admin.listUsers({ perPage: 1000 }),
    sb.from('user_profiles').select('user_id, display_name').in('user_id', userIds),
  ])

  interface AuthUserMeta { name?: string; full_name?: string }

  const userById = new Map<string, { email: string; metadata: AuthUserMeta | null }>()
  for (const u of usersPayload?.users ?? []) {
    if (userIds.includes(u.id)) {
      userById.set(u.id, { email: u.email ?? '', metadata: (u.user_metadata as AuthUserMeta | null) ?? null })
    }
  }

  const profileByUserId = new Map<string, { display_name: string | null }>()
  for (const p of (profiles as Array<{ user_id: string; display_name: string | null }>) ?? []) {
    profileByUserId.set(p.user_id, p)
  }

  const members = memberships.map((m: Record<string, unknown>) => {
    const u = userById.get(m.user_id as string)
    const p = profileByUserId.get(m.user_id as string)
    const name = p?.display_name || u?.metadata?.name || u?.metadata?.full_name || (u?.email ? u.email.split('@')[0] : 'Unknown')
    return { id: m.user_id, name, email: u?.email ?? '', role: m.role, created_at: m.joined_at }
  })

  members.sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
    ((a.created_at as string) < (b.created_at as string) ? 1 : -1))

  return c.json(members, { headers: { 'Cache-Control': 'private, no-store' } })
})

// ── Seed demo ──────────────────────────────────────────────────────

const DEMO_SHOP = 'lynq-demo-store.myshopify.com'
const DEMO_EMAIL = 'demo@lynqdemo.com'

app.post('/seed-demo', async (c) => {
  const sb = getAdminClient()
  const body = await c.req.json<{ user_id?: string; email?: string }>()

  let userId = body.user_id

  if (!userId && body.email) {
    const { data } = await sb.auth.admin.listUsers()
    const found = data?.users?.find((u: { email?: string }) => u.email === body.email)
    if (!found) return c.json({ error: `No user found with email ${body.email}` }, 404)
    userId = found.id
  }

  if (!userId) return c.json({ error: 'Missing user_id or email in body' }, 400)

  // Onboarding completion lives on the workspace (owner-gated); mark the
  // demo owner's workspace so the seeded account skips the wizard.
  const { data: ownerMembership } = await sb
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .eq('role', 'owner')
    .maybeSingle()
  if (ownerMembership) {
    await sb
      .from('workspaces')
      .update({ onboarding_completed: true })
      .eq('id', ownerMembership.workspace_id)
  }
  await sb.from('integrations').upsert({
    client_id: userId,
    shopify_domain: DEMO_SHOP,
    shopify_access_token: 'demo_token_not_real',
    shopify_scope: 'read_orders,read_customers,read_products',
    shopify_connected_at: new Date().toISOString(),
  }, { onConflict: 'client_id' })

  return c.json({ success: true, userId, email: DEMO_EMAIL, shop: DEMO_SHOP })
})

// ── Webhooks ───────────────────────────────────────────────────────

app.get('/webhooks', async (c) => {
  const sb = getAdminClient()
  const status = c.req.query('status') || 'failed,dead_letter'
  const source = c.req.query('source')
  const page = parseInt(c.req.query('page') || '1', 10)
  const limit = 25
  const offset = (page - 1) * limit

  let dbQuery = sb
    .from('webhook_events')
    .select(
      'id, event_id, source, event_type, status, error_message, attempt_count, next_retry_at, workspace_id, metadata, created_at, completed_at',
      { count: 'exact' },
    )

  const statuses = status.split(',').map(s => s.trim())
  dbQuery = statuses.length === 1 ? dbQuery.eq('status', statuses[0]) : dbQuery.in('status', statuses)
  if (source) dbQuery = dbQuery.eq('source', source)
  dbQuery = dbQuery.order('created_at', { ascending: false }).range(offset, offset + limit - 1)

  const { data, count, error } = await dbQuery
  if (error) return c.json({ error: error.message }, 500)

  return c.json({ events: data ?? [], total: count ?? 0, page, limit })
})

app.post('/webhooks/dismiss', async (c) => {
  const sb = getAdminClient()
  const body = await c.req.json<{ ids: string[] }>()

  const { error, count } = await sb
    .from('webhook_events')
    .update({ status: 'dismissed' })
    .in('id', body.ids)
    .in('status', ['dead_letter'])

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ ok: true, updated: count ?? 0 })
})

app.post('/webhooks/retry', async (c) => {
  const sb = getAdminClient()
  const body = await c.req.json<{ ids: string[] }>()

  const { error, count } = await sb
    .from('webhook_events')
    .update({ status: 'failed', attempt_count: 0, next_retry_at: new Date().toISOString() })
    .in('id', body.ids)
    .in('status', ['dead_letter'])

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ ok: true, updated: count ?? 0 })
})

// ── Impersonate ────────────────────────────────────────────────────

app.post('/impersonate', async (c) => {
  const sb = getAdminClient()
  const ctx = c.get('authContext') as AuthContext
  const body = await c.req.json<{ workspaceId: string }>()

  const { data: workspace } = await sb
    .from('workspaces')
    .select('id')
    .eq('id', body.workspaceId)
    .maybeSingle()

  if (!workspace) return c.json({ error: 'Workspace not found' }, 404)

  await sb
    .from('impersonation_sessions')
    .update({ ended_at: new Date().toISOString() })
    .eq('admin_user_id', ctx.user.id)
    .is('ended_at', null)

  const { data: sessionRaw, error } = await sb
    .from('impersonation_sessions')
    .insert({ admin_user_id: ctx.user.id, target_workspace_id: body.workspaceId })
    .select('id')
    .single()

  const session = sessionRaw as unknown as { id: string } | null
  if (error || !session) return c.json({ error: 'Failed to start impersonation' }, 500)

  const res = c.json({ sessionId: session.id })
  res.headers.append('Set-Cookie',
    `x-impersonate-session=${session.id}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`)
  return res
})

app.delete('/impersonate', async (c) => {
  const sb = getAdminClient()
  const ctx = c.get('authContext') as AuthContext
  const cookieHeader = c.req.header('cookie') || ''
  const match = cookieHeader.match(/x-impersonate-session=([^;]+)/)
  const sessionId = match?.[1]

  if (!sessionId) return c.json({ error: 'No active impersonation session' }, 404)

  await sb
    .from('impersonation_sessions')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('admin_user_id', ctx.user.id)
    .is('ended_at', null)

  const res = c.json({ redirect: '/admin/clients' })
  res.headers.append('Set-Cookie',
    'x-impersonate-session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0')
  return res
})

// ── Migrate users ──────────────────────────────────────────────────

app.post('/migrate-users', async (c) => {
  const sb = getAdminClient()
  const body = await c.req.json<{ users: Array<{ id?: string; email: string; password: string }> }>()

  const results = []
  for (const u of body.users) {
    const { data, error } = await sb.auth.admin.createUser({
      user_metadata: {},
      email: u.email,
      password: u.password,
      email_confirm: true,
      ...(u.id ? { id: u.id } : {}),
    })

    results.push({
      email: u.email,
      id: data?.user?.id ?? null,
      error: error?.message ?? null,
    })
  }

  return c.json({ results })
})

export { app as adminRoutes }
