import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

// Map Whop plan IDs to internal plan names
// Fill these in when you connect Whop and create your plans
const PLAN_MAP = {
  // 'whop_plan_id_starter': 'starter',
  // 'whop_plan_id_pro': 'pro',
  // 'whop_plan_id_scale': 'scale',
}

function getPlanFromMembership(membership) {
  const planId = membership?.plan_id || membership?.product_id
  return PLAN_MAP[planId] || 'starter'
}

function verifyWhopSignature(body, signature, secret) {
  if (!secret) return true // Skip verification in dev if no secret set
  const hmac = crypto.createHmac('sha256', secret).update(body).digest('hex')
  return hmac === signature
}

export async function POST(request) {
  const rawBody = await request.text()
  const signature = request.headers.get('whop-signature') || ''
  const webhookSecret = process.env.WHOP_WEBHOOK_SECRET

  if (webhookSecret && !verifyWhopSignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { action, data } = event
  const membership = data?.membership || data
  const userEmail = membership?.user?.email || membership?.email
  const membershipId = membership?.id

  if (!userEmail || !membershipId) {
    return NextResponse.json({ received: true })
  }

  const plan = getPlanFromMembership(membership)

  if (action === 'membership.went_valid') {
    await supabaseAdmin.from('subscriptions').upsert({
      user_email: userEmail,
      whop_membership_id: membershipId,
      plan,
      status: 'active',
      payment_failed_count: 0,
      activated_at: new Date().toISOString(),
      expires_at: membership?.renewal_period_end
        ? new Date(membership.renewal_period_end * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_email' })
  }

  if (action === 'membership.went_invalid') {
    await supabaseAdmin.from('subscriptions')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('user_email', userEmail)
  }

  if (action === 'membership.updated') {
    await supabaseAdmin.from('subscriptions')
      .update({
        plan,
        status: membership?.valid ? 'active' : 'cancelled',
        expires_at: membership?.renewal_period_end
          ? new Date(membership.renewal_period_end * 1000).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_email', userEmail)
  }

  if (action === 'membership.payment_failed') {
    const { data: sub } = await supabaseAdmin
      .from('subscriptions')
      .select('payment_failed_count')
      .eq('user_email', userEmail)
      .single()

    const newCount = (sub?.payment_failed_count || 0) + 1
    const newStatus = newCount >= 3 ? 'payment_failed' : 'active'

    await supabaseAdmin.from('subscriptions')
      .update({
        payment_failed_count: newCount,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('user_email', userEmail)
  }

  return NextResponse.json({ received: true })
}
