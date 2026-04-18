import { supabaseAdmin } from './supabaseAdmin'

export async function getSubscription(userEmail) {
  const { data } = await supabaseAdmin
    .from('subscriptions')
    .select('plan, status, activated_at, expires_at')
    .eq('user_email', userEmail)
    .single()
  return data || null
}

export function hasFeature(plan, feature) {
  const features = {
    starter:  { supplyChain: false, timeTracking: false, multipleStores: false, reports: false, emailsPerMonth: 200 },
    pro:      { supplyChain: true,  timeTracking: true,  multipleStores: false, reports: false, emailsPerMonth: null },
    scale:    { supplyChain: true,  timeTracking: true,  multipleStores: true,  reports: true,  emailsPerMonth: null },
  }
  return features[plan]?.[feature] ?? false
}

export function requirePlan(plan, requiredPlan) {
  const order = ['starter', 'pro', 'scale']
  return order.indexOf(plan) >= order.indexOf(requiredPlan)
}
