import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { getAuthContext } from '../../../lib/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { parseBody } from '@/lib/utils/typed-json'

interface FeedbackBody {
  type?: string
  message?: string
  page_url?: string
  user_agent?: string
}

interface IdRow {
  id: string
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: FeedbackBody
  try {
    body = await parseBody<FeedbackBody>(request)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { type, message, page_url, user_agent } = body

  if (!type || !['bug', 'feedback', 'other'].includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }
  if (typeof message !== 'string' || message.trim().length < 5 || message.length > 5000) {
    return NextResponse.json({ error: 'Message must be 5–5000 characters' }, { status: 400 })
  }

  const insertPayload = {
    workspace_id: ctx.workspaceId,
    user_id: ctx.user.id,
    type,
    message: message.trim(),
    page_url: typeof page_url === 'string' ? page_url.slice(0, 500) : null,
    user_agent: typeof user_agent === 'string' ? user_agent.slice(0, 500) : null,
  }

  const { data, error } = await supabaseAdmin
    .from('feedback_submissions')
    .insert(insertPayload)
    .select('id')
    .single()

  if (error) {
    // Surface every Supabase/Postgres field so root cause is debuggable.
    console.error('[feedback] insert failed', {
      message: error.message,
      code:    error.code,
      details: error.details,
      hint:    error.hint,
      payload: { ...insertPayload, message: '<redacted>' },
    })
    const isProd = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production'
    return NextResponse.json(
      isProd
        ? { error: 'Something went wrong. Please try again.' }
        : { error: error.message, code: error.code, details: error.details, hint: error.hint },
      { status: 500 }
    )
  }

  return NextResponse.json({ id: (data as IdRow).id })
}
