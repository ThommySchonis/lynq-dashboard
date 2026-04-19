import { supabaseAdmin, getUserFromToken } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

const PLACEMENT_FEE = 299
const TRAINER_FEE = 199

export async function POST(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { talent_profile_id, include_trainer, company_name, contact_name, contact_phone, notes } = await request.json()

  if (!talent_profile_id) return NextResponse.json({ error: 'talent_profile_id required' }, { status: 400 })

  // Verify candidate exists and is visible
  const { data: candidate } = await supabaseAdmin
    .from('talent_profiles')
    .select('id, display_code, role, hourly_rate')
    .eq('id', talent_profile_id)
    .eq('visible', true)
    .single()

  if (!candidate) return NextResponse.json({ error: 'Candidate not found or no longer available' }, { status: 404 })

  // Check not already purchased by this client
  const { data: existing } = await supabaseAdmin
    .from('talent_purchases')
    .select('id')
    .eq('client_user_id', user.id)
    .eq('talent_profile_id', talent_profile_id)
    .in('payment_status', ['pending', 'paid'])
    .maybeSingle()

  if (existing) return NextResponse.json({ error: 'You have already requested this candidate.' }, { status: 409 })

  const totalAmount = PLACEMENT_FEE + (include_trainer ? TRAINER_FEE : 0)

  const { data: purchase, error } = await supabaseAdmin
    .from('talent_purchases')
    .insert({
      client_user_id: user.id,
      talent_profile_id,
      include_trainer: !!include_trainer,
      placement_fee: PLACEMENT_FEE,
      trainer_fee: include_trainer ? TRAINER_FEE : 0,
      total_amount: totalAmount,
      payment_status: 'pending',
      status: 'pending',
      notes: JSON.stringify({ company_name, contact_name, contact_phone, notes }),
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: 'Failed to create purchase request' }, { status: 500 })

  return NextResponse.json({
    success: true,
    purchase_id: purchase.id,
    total_amount: totalAmount,
    placement_fee: PLACEMENT_FEE,
    trainer_fee: include_trainer ? TRAINER_FEE : 0,
    message: `Je aanvraag voor ${candidate.display_code} is ontvangen. Het Lynq team neemt binnen 24 uur contact met je op voor de betaling en koppeling.`,
  })
}
