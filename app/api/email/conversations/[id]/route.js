import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'
import { getAuthContext } from '../../../../../lib/auth'
import { NextResponse } from 'next/server'

const VALID_STATUSES = ['open', 'pending', 'resolved', 'closed']

export async function GET(request, { params }) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: conversation } = await supabaseAdmin
    .from('email_conversations')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)
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
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { status } = await request.json()
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  await supabaseAdmin
    .from('email_conversations')
    .update({ status })
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)

  return NextResponse.json({ success: true })
}
