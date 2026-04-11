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

// POST — log an agent action (reply, close, etc.)
export async function POST(request) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { agent_id, thread_id, action_type, response_time_seconds } = await request.json()
  if (!agent_id || !action_type) {
    return NextResponse.json({ error: 'agent_id and action_type are required' }, { status: 400 })
  }

  const validTypes = ['reply', 'close', 'refund_processed']
  if (!validTypes.includes(action_type)) {
    return NextResponse.json({ error: 'Invalid action_type' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('agent_actions')
    .insert({ agent_id, thread_id, action_type, response_time_seconds: response_time_seconds || null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ action: data })
}
