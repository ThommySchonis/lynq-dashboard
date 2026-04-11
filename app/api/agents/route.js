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

// GET — list all agents
export async function GET(request) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: agents, error } = await supabaseAdmin
    .from('agents')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ agents: agents || [] })
}

// POST — create agent + Supabase auth account
export async function POST(request) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, email, role } = await request.json()
  if (!name || !email) return NextResponse.json({ error: 'Name and email required' }, { status: 400 })

  const validRoles = ['observer', 'lite', 'basic', 'lead', 'admin']
  const agentRole = validRoles.includes(role) ? role : 'basic'

  // Check if agent already exists
  const { data: existing } = await supabaseAdmin
    .from('agents')
    .select('id')
    .eq('email', email)
    .single()

  if (existing) return NextResponse.json({ error: 'An agent with this email already exists' }, { status: 400 })

  // Create Supabase auth user (they will receive a password reset email to set their password)
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { name, role: agentRole, is_agent: true },
  })

  if (authError && !authError.message.includes('already been registered')) {
    return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  const authUserId = authData?.user?.id || null

  // Insert into agents table
  const { data: agent, error: insertError } = await supabaseAdmin
    .from('agents')
    .insert({
      name,
      email,
      role: agentRole,
      user_id: authUserId,
      invited_by: user.id,
    })
    .select()
    .single()

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  return NextResponse.json({ agent })
}

// DELETE — remove agent
export async function DELETE(request) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  await supabaseAdmin.from('agents').delete().eq('id', id)
  return NextResponse.json({ success: true })
}
