import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { getAuthContext } from '../../../lib/auth'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { type, message, page_url, user_agent } = body || {}

  if (!['bug', 'feedback', 'other'].includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }
  if (typeof message !== 'string' || message.trim().length < 5 || message.length > 5000) {
    return NextResponse.json({ error: 'Message must be 5–5000 characters' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('feedback_submissions')
    .insert({
      workspace_id: ctx.workspaceId,
      user_id: ctx.user.id,
      type,
      message: message.trim(),
      page_url: typeof page_url === 'string' ? page_url.slice(0, 500) : null,
      user_agent: typeof user_agent === 'string' ? user_agent.slice(0, 500) : null,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[feedback] insert failed:', error.message)
    return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 })
  }

  return NextResponse.json({ id: data.id })
}
