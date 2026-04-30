import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  console.log('[parcel-panel/webhook] received:', JSON.stringify(body).substring(0, 500))

  const { error } = await supabaseAdmin
    .from('shipments')
    .upsert({
      order_number:      body.order_number   || body.order?.name,
      tracking_number:   body.tracking_number,
      carrier:           body.carrier_name   || body.carrier?.name,
      status:            body.status         || body.shipment_status,
      customer_name:     body.customer?.name || body.customer_name,
      estimated_delivery: body.estimated_delivery_date || null,
      last_updated:      new Date().toISOString(),
      raw_data:          body,
    }, { onConflict: 'tracking_number' })

  if (error) {
    console.error('[parcel-panel/webhook] upsert error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
