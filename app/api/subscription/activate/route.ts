import type { NextRequest } from 'next/server'
import { supabaseAdmin, getUserFromToken } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import { validateBody } from '@/lib/validation'
import { activateSubscriptionBody } from '@/lib/schemas/subscription'

const ADMIN_EMAIL = 'info@lynqagency.com'

// POST /api/subscription/activate
// Manual activation for testing — disable in production once Whop is live
// Body: { plan: 'starter' | 'pro' | 'scale' }
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_MANUAL_ACTIVATION !== 'true') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const [body, validationErr] = await validateBody(request, activateSubscriptionBody)
  if (validationErr) return validationErr
  const { plan, email } = body
  const targetEmail = String(email || user.email).trim().toLowerCase()

  const { error } = await supabaseAdmin.from('subscriptions').upsert({
    user_email: targetEmail,
    whop_membership_id: `manual_${targetEmail}_${Date.now()}`,
    plan,
    status: 'active',
    activated_at: new Date().toISOString(),
    expires_at: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_email' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, plan, email: targetEmail })
}
