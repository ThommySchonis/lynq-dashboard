import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { getAuthContext } from '../../../lib/auth'
import { NextResponse } from 'next/server'

const ADMIN_EMAIL = 'info@lynqagency.com'

function getDateRange(filter, customFrom, customTo) {
  const now = new Date()
  let from, to
  to = new Date(now)
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
function workedSec(s) {
  if (!s.clocked_out_at) return (s.active_seconds || 0)
  const total = Math.round((new Date(s.clocked_out_at) - new Date(s.clocked_in_at)) / 1000)
  return Math.max(0, total - (s.paused_seconds || 0))
}

export async function GET(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const filter     = searchParams.get('filter') || 'week'
  const customFrom = searchParams.get('from')
  const customTo   = searchParams.get('to')
  const { from, to } = getDateRange(filter, customFrom, customTo)

  const isLynqAdmin       = ctx.user.email === ADMIN_EMAIL
  const isWorkspaceAdmin  = ['owner', 'admin'].includes(ctx.role)

  // ── Workspace admin view (owner/admin sees their workspace's team) ──────────
  // Replaces the legacy "client admin" branch which looked up the clients
  // table by email. clients table is empty post-migration; role-based check
  // is the new equivalent.
  if (!isLynqAdmin && isWorkspaceAdmin) {
    const { data: members } = await supabaseAdmin
      .from('team_members')
      .select('id, name, email, role')
      .eq('workspace_id', ctx.workspaceId)
      .order('created_at')

    const memberIds = (members || []).map(m => m.id)
    const idFilter = memberIds.length > 0 ? memberIds : ['00000000-0000-0000-0000-000000000000']

    const { data: sessions } = await supabaseAdmin
      .from('time_sessions')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .in('agent_id', idFilter)
      .gte('clocked_in_at', from.toISOString())
      .lte('clocked_in_at', to.toISOString())
      .order('clocked_in_at', { ascending: false })

    const { data: activeSessions } = await supabaseAdmin
      .from('time_sessions')
      .select('agent_id, clocked_in_at, status')
      .eq('workspace_id', ctx.workspaceId)
      .in('agent_id', idFilter)
      .is('clocked_out_at', null)

    const memberMap = {}
    ;(members || []).forEach(m => {
      memberMap[m.id] = { ...m, worked_seconds: 0, paused_seconds: 0, sessions_count: 0, is_active: false, is_paused: false }
    })
    ;(activeSessions || []).forEach(s => {
      if (memberMap[s.agent_id]) {
        memberMap[s.agent_id].is_active = true
        memberMap[s.agent_id].is_paused = s.status === 'paused'
      }
    })
    ;(sessions || []).forEach(s => {
      if (memberMap[s.agent_id]) {
        memberMap[s.agent_id].worked_seconds  += workedSec(s)
        memberMap[s.agent_id].paused_seconds  += (s.paused_seconds || 0)
        memberMap[s.agent_id].sessions_count++
      }
    })

    return NextResponse.json({
      sessions: (sessions || []).map(s => ({
        ...s,
        member_name:  memberMap[s.agent_id]?.name  || 'Unknown',
        member_email: memberMap[s.agent_id]?.email || '',
      })),
      members:      Object.values(memberMap),
      active_count: (activeSessions || []).filter(s => s.status !== 'paused').length,
      paused_count: (activeSessions || []).filter(s => s.status === 'paused').length,
      workspace:    ctx.workspace,
      from: from.toISOString(),
      to:   to.toISOString(),
      is_client_admin: true,
    })
  }

  // ── Lynq admin view (cross-workspace global) ──────────────────────────────
  if (isLynqAdmin) {
    const { data: members } = await supabaseAdmin
      .from('team_members')
      .select('id, name, email, role')
      .order('created_at')

    const { data: sessions } = await supabaseAdmin
      .from('time_sessions')
      .select('*')
      .gte('clocked_in_at', from.toISOString())
      .lte('clocked_in_at', to.toISOString())
      .order('clocked_in_at', { ascending: false })

    const { data: activeSessions } = await supabaseAdmin
      .from('time_sessions')
      .select('agent_id, clocked_in_at, status')
      .is('clocked_out_at', null)

    const memberMap = {}
    ;(members || []).forEach(m => {
      memberMap[m.id] = { ...m, worked_seconds: 0, paused_seconds: 0, sessions_count: 0, is_active: false, is_paused: false }
    })
    ;(activeSessions || []).forEach(s => {
      if (memberMap[s.agent_id]) {
        memberMap[s.agent_id].is_active = true
        memberMap[s.agent_id].is_paused = s.status === 'paused'
      }
    })
    ;(sessions || []).forEach(s => {
      if (memberMap[s.agent_id]) {
        memberMap[s.agent_id].worked_seconds  += workedSec(s)
        memberMap[s.agent_id].paused_seconds  += (s.paused_seconds || 0)
        memberMap[s.agent_id].sessions_count++
      }
    })

    const sessionsWithNames = (sessions || []).map(s => ({
      ...s,
      member_name:  memberMap[s.agent_id]?.name  || 'Unknown',
      member_email: memberMap[s.agent_id]?.email || '',
    }))

    return NextResponse.json({
      sessions: sessionsWithNames,
      members:  Object.values(memberMap),
      active_count: (activeSessions || []).filter(s => s.status !== 'paused').length,
      paused_count: (activeSessions || []).filter(s => s.status === 'paused').length,
      from: from.toISOString(),
      to:   to.toISOString(),
      is_admin: true,
    })
  }

  // ── Employee view (workspace-scoped lookup by email) ──────────────────────
  const { data: member } = await supabaseAdmin
    .from('team_members')
    .select('id, name, role')
    .eq('email', ctx.user.email)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  if (!member) return NextResponse.json({ error: 'Not a team member' }, { status: 403 })

  const { data: sessions } = await supabaseAdmin
    .from('time_sessions')
    .select('*')
    .eq('workspace_id', ctx.workspaceId)
    .eq('agent_id', member.id)
    .gte('clocked_in_at', from.toISOString())
    .lte('clocked_in_at', to.toISOString())
    .order('clocked_in_at', { ascending: false })

  const { data: active } = await supabaseAdmin
    .from('time_sessions')
    .select('*')
    .eq('workspace_id', ctx.workspaceId)
    .eq('agent_id', member.id)
    .is('clocked_out_at', null)
    .order('clocked_in_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const { data: todaySessions } = await supabaseAdmin
    .from('time_sessions')
    .select('clocked_in_at, clocked_out_at, paused_seconds')
    .eq('workspace_id', ctx.workspaceId)
    .eq('agent_id', member.id)
    .gte('clocked_in_at', todayStart.toISOString())
    .not('clocked_out_at', 'is', null)

  const todayWorked = (todaySessions || []).reduce((sum, s) => {
    const total = Math.round((new Date(s.clocked_out_at) - new Date(s.clocked_in_at)) / 1000)
    return sum + Math.max(0, total - (s.paused_seconds || 0))
  }, 0)

  return NextResponse.json({
    sessions:       sessions || [],
    member,
    active_session: active || null,
    today_seconds:  todayWorked,
    from: from.toISOString(),
    to:   to.toISOString(),
    is_admin: false,
  })
}

export async function POST(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { action } = body

  const { data: member } = await supabaseAdmin
    .from('team_members')
    .select('id, name, client_id')
    .eq('email', ctx.user.email)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  if (!member) return NextResponse.json({ error: 'Not a team member account' }, { status: 403 })

  // ── CLOCK IN ──────────────────────────────────────────────────────────────
  if (action === 'clock-in') {
    const { data: existing } = await supabaseAdmin
      .from('time_sessions')
      .select('id, clocked_in_at, status, paused_seconds, paused_at')
      .eq('workspace_id', ctx.workspaceId)
      .eq('agent_id', member.id)
      .is('clocked_out_at', null)
      .maybeSingle()

    if (existing) return NextResponse.json({ session: existing, already_active: true })

    // Transition: dual-write client_id (legacy) + workspace_id
    const { data: session, error } = await supabaseAdmin
      .from('time_sessions')
      .insert({
        agent_id:       member.id,
        client_id:      member.client_id || null,
        workspace_id:   ctx.workspaceId,
        status:         'active',
        active_seconds: 0,
        idle_seconds:   0,
        paused_seconds: 0,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ session })
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
      .eq('agent_id', member.id)
      .is('clocked_out_at', null)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // ── RESUME ────────────────────────────────────────────────────────────────
  if (action === 'resume') {
    const { session_id } = body
    if (!session_id) return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })

    const { data: current } = await supabaseAdmin
      .from('time_sessions')
      .select('paused_at, paused_seconds')
      .eq('id', session_id)
      .eq('workspace_id', ctx.workspaceId)
      .eq('agent_id', member.id)
      .is('clocked_out_at', null)
      .maybeSingle()

    if (!current) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    const added = current.paused_at
      ? Math.round((Date.now() - new Date(current.paused_at)) / 1000)
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
    const { session_id, eod_report } = body
    if (!session_id) return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })

    // Finalise any ongoing pause before closing
    const { data: current } = await supabaseAdmin
      .from('time_sessions')
      .select('paused_at, paused_seconds')
      .eq('id', session_id)
      .eq('workspace_id', ctx.workspaceId)
      .eq('agent_id', member.id)
      .is('clocked_out_at', null)
      .maybeSingle()

    if (!current) return NextResponse.json({ error: 'Session not found or already closed' }, { status: 404 })

    const extraPaused = current.paused_at
      ? Math.round((Date.now() - new Date(current.paused_at)) / 1000)
      : 0
    const finalPaused = (current.paused_seconds || 0) + extraPaused

    const { data: session, error } = await supabaseAdmin
      .from('time_sessions')
      .update({
        clocked_out_at: new Date().toISOString(),
        status:         'completed',
        paused_at:      null,
        paused_seconds: finalPaused,
        eod_report:     eod_report?.trim() || null,
      })
      .eq('id', session_id)
      .eq('workspace_id', ctx.workspaceId)
      .eq('agent_id', member.id)
      .is('clocked_out_at', null)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ session })
  }

  // ── HEARTBEAT ─────────────────────────────────────────────────────────────
  if (action === 'heartbeat') {
    const { session_id } = body
    if (!session_id) return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })

    const { data: current } = await supabaseAdmin
      .from('time_sessions')
      .select('active_seconds, status')
      .eq('id', session_id)
      .eq('workspace_id', ctx.workspaceId)
      .eq('agent_id', member.id)
      .is('clocked_out_at', null)
      .maybeSingle()

    if (!current) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    // Only accumulate active_seconds when not paused
    if (current.status !== 'paused') {
      const { error } = await supabaseAdmin
        .from('time_sessions')
        .update({ active_seconds: (current.active_seconds || 0) + 30 })
        .eq('id', session_id)
        .eq('workspace_id', ctx.workspaceId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
