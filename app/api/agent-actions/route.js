import { supabaseAdmin, getUserFromToken } from '../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

async function getUser(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return null
  const token = authHeader.replace('Bearer ', '')
  return await getUserFromToken(token)
}

// POST — log an agent action (reply, close, etc.)
export async function POST(request) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { thread_id, action_type, response_time_seconds } = await request.json()
  if (!action_type) {
    return NextResponse.json({ error: 'action_type is required' }, { status: 400 })
  }

  const validTypes = ['reply', 'close', 'refund_processed']
  if (!validTypes.includes(action_type)) {
    return NextResponse.json({ error: 'Invalid action_type' }, { status: 400 })
  }

  const { data: agent, error: agentError } = await supabaseAdmin
    .from('agents')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (agentError) return NextResponse.json({ error: agentError.message }, { status: 500 })
  if (!agent) return NextResponse.json({ error: 'Agent profile not found' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('agent_actions')
    .insert({ agent_id: agent.id, thread_id, action_type, response_time_seconds: response_time_seconds || null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ action: data })
}
