import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: emails } = await supabaseAdmin
    .from('sent_emails')
    .select('*')
    .eq('user_id', user.id)
    .order('sent_at', { ascending: false })

  return NextResponse.json({ emails: emails || [] })
}

export async function DELETE(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ids } = await request.json()
  if (!ids || !ids.length) return NextResponse.json({ error: 'Missing ids' }, { status: 400 })

  await supabaseAdmin
    .from('sent_emails')
    .delete()
    .eq('user_id', user.id)
    .in('id', ids)

  return NextResponse.json({ success: true })
}
