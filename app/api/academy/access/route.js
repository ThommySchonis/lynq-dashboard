import { getUserFromToken } from '../../../../lib/supabaseAdmin'
import { hasAcademyAccess, getSubscription } from '../../../../lib/subscription'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await hasAcademyAccess(user.email)

  if (access) {
    return NextResponse.json({ hasAccess: true })
  }

  const sub = await getSubscription(user.email)
  const hasPlan = sub && sub.status === 'active'

  return NextResponse.json({
    hasAccess: false,
    canPurchase: hasPlan,
    addonPrice: 100,
    message: hasPlan
      ? 'Upgrade to Scale or purchase academy access for €100'
      : 'An active subscription is required',
  })
}
