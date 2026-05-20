import type { NextRequest } from 'next/server'
import { supabaseAdmin, getUserFromToken } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'

// GET /api/subscription/status
// Returns the current user's subscription plan and status
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  interface SubRow { plan: string; status: string; activated_at: string; expires_at: string }
  const subResult = await supabaseAdmin
    .from('subscriptions')
    .select('plan, status, activated_at, expires_at')
    .eq('user_email', user.email)
    .single()

  const sub = subResult.data as SubRow | null

  if (!sub || sub.status !== 'active') {
    return NextResponse.json({ plan: null, status: 'inactive', hasAccess: false })
  }

  const planFeatures = {
    starter: {
      emailsPerMonth: 200,
      supplyChain: false,
      timeTracking: false,
      multipleStores: false,
      reports: false,
    },
    pro: {
      emailsPerMonth: null,
      supplyChain: true,
      timeTracking: true,
      multipleStores: false,
      reports: false,
    },
    scale: {
      emailsPerMonth: null,
      supplyChain: true,
      timeTracking: true,
      multipleStores: true,
      reports: true,
    },
  }

  return NextResponse.json({
    plan: sub.plan,
    status: sub.status,
    hasAccess: true,
    activatedAt: sub.activated_at,
    expiresAt: sub.expires_at,
    features: planFeatures[sub.plan as keyof typeof planFeatures] || planFeatures.starter,
  })
}
