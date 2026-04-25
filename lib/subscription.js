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
    starter: {
      inbox: true,
      aiReplySuggestions: true,
      autoDrafts: false,
      refundDashboard: true,
      macros: true,
      advancedShopify: false,
      performanceDashboard: false,
      automationRules: false,
      timeTracking: false,
      supplyChain: false,
      valueFeed: false,
      multipleStores: false,
      analytics: false,
      agentPerformance: false,
      strategyCall: false,
      academy: false,
      creditsPerMonth: 100,
    },
    pro: {
      inbox: true,
      aiReplySuggestions: true,
      autoDrafts: true,
      refundDashboard: true,
      macros: true,
      advancedShopify: true,
      performanceDashboard: true,
      automationRules: true,
      timeTracking: true,
      supplyChain: true,
      valueFeed: true,
      multipleStores: false,
      analytics: false,
      agentPerformance: false,
      strategyCall: false,
      academy: false,
      creditsPerMonth: 400,
    },
    scale: {
      inbox: true,
      aiReplySuggestions: true,
      autoDrafts: true,
      refundDashboard: true,
      macros: true,
      advancedShopify: true,
      performanceDashboard: true,
      automationRules: true,
      timeTracking: true,
      supplyChain: true,
      valueFeed: true,
      multipleStores: true,
      analytics: true,
      agentPerformance: true,
      strategyCall: true,
      academy: true,
      creditsPerMonth: 1000,
    },
  }
  return features[plan]?.[feature] ?? false
}

export function requirePlan(plan, requiredPlan) {
  const order = ['starter', 'pro', 'scale']
  return order.indexOf(plan) >= order.indexOf(requiredPlan)
}

export async function hasAddon(userEmail, addon) {
  const { data } = await supabaseAdmin
    .from('addon_purchases')
    .select('id')
    .eq('user_email', userEmail)
    .eq('addon', addon)
    .eq('status', 'active')
    .single()
  return !!data
}

export async function hasAcademyAccess(userEmail) {
  const sub = await getSubscription(userEmail)
  if (!sub || sub.status !== 'active') return false
  if (hasFeature(sub.plan, 'academy')) return true
  return hasAddon(userEmail, 'academy')
}
