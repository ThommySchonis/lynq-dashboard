import { supabaseAdmin, getUserFromToken } from '../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

const ADMIN_EMAIL = 'info@lynqagency.com'

async function getUser(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return null
  const token = authHeader.replace('Bearer ', '')
  return await getUserFromToken(token)
}

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

export async function GET(request) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const filter = searchParams.get('filter') || 'week'
  const customFrom = searchParams.get('from')
  const customTo = searchParams.get('to')
  const { from, to } = getDateRange(filter, customFrom, customTo)

  const isAdmin = user.email === ADMIN_EMAIL

  if (isAdmin) {
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
      .select('agent_id, clocked_in_at')
      .is('clocked_out_at', null)

    const memberMap = {}
    ;(members || []).forEach(m => {
      memberMap[m.id] = { ...m, total_seconds: 0, sessions_count: 0, is_active: false }
    })
    ;(activeSessions || []).forEach(s => {
      if (memberMap[s.agent_id]) memberMap[s.agent_id].is_active = true
    })
    ;(sessions || []).forEach(s => {
      if (memberMap[s.agent_id]) {
        const dur = s.clocked_out_at
          ? (new Date(s.clocked_out_at) - new Date(s.clocked_in_at)) / 1000
          : (s.active_seconds || 0) + (s.idle_seconds || 0)
        memberMap[s.agent_id].total_seconds += dur
        memberMap[s.agent_id].sessions_count++
      }
    })

    // Attach member name to each session
    const sessionsWithNames = (sessions || []).map(s => ({
      ...s,
      member_name: memberMap[s.agent_id]?.name || 'Unknown',
      member_email: memberMap[s.agent_id]?.email || '',
    }))

    return NextResponse.json({
      sessions: sessionsWithNames,
      members: Object.values(memberMap),
      active_count: (activeSessions || []).length,
      from: from.toISOString(),
      to: to.toISOString(),
      is_admin: true,
    })
  } else {
    const { data: member } = await supabaseAdmin
      .from('team_members')
      .select('id, name, role')
      .eq('email', user.email)
      .maybeSingle()

    if (!member) return NextResponse.json({ error: 'Not a team member' }, { status: 403 })

    const { data: sessions } = await supabaseAdmin
      .from('time_sessions')
      .select('*')
      .eq('agent_id', member.id)
      .gte('clocked_in_at', from.toISOString())
      .lte('clocked_in_at', to.toISOString())
      .order('clocked_in_at', { ascending: false })

    const { data: active } = await supabaseAdmin
      .from('time_sessions')
      .select('*')
      .eq('agent_id', member.id)
      .is('clocked_out_at', null)
      .order('clocked_in_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Also fetch today for the today KPI
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const { data: todaySessions } = await supabaseAdmin
      .from('time_sessions')
      .select('clocked_in_at, clocked_out_at, active_seconds, idle_seconds')
      .eq('agent_id', member.id)
      .gte('clocked_in_at', todayStart.toISOString())
      .not('clocked_out_at', 'is', null)

    const todaySeconds = (todaySessions || []).reduce((sum, s) => {
      return sum + (new Date(s.clocked_out_at) - new Date(s.clocked_in_at)) / 1000
    }, 0)

    return NextResponse.json({
      sessions: sessions || [],
      member,
      active_session: active || null,
      today_seconds: Math.round(todaySeconds),
      from: from.toISOString(),
      to: to.toISOString(),
      is_admin: false,
    })
  }
}

export async function POST(request) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { action } = body

  const { data: member } = await supabaseAdmin
    .from('team_members')
    .select('id, name')
    .eq('email', user.email)
    .maybeSingle()

  if (!member) return NextResponse.json({ error: 'Not a team member account' }, { status: 403 })

  if (action === 'clock-in') {
    const { data: existing } = await supabaseAdmin
      .from('time_sessions')
      .select('id, clocked_in_at')
      .eq('agent_id', member.id)
      .is('clocked_out_at', null)
      .maybeSingle()

    if (existing) return NextResponse.json({ session: existing, already_active: true })

    const { data: session, error } = await supabaseAdmin
      .from('time_sessions')
      .insert({ agent_id: member.id, status: 'active', active_seconds: 0, idle_seconds: 0 })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ session })
  }

  if (action === 'clock-out') {
    const { session_id, eod_report } = body
    if (!session_id) return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })

    const { data: session, error } = await supabaseAdmin
      .from('time_sessions')
      .update({
        clocked_out_at: new Date().toISOString(),
        status: 'completed',
        eod_report: eod_report?.trim() || null,
      })
      .eq('id', session_id)
      .eq('agent_id', member.id)
      .is('clocked_out_at', null)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ session })
  }

  if (action === 'heartbeat') {
    const { session_id } = body
    if (!session_id) return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })

    const { data: current } = await supabaseAdmin
      .from('time_sessions')
      .select('active_seconds')
      .eq('id', session_id)
      .eq('agent_id', member.id)
      .is('clocked_out_at', null)
      .maybeSingle()

    if (!current) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    const { error } = await supabaseAdmin
      .from('time_sessions')
      .update({ active_seconds: (current.active_seconds || 0) + 30, status: 'active' })
      .eq('id', session_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
