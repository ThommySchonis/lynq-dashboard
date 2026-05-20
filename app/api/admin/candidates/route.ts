import { supabaseAdmin, getUserFromToken } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { validateQuery } from '@/lib/validation'
import { getCandidatesQuery } from '@/lib/schemas/admin'

const ADMIN_EMAIL = 'info@lynqagency.com'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [query, err] = validateQuery(request, getCandidatesQuery)
  if (err) return err

  let dbQuery = supabaseAdmin
    .from('profiles')
    .select('id, full_name, exam_status, exam_type_taken, exam_score, is_certified, created_at')
    .eq('user_role', 'agent_candidate')
    .order('created_at', { ascending: false })

  if (query.status) dbQuery = dbQuery.eq('exam_status', query.status)

  const { data: candidates } = await dbQuery

  // Enrich with talent_profiles and purchase data
  const enriched = await Promise.all((candidates || []).map(async (c) => {
    const talentRes = await supabaseAdmin
      .from('talent_profiles')
      .select('id, display_code, hourly_rate, visible, role')
      .eq('user_id', c.id)
      .maybeSingle()

    const purchaseRes = talentRes.data?.id
      ? await supabaseAdmin
        .from('talent_purchases')
        .select('id, payment_status, created_at')
        .eq('talent_profile_id', talentRes.data.id)
        .limit(5)
      : { data: [] }

    return {
      ...c,
      talent_profile: talentRes.data || null,
      purchases: purchaseRes.data || [],
    }
  }))

  return NextResponse.json({ candidates: enriched })
}
