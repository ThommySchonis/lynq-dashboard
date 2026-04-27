import { supabaseAdmin, getUserFromToken } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

const EMAIL_LIMITS = { starter: 200, pro: null, scale: null }

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const month = new Date().toISOString().slice(0, 7) // YYYY-MM

  const [subRes, usageRes] = await Promise.all([
    supabaseAdmin
      .from('subscriptions')
      .select('plan, status')
      .eq('user_email', user.email)
      .single(),
    supabaseAdmin
      .from('email_usage')
      .select('count')
      .eq('user_email', user.email)
      .eq('month', month)
      .single(),
  ])

  const plan = subRes.data?.plan || 'starter'
  const limit = EMAIL_LIMITS[plan] ?? null
  const sent = usageRes.data?.count || 0

  return NextResponse.json({ sent, limit, plan })
}
