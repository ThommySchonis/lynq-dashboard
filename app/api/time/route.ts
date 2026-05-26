import type { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthContext, requireWriteAccess } from '@/lib/auth'
import { getEnrichedMembers } from '@/lib/services/workspace-members'
import { NextResponse } from 'next/server'
import { validateBody, validateQuery } from '@/lib/validation'
import { getTimeQuery, timeActionBody } from '@/lib/schemas/time'
import { logger } from '@/lib/logger'

interface SessionEditRow {
  session_id: string
  edited_at: string
  edited_by_user_id: string
}

interface ActiveSessionRow {
  agent_id: string
  clocked_in_at: string
  status: string
}

interface TodaySessionRow {
  clocked_in_at: string
  clocked_out_at: string
  paused_seconds: number
}

interface PausedSessionRow {
  paused_at: string | null
  paused_seconds: number
}

interface HeartbeatSessionRow {
  active_seconds: number
  status: string
}

const ADMIN_EMAIL = 'info@lynqagency.com'

interface TimeSession {
  agent_id: string
  clocked_in_at: string
  clocked_out_at: string | null
  active_seconds?: number
  paused_seconds?: number
  paused_at?: string | null
  status?: string
  [key: string]: unknown
}

function getDateRange(filter: string, customFrom: string | null, customTo: string | null): { from: Date; to: Date } {
  const now = new Date()
  let from: Date
  let to = new Date(now)
  to.setHours(23, 59, 59, 999)

  if (filter === 'today') {
    from = new Date(now)
    from.setHours(0, 0, 0, 0)
  } else if (filter === 'week') {
    from = new Date(now)
    from.setDate(now.getDate() - 6)
    from.setHours(0, 0, 0, 0)
  } else if (filter === 'month') {
    from = new Date(now.getFullYear(), now.getMonth(), 1)
  } else if (filter === 'custom' && customFrom && customTo) {
    from = new Date(customFrom)
    to = new Date(customTo)
    to.setHours(23, 59, 59, 999)
  } else {
    from = new Date(now)
    from.setDate(now.getDate() - 6)
    from.setHours(0, 0, 0, 0)
  }
  return { from, to }
}

// Active seconds for a completed session (total - paused)
function workedSec(s: TimeSession): number {
  if (!s.clocked_out_at) return (s.active_seconds || 0)
  const total = Math.round((new Date(s.clocked_out_at).getTime() - new Date(s.clocked_in_at).getTime()) / 1000)
  return Math.max(0, total - (s.paused_seconds || 0))
}

// Fetch the most-recent edit per session_id for an admin view. Returns
// a map { sessionId → { edited_at, edited_by_user_id } } so the client
// can show "edited by Member-Name at date" without a per-row fetch.
async function fetchLatestEditMap(sessionIds: string[]): Promise<Map<string, { edited_at: string; edited_by_user_id: string }>> {
  if (sessionIds.length === 0) return new Map()
  const { data: rows, error } = await supabaseAdmin
    .from('time_session_edits')
    .select('session_id, edited_at, edited_by_user_id')
    .in('session_id', sessionIds)
    .order('edited_at', { ascending: false })
  if (error) {
    logger.error('[time]', 'fetchLatestEditMap failed', { error: error.message })
    return new Map()
  }
  const latest = new Map<string, { edited_at: string; edited_by_user_id: string }>()
  for (const r of (rows ?? []) as SessionEditRow[]) {
    if (!latest.has(r.session_id)) {
      latest.set(r.session_id, { edited_at: r.edited_at, edited_by_user_id: r.edited_by_user_id })
    }
  }
  return latest
}

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [query, queryErr] = validateQuery(request, getTimeQuery)
  if (queryErr) return queryErr

  const filter     = query.filter || 'week'
  const customFrom = query.date_from || null
  const customTo   = query.date_to || null
  const { from, to } = getDateRange(filter, customFrom, customTo)

  const isLynqAdmin       = ctx.user.email === ADMIN_EMAIL
  const isWorkspaceAdmin  = ['owner', 'admin'].includes(ctx.role)

  // ── Workspace admin view (owner/admin sees their workspace's team) ──────────
  // Replaces the legacy "client admin" branch which looked up the clients
  // table by email. clients table is empty post-migration; role-based check
  // is the new equivalent.
  if (!isLynqAdmin && isWorkspaceAdmin) {
    // Workspace owner/admin — show all members of this workspace.
    // Source of truth: workspace_members joined with auth.users + user_profiles
    // via the shared service. member.id = workspace_members.user_id = auth.users.id.
    const members = await getEnrichedMembers({ workspaceId: ctx.workspaceId })

    const memberIds = members.map(m => m.id)
    const idFilter = memberIds.length > 0 ? memberIds : ['00000000-0000-0000-0000-000000000000']

    const sessionsRes = await supabaseAdmin
      .from('time_sessions')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .in('agent_id', idFilter)
      .gte('clocked_in_at', from.toISOString())
      .lte('clocked_in_at', to.toISOString())
      .order('clocked_in_at', { ascending: false })

    const activeSessionsRes = await supabaseAdmin
      .from('time_sessions')
      .select('agent_id, clocked_in_at, status')
      .eq('workspace_id', ctx.workspaceId)
      .in('agent_id', idFilter)
      .is('clocked_out_at', null)

    const sessions = (sessionsRes.data || []) as (TimeSession & { id: string })[]
    const activeSessions = (activeSessionsRes.data || []) as ActiveSessionRow[]

    const memberMap: Record<string, Record<string, unknown>> = {}
    ;(members || []).forEach(m => {
      memberMap[m.id] = { ...m, worked_seconds: 0, paused_seconds: 0, sessions_count: 0, is_active: false, is_paused: false }
    })
    activeSessions.forEach(s => {
      if (memberMap[s.agent_id]) {
        memberMap[s.agent_id].is_active = true
        memberMap[s.agent_id].is_paused = s.status === 'paused'
      }
    })
    sessions.forEach(s => {
      if (memberMap[s.agent_id]) {
        memberMap[s.agent_id].worked_seconds  = (memberMap[s.agent_id].worked_seconds as number) + workedSec(s)
        memberMap[s.agent_id].paused_seconds  = (memberMap[s.agent_id].paused_seconds as number) + (s.paused_seconds || 0)
        memberMap[s.agent_id].sessions_count  = (memberMap[s.agent_id].sessions_count as number) + 1
      }
    })

    const sessionIds = sessions.map(s => s.id)
    const latestEdits = await fetchLatestEditMap(sessionIds)

    return NextResponse.json({
      sessions: sessions.map(s => {
        const edit = latestEdits.get(s.id)
        return {
          ...s,
          member_name:  (memberMap[s.agent_id]?.name as string)  || 'Unknown',
          member_email: (memberMap[s.agent_id]?.email as string) || '',
          last_edit_at:    edit?.edited_at ?? null,
          last_edit_by:    edit?.edited_by_user_id ?? null,
        }
      }),
      members:      Object.values(memberMap),
      active_count: activeSessions.filter(s => s.status !== 'paused').length,
      paused_count: activeSessions.filter(s => s.status === 'paused').length,
      workspace:    ctx.workspace,
      from: from.toISOString(),
      to:   to.toISOString(),
      is_client_admin: true,
    })
  }

  // ── Lynq admin view (cross-workspace global) ──────────────────────────────
  if (isLynqAdmin) {
    // Cross-workspace: every workspace_member across the project, enriched
    // with email + display_name. id = workspace_members.user_id = auth.users.id.
    const members = await getEnrichedMembers({})

    const sessionsRes2 = await supabaseAdmin
      .from('time_sessions')
      .select('*')
      .gte('clocked_in_at', from.toISOString())
      .lte('clocked_in_at', to.toISOString())
      .order('clocked_in_at', { ascending: false })

    const activeSessionsRes2 = await supabaseAdmin
      .from('time_sessions')
      .select('agent_id, clocked_in_at, status')
      .is('clocked_out_at', null)

    const sessions = (sessionsRes2.data || []) as (TimeSession & { id: string })[]
    const activeSessions = (activeSessionsRes2.data || []) as ActiveSessionRow[]

    const memberMap: Record<string, Record<string, unknown>> = {}
    members.forEach(m => {
      memberMap[m.id] = { ...m, worked_seconds: 0, paused_seconds: 0, sessions_count: 0, is_active: false, is_paused: false }
    })
    activeSessions.forEach(s => {
      if (memberMap[s.agent_id]) {
        memberMap[s.agent_id].is_active = true
        memberMap[s.agent_id].is_paused = s.status === 'paused'
      }
    })
    sessions.forEach(s => {
      if (memberMap[s.agent_id]) {
        memberMap[s.agent_id].worked_seconds  = (memberMap[s.agent_id].worked_seconds as number) + workedSec(s)
        memberMap[s.agent_id].paused_seconds  = (memberMap[s.agent_id].paused_seconds as number) + (s.paused_seconds || 0)
        memberMap[s.agent_id].sessions_count  = (memberMap[s.agent_id].sessions_count as number) + 1
      }
    })

    const sessionIds = sessions.map(s => s.id)
    const latestEdits = await fetchLatestEditMap(sessionIds)

    const sessionsWithNames = sessions.map(s => {
      const edit = latestEdits.get(s.id)
      return {
        ...s,
        member_name:  (memberMap[s.agent_id]?.name as string)  || 'Unknown',
        member_email: (memberMap[s.agent_id]?.email as string) || '',
        last_edit_at:    edit?.edited_at ?? null,
        last_edit_by:    edit?.edited_by_user_id ?? null,
      }
    })

    return NextResponse.json({
      sessions: sessionsWithNames,
      members:  Object.values(memberMap),
      active_count: activeSessions.filter(s => s.status !== 'paused').length,
      paused_count: activeSessions.filter(s => s.status === 'paused').length,
      from: from.toISOString(),
      to:   to.toISOString(),
      is_admin: true,
    })
  }

  // ── Employee view (workspace member of this workspace) ────────────────────
  // getAuthContext already proves workspace_members membership; ctx.role and
  // ctx.workspaceId both come from the same row. No second lookup needed.
  // agent_id semantics: time_sessions.agent_id = auth.users.id = ctx.user.id.
  const agentId = ctx.user.id

  const empSessionsRes = await supabaseAdmin
    .from('time_sessions')
    .select('*')
    .eq('workspace_id', ctx.workspaceId)
    .eq('agent_id', agentId)
    .gte('clocked_in_at', from.toISOString())
    .lte('clocked_in_at', to.toISOString())
    .order('clocked_in_at', { ascending: false })

  const empSessions = (empSessionsRes.data || []) as (TimeSession & { id: string })[]

  const activeRes = await supabaseAdmin
    .from('time_sessions')
    .select('*')
    .eq('workspace_id', ctx.workspaceId)
    .eq('agent_id', agentId)
    .is('clocked_out_at', null)
    .order('clocked_in_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const active = activeRes.data as (TimeSession & { id: string }) | null

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todaySessionsRes = await supabaseAdmin
    .from('time_sessions')
    .select('clocked_in_at, clocked_out_at, paused_seconds')
    .eq('workspace_id', ctx.workspaceId)
    .eq('agent_id', agentId)
    .gte('clocked_in_at', todayStart.toISOString())
    .not('clocked_out_at', 'is', null)

  const todaySessions = (todaySessionsRes.data || []) as TodaySessionRow[]

  const todayWorked = todaySessions.reduce((sum, s) => {
    const total = Math.round((new Date(s.clocked_out_at).getTime() - new Date(s.clocked_in_at).getTime()) / 1000)
    return sum + Math.max(0, total - (s.paused_seconds || 0))
  }, 0)

  return NextResponse.json({
    sessions:       empSessions,
    member:         { id: agentId, role: ctx.role },
    active_session: active || null,
    today_seconds:  todayWorked,
    from: from.toISOString(),
    to:   to.toISOString(),
    is_admin: false,
  })
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const blocked = requireWriteAccess(ctx)
  if (blocked) return blocked

  const [body, bodyErr] = await validateBody(request, timeActionBody)
  if (bodyErr) return bodyErr

  const { action } = body

  // No separate team_members lookup — getAuthContext already proves the
  // requester is a workspace_member of ctx.workspaceId. We use ctx.user.id
  // as the agent_id (matches time_sessions.agent_id semantics).
  const agentId = ctx.user.id

  // ── CLOCK IN ──────────────────────────────────────────────────────────────
  if (action === 'clock-in') {
    const { data: existing } = await supabaseAdmin
      .from('time_sessions')
      .select('id, clocked_in_at, status, paused_seconds, paused_at')
      .eq('workspace_id', ctx.workspaceId)
      .eq('agent_id', agentId)
      .is('clocked_out_at', null)
      .maybeSingle()

    if (existing) return NextResponse.json({ session: existing as Record<string, unknown>, already_active: true })

    // client_id was the team_members.client_id pass-through (legacy). Now
    // null — workspace_id is the source of truth for tenant scoping.
    const clockInResult = await supabaseAdmin
      .from('time_sessions')
      .insert({
        agent_id:       agentId,
        client_id:      null,
        workspace_id:   ctx.workspaceId,
        status:         'active',
        active_seconds: 0,
        idle_seconds:   0,
        paused_seconds: 0,
      })
      .select()
      .single()

    if (clockInResult.error) return NextResponse.json({ error: clockInResult.error.message }, { status: 500 })
    return NextResponse.json({ session: clockInResult.data as Record<string, unknown> })
  }

  // ── PAUSE ─────────────────────────────────────────────────────────────────
  if (action === 'pause') {
    const { session_id } = body
    if (!session_id) return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('time_sessions')
      .update({ status: 'paused', paused_at: new Date().toISOString() })
      .eq('id', session_id)
      .eq('workspace_id', ctx.workspaceId)
      .eq("agent_id", agentId)
      .is('clocked_out_at', null)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // ── RESUME ────────────────────────────────────────────────────────────────
  if (action === 'resume') {
    const { session_id } = body
    if (!session_id) return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })

    const resumeRes = await supabaseAdmin
      .from('time_sessions')
      .select('paused_at, paused_seconds')
      .eq('id', session_id)
      .eq('workspace_id', ctx.workspaceId)
      .eq("agent_id", agentId)
      .is('clocked_out_at', null)
      .maybeSingle()

    const current = resumeRes.data as PausedSessionRow | null
    if (!current) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    const added = current.paused_at
      ? Math.round((Date.now() - new Date(current.paused_at).getTime()) / 1000)
      : 0
    const newPaused = (current.paused_seconds || 0) + added

    const { error } = await supabaseAdmin
      .from('time_sessions')
      .update({ status: 'active', paused_at: null, paused_seconds: newPaused })
      .eq('id', session_id)
      .eq('workspace_id', ctx.workspaceId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, paused_seconds: newPaused })
  }

  // ── CLOCK OUT ─────────────────────────────────────────────────────────────
  if (action === 'clock-out') {
    const { session_id, report } = body
    if (!session_id) return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })

    // Structured EOD report is required for new clock-outs. The old free-text
    // eod_report column stays NULL for new sessions; legacy sessions retain
    // whatever was written before this migration.
    if (!report || typeof report !== 'object') {
      return NextResponse.json({ error: 'Missing end-of-day report' }, { status: 400 })
    }
    const emailsAnswered = Number(report.emails_answered)
    if (!Number.isInteger(emailsAnswered) || emailsAnswered < 0) {
      return NextResponse.json({ error: 'emails_answered must be a non-negative integer' }, { status: 400 })
    }
    const whatWentWell  = typeof report.what_went_well  === 'string' ? report.what_went_well.trim()  : ''
    const needsAttention = typeof report.needs_attention === 'string' ? report.needs_attention.trim() : ''
    if (!whatWentWell)   return NextResponse.json({ error: 'what_went_well is required' },   { status: 400 })
    if (!needsAttention) return NextResponse.json({ error: 'needs_attention is required' }, { status: 400 })

    // Finalise any ongoing pause before closing
    const clockOutLookup = await supabaseAdmin
      .from('time_sessions')
      .select('paused_at, paused_seconds')
      .eq('id', session_id)
      .eq('workspace_id', ctx.workspaceId)
      .eq("agent_id", agentId)
      .is('clocked_out_at', null)
      .maybeSingle()

    const currentSession = clockOutLookup.data as PausedSessionRow | null
    if (!currentSession) return NextResponse.json({ error: 'Session not found or already closed' }, { status: 404 })

    const extraPaused = currentSession.paused_at
      ? Math.round((Date.now() - new Date(currentSession.paused_at).getTime()) / 1000)
      : 0
    const finalPaused = (currentSession.paused_seconds || 0) + extraPaused

    const clockOutResult = await supabaseAdmin
      .from('time_sessions')
      .update({
        clocked_out_at:  new Date().toISOString(),
        status:          'completed',
        paused_at:       null,
        paused_seconds:  finalPaused,
        // Legacy free-text column: NULL for new sessions.
        eod_report:      null,
        emails_answered: emailsAnswered,
        what_went_well:  whatWentWell,
        needs_attention: needsAttention,
      })
      .eq('id', session_id)
      .eq('workspace_id', ctx.workspaceId)
      .eq("agent_id", agentId)
      .is('clocked_out_at', null)
      .select()
      .single()

    if (clockOutResult.error) return NextResponse.json({ error: clockOutResult.error.message }, { status: 500 })
    return NextResponse.json({ session: clockOutResult.data as Record<string, unknown> })
  }

  // ── HEARTBEAT ─────────────────────────────────────────────────────────────
  if (action === 'heartbeat') {
    const { session_id } = body
    if (!session_id) return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })

    const heartbeatRes = await supabaseAdmin
      .from('time_sessions')
      .select('active_seconds, status')
      .eq('id', session_id)
      .eq('workspace_id', ctx.workspaceId)
      .eq("agent_id", agentId)
      .is('clocked_out_at', null)
      .maybeSingle()

    const heartbeatSession = heartbeatRes.data as HeartbeatSessionRow | null
    if (!heartbeatSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    // Only accumulate active_seconds when not paused
    if (heartbeatSession.status !== 'paused') {
      const { error } = await supabaseAdmin
        .from('time_sessions')
        .update({ active_seconds: (heartbeatSession.active_seconds || 0) + 30 })
        .eq('id', session_id)
        .eq('workspace_id', ctx.workspaceId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
