import { supabaseAdmin, getUserFromToken } from '../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

async function getUser(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return null
  const token = authHeader.replace('Bearer ', '')
  return await getUserFromToken(token)
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

// POST — invite agent (sends email with link to set password)
export async function POST(request) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, email } = await request.json()
  if (!name || !email) return NextResponse.json({ error: 'Name and email required' }, { status: 400 })

  // Check if agent already exists in agents table
  const { data: existing } = await supabaseAdmin
    .from('agents')
    .select('id')
    .eq('email', email)
    .single()

  if (existing) return NextResponse.json({ error: 'An agent with this email already exists' }, { status: 400 })

  // Send invite email via Supabase — agent receives link to set their password
  // redirectTo must be listed in Supabase Auth → URL Configuration → Redirect URLs
  const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { name, role: 'agent', is_agent: true },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/login`,
  })

  if (inviteError) {
    // If user already exists in auth but not in agents table, we can still add them
    if (!inviteError.message.toLowerCase().includes('already been invited') &&
        !inviteError.message.toLowerCase().includes('already registered')) {
      return NextResponse.json({ error: inviteError.message }, { status: 500 })
    }
  }

  const authUserId = inviteData?.user?.id || null

  // Insert into agents table
  const { data: agent, error: insertError } = await supabaseAdmin
    .from('agents')
    .insert({
      name,
      email,
      role: 'agent',
      user_id: authUserId,
      invited_by: user.id,
    })
    .select()
    .single()

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  return NextResponse.json({ agent, invited: true })
}

// DELETE — remove agent (removes from agents table + deletes auth user)
export async function DELETE(request) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  // Get agent to find their auth user_id
  const { data: agent } = await supabaseAdmin
    .from('agents')
    .select('user_id')
    .eq('id', id)
    .single()

  // Delete from agents table
  await supabaseAdmin.from('agents').delete().eq('id', id)

  // Also remove their Supabase auth account
  if (agent?.user_id) {
    await supabaseAdmin.auth.admin.deleteUser(agent.user_id)
  }

  return NextResponse.json({ success: true })
}
