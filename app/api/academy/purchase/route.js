import { getUserFromToken, supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { getSubscription, hasAcademyAccess } from '../../../../lib/subscription'
import { NextResponse } from 'next/server'

const ACADEMY_PRICE = 100

export async function POST(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sub = await getSubscription(user.email)
  if (!sub || sub.status !== 'active') {
    return NextResponse.json({ error: 'Active subscription required' }, { status: 403 })
  }

  const alreadyHasAccess = await hasAcademyAccess(user.email)
  if (alreadyHasAccess) {
    return NextResponse.json({ error: 'Already has academy access' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('addon_purchases').insert({
    user_email: user.email,
    addon: 'academy',
    price_paid: ACADEMY_PRICE,
    status: 'active',
    purchased_at: new Date().toISOString(),
  })

  if (error) {
    return NextResponse.json({ error: 'Failed to register purchase' }, { status: 500 })
  }

  return NextResponse.json({ success: true, addon: 'academy', pricePaid: ACADEMY_PRICE })
}
