import { getAuthContext } from '../../../../../../lib/auth'
import { supabaseAdmin } from '../../../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { RouteContext } from '@/types/api'

export async function GET(request: NextRequest, { params }: RouteContext<{ id: string }>) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: notes } = await supabaseAdmin
    .from('conversation_notes')
    .select('*')
    .eq('conversation_id', id)
    .eq('workspace_id', ctx.workspaceId)
    .order('created_at', { ascending: true })

  return NextResponse.json({ notes: notes || [] })
}

export async function POST(request: NextRequest, { params }: RouteContext<{ id: string }>) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json() as { body?: string }

  if (!body.body?.trim()) {
    return NextResponse.json({ error: 'Note body required' }, { status: 400 })
  }

  const { data: conv } = await supabaseAdmin
    .from('email_conversations')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  if (!conv) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

  const { data: note, error } = await supabaseAdmin
    .from('conversation_notes')
    .insert({
      conversation_id: id,
      workspace_id: ctx.workspaceId,
      body: body.body.trim(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ note })
}
