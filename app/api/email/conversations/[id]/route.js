import { supabaseAdmin, getUserFromToken } from '../../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function GET(request, { params }) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: conversation } = await supabaseAdmin
    .from('email_conversations')
    .select('*')
    .eq('id', id)
    .eq('client_id', user.id)
    .maybeSingle()

  if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: messages } = await supabaseAdmin
    .from('email_messages')
    .select('*')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  return NextResponse.json({ conversation, messages: messages || [] })
}

export async function PATCH(request, { params }) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { status } = await request.json()

  await supabaseAdmin
    .from('email_conversations')
    .update({ status })
    .eq('id', id)
    .eq('client_id', user.id)

  return NextResponse.json({ success: true })
}
