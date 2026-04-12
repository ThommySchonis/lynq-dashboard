import { supabaseAdmin, getUserFromToken } from '../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

async function getUser(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return null
  const token = authHeader.replace('Bearer ', '')
  return await getUserFromToken(token)
}

export async function GET(request) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const filter = searchParams.get('filter') || 'month'
  const customFrom = searchParams.get('from')
  const customTo = searchParams.get('to')

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
    // default: this month
    from = new Date(now.getFullYear(), now.getMonth(), 1)
  }

  const isAdmin = user.email === 'info@lynqagency.com'

  // Fetch agents (all for admin, just self for agent)
  let agentsQuery = supabaseAdmin.from('agents').select('*').order('created_at', { ascending: true })
  if (!isAdmin) agentsQuery = agentsQuery.eq('email', user.email)

  const { data: agents, error: agentsError } = await agentsQuery
  if (agentsError) return NextResponse.json({ error: agentsError.message }, { status: 500 })

  if (!agents || agents.length === 0) {
    return NextResponse.json({ stats: [], from: from.toISOString(), to: to.toISOString() })
  }

  // Fetch agent_actions in date range
  const agentIds = agents.map(a => a.id)
  const { data: actions, error: actionsError } = await supabaseAdmin
    .from('agent_actions')
    .select('agent_id, action_type, response_time_seconds, thread_id')
    .in('agent_id', agentIds)
    .gte('created_at', from.toISOString())
    .lte('created_at', to.toISOString())

  if (actionsError) return NextResponse.json({ error: actionsError.message }, { status: 500 })

  // Aggregate per agent
  const stats = agents.map(agent => {
    const agentActions = (actions || []).filter(a => a.agent_id === agent.id)
    const replies = agentActions.filter(a => a.action_type === 'reply')
    const closes = agentActions.filter(a => a.action_type === 'close')
    const uniqueThreads = new Set(agentActions.map(a => a.thread_id).filter(Boolean))
    const responseTimes = replies
      .filter(a => a.response_time_seconds != null)
      .map(a => a.response_time_seconds)
    const avgResponseSeconds = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : null
    const emailsPerTicket = uniqueThreads.size > 0
      ? Math.round((replies.length / uniqueThreads.size) * 10) / 10
      : 0

    return {
      id: agent.id,
      name: agent.name,
      email: agent.email,
      role: agent.role,
      active: agent.active,
      tickets_handled: uniqueThreads.size,
      replies_sent: replies.length,
      tickets_closed: closes.length,
      avg_response_seconds: avgResponseSeconds ? Math.round(avgResponseSeconds) : null,
      emails_per_ticket: emailsPerTicket,
    }
  })

  return NextResponse.json({ stats, from: from.toISOString(), to: to.toISOString() })
}
