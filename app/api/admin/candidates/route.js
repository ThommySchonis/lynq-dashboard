import { supabaseAdmin, getUserFromToken } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

const ADMIN_EMAIL = 'info@lynqagency.com'

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') // exam_passed | call_scheduled | call_validated | certified

  let query = supabaseAdmin
    .from('profiles')
    .select('id, full_name, exam_status, exam_type_taken, exam_score, is_certified, created_at')
    .eq('user_role', 'agent_candidate')
    .order('created_at', { ascending: false })

  if (status) query = query.eq('exam_status', status)

  const { data: candidates } = await query

  // Enrich with talent_profiles and purchase data
  const enriched = await Promise.all((candidates || []).map(async (c) => {
    const [talentRes, purchaseRes] = await Promise.all([
      supabaseAdmin.from('talent_profiles').select('id, display_code, hourly_rate, visible, role').eq('user_id', c.id).maybeSingle(),
      supabaseAdmin.from('talent_purchases').select('id, payment_status, created_at').eq('talent_profile_id', c.id).limit(5),
    ])
    return {
      ...c,
      talent_profile: talentRes.data || null,
      purchases: purchaseRes.data || [],
    }
  }))

  return NextResponse.json({ candidates: enriched })
}
