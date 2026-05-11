import { getAuthContext } from '../../../../../lib/auth'
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { RouteContext } from '@/types/api'

export async function GET(request: NextRequest, { params }: RouteContext<{ id: string }>) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: conversation } = await supabaseAdmin
    .from('email_conversations')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)
    .single()

  if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: messages } = await supabaseAdmin
    .from('email_messages')
    .select('*')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  const { data: notes } = await supabaseAdmin
    .from('conversation_notes')
    .select('*')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  if (conversation.is_unread) {
    await supabaseAdmin
      .from('email_conversations')
      .update({ is_unread: false })
      .eq('id', id)
  }

  return NextResponse.json({
    conversation,
    messages: messages || [],
    notes: notes || [],
  })
}

export async function PATCH(request: NextRequest, { params }: RouteContext<{ id: string }>) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json() as { status?: string; is_unread?: boolean }

  const updates: Record<string, unknown> = {}
  if (body.status) {
    const validStatuses = ['open', 'pending', 'resolved', 'closed']
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    updates.status = body.status
  }
  if (typeof body.is_unread === 'boolean') {
    updates.is_unread = body.is_unread
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('email_conversations')
    .update(updates)
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
