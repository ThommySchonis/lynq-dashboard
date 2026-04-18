import { supabaseAdmin, getUserFromToken } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

// POST /api/subscription/activate
// Manual activation for testing — disable in production once Whop is live
// Body: { plan: 'starter' | 'pro' | 'scale' }
export async function POST(request) {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_MANUAL_ACTIVATION !== 'true') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plan = 'starter' } = await request.json()
  const validPlans = ['starter', 'pro', 'scale']
  if (!validPlans.includes(plan)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('subscriptions').upsert({
    user_email: user.email,
    whop_membership_id: `test_${user.email}_${Date.now()}`,
    plan,
    status: 'active',
    activated_at: new Date().toISOString(),
    expires_at: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_email' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, plan, email: user.email })
}
