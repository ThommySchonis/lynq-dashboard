import { supabaseAdmin } from './supabaseAdmin'

const EMAIL_LIMITS = { starter: 200, pro: null, scale: null }

export async function checkEmailLimit(userEmail) {
  const { data: sub } = await supabaseAdmin
    .from('subscriptions')
    .select('plan, status')
    .eq('user_email', userEmail)
    .single()

  const plan = sub?.plan || 'starter'
  const limit = EMAIL_LIMITS[plan]
  if (!limit) return { allowed: true, plan, used: null, limit: null }

  const month = new Date().toISOString().slice(0, 7) // YYYY-MM

  const { data: usage } = await supabaseAdmin
    .from('email_usage')
    .select('count')
    .eq('user_email', userEmail)
    .eq('month', month)
    .single()

  const used = usage?.count || 0
  return { allowed: used < limit, plan, used, limit, remaining: limit - used }
}

export async function incrementEmailCount(userEmail) {
  const month = new Date().toISOString().slice(0, 7)

  await supabaseAdmin.rpc('increment_email_usage', {
    p_user_email: userEmail,
    p_month: month,
  })
}
