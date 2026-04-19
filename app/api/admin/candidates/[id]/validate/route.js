import { supabaseAdmin, getUserFromToken } from '../../../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

const ADMIN_EMAIL = 'info@lynqagency.com'

// PATCH — admin validates candidate after call, or sets them live in marketplace
export async function PATCH(request, { params }) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const { action, display_code } = await request.json()

  // action: 'call_validated' | 'make_visible' | 'hide' | 'reject'
  const VALID_ACTIONS = ['call_validated', 'make_visible', 'hide', 'reject']
  if (!VALID_ACTIONS.includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  if (action === 'call_validated') {
    // Unlock Academy training access
    await supabaseAdmin
      .from('profiles')
      .update({ exam_status: 'call_validated' })
      .eq('id', id)

    return NextResponse.json({ success: true, message: 'Candidate validated. Training access unlocked.' })
  }

  if (action === 'make_visible') {
    // Make candidate visible in marketplace (after training + certificate)
    const code = display_code || await generateDisplayCode(id)

    await Promise.all([
      supabaseAdmin.from('profiles').update({ exam_status: 'certified', is_certified: true }).eq('id', id),
      supabaseAdmin.from('talent_profiles').update({
        visible: true,
        display_code: code,
        verified_at: new Date().toISOString(),
      }).eq('user_id', id),
    ])

    return NextResponse.json({ success: true, display_code: code, message: 'Candidate is now live in the marketplace.' })
  }

  if (action === 'hide') {
    await supabaseAdmin.from('talent_profiles').update({ visible: false }).eq('user_id', id)
    return NextResponse.json({ success: true, message: 'Candidate hidden from marketplace.' })
  }

  if (action === 'reject') {
    await supabaseAdmin.from('profiles').update({ exam_status: 'rejected' }).eq('id', id)
    return NextResponse.json({ success: true, message: 'Candidate rejected.' })
  }
}

async function generateDisplayCode(userId) {
  const roleMap = {
    customer_service: 'CS',
    supply_chain: 'SC',
    dispute_management: 'DM',
    overall_manager: 'OM',
  }
  const { data: profile } = await supabaseAdmin
    .from('talent_profiles')
    .select('role')
    .eq('user_id', userId)
    .single()

  const prefix = roleMap[profile?.role] || 'LQ'
  const num = String(Math.floor(Math.random() * 900) + 100)
  return `${prefix}-${num}`
}
