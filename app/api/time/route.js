import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

async function getUser(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return null
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return null
  return user
}

function getDateRange(filter, customFrom, customTo) {
  const now = new Date()
  let from, to
  to = new Date(now)
  to.setHours(23, 59, 59, 999)

  if (filter === 'day') {
    from = new Date(now)
    from.setHours(0, 0, 0, 0)
  } else if (filter === 'week') {
    from = new Date(now)
    from.setDate(now.getDate() - 7)
    from.setHours(0, 0, 0, 0)
  } else if (filter === 'lastmonth') {
    from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
  } else if (filter === 'custom' && customFrom && customTo) {
    from = new Date(customFrom)
    to = new Date(customTo)
    to.setHours(23, 59, 59, 999)
  } else {
    from = new Date(now.getFullYear(), now.getMonth(), 1)
  }
  return { from, to }
}

// GET — list sessions + agent totals + active session for current user
export async function GET(request) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const filter = searchParams.get('filter') || 'week'
  const customFrom = searchParams.get('from')
  const customTo = searchParams.get('to')
  const { from, to } = getDateRange(filter, customFrom, customTo)

  const isAdmin = user.email === 'info@lynqagency.com'

  let agentsQuery = supabaseAdmin.from('agents').select('id, name, email').order('created_at')
  if (!isAdmin) agentsQuery = agentsQuery.eq('email', user.email)
  const { data: agents } = await agentsQuery

  if (!agents?.length) return NextResponse.json({ sessions: [], agents: [], active_session: null })

  const agentIds = agents.map(a => a.id)

  // Sessions in date range
  const { data: sessions } = await supabaseAdmin
    .from('time_sessions')
    .select('*')
    .in('agent_id', agentIds)
    .gte('clocked_in_at', from.toISOString())
    .lte('clocked_in_at', to.toISOString())
    .order('clocked_in_at', { ascending: false })

  // Check for current user's open session
  let active_session = null
  const myAgent = isAdmin ? null : agents[0]
  if (myAgent) {
    const { data: open } = await supabaseAdmin
      .from('time_sessions')
      .select('*')
      .eq('agent_id', myAgent.id)
      .is('clocked_out_at', null)
      .order('clocked_in_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    active_session = open || null
  }

  // Aggregate totals per agent
  const agentMap = {}
  agents.forEach(a => { agentMap[a.id] = { ...a, total_active: 0, total_idle: 0, sessions: 0 } })
  ;(sessions || []).forEach(s => {
    if (agentMap[s.agent_id]) {
      agentMap[s.agent_id].total_active += s.active_seconds || 0
      agentMap[s.agent_id].total_idle += s.idle_seconds || 0
      agentMap[s.agent_id].sessions++
    }
  })

  return NextResponse.json({
    sessions: sessions || [],
    agents: Object.values(agentMap),
    active_session,
    from: from.toISOString(),
    to: to.toISOString(),
    is_admin: isAdmin,
  })
}

// POST — clock-in | clock-out | heartbeat
export async function POST(request) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { action } = body

  // Resolve agent record
  const { data: agent } = await supabaseAdmin
    .from('agents')
    .select('id, name')
    .eq('email', user.email)
    .maybeSingle()

  if (!agent) return NextResponse.json({ error: 'Not an agent account' }, { status: 403 })

  // ── CLOCK IN ──
  if (action === 'clock-in') {
    // Prevent double clock-in
    const { data: existing } = await supabaseAdmin
      .from('time_sessions')
      .select('id, clocked_in_at')
      .eq('agent_id', agent.id)
      .is('clocked_out_at', null)
      .maybeSingle()

    if (existing) return NextResponse.json({ session: existing, already_active: true })

    const { data: session, error } = await supabaseAdmin
      .from('time_sessions')
      .insert({ agent_id: agent.id, status: 'active' })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ session })
  }

  // ── CLOCK OUT ──
  if (action === 'clock-out') {
    const { session_id } = body
    if (!session_id) return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })

    const { data: session, error } = await supabaseAdmin
      .from('time_sessions')
      .update({ clocked_out_at: new Date().toISOString(), status: 'completed' })
      .eq('id', session_id)
      .eq('agent_id', agent.id)
      .is('clocked_out_at', null)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ session })
  }

  // ── HEARTBEAT ──
  if (action === 'heartbeat') {
    const { session_id, is_idle } = body
    if (!session_id) return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })

    const { data: current } = await supabaseAdmin
      .from('time_sessions')
      .select('active_seconds, idle_seconds')
      .eq('id', session_id)
      .eq('agent_id', agent.id)
      .is('clocked_out_at', null)
      .maybeSingle()

    if (!current) return NextResponse.json({ error: 'Session not found or already closed' }, { status: 404 })

    const { error } = await supabaseAdmin
      .from('time_sessions')
      .update({
        active_seconds: is_idle ? current.active_seconds : current.active_seconds + 30,
        idle_seconds: is_idle ? current.idle_seconds + 30 : current.idle_seconds,
        status: is_idle ? 'idle' : 'active',
      })
      .eq('id', session_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
