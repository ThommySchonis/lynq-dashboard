import { getUserFromToken } from '../../../../lib/supabaseAdmin'
import { checkEmailLimit } from '../../../../lib/emailUsage'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const usage = await checkEmailLimit(user.email)

  const now = new Date()
  const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()

  return NextResponse.json({
    used: usage.used ?? 0,
    limit: usage.limit,
    remaining: usage.remaining ?? null,
    plan: usage.plan,
    resetDate,
  })
}
