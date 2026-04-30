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

  const apiKey = request.headers.get('x-parcelpanel-api-key')
    || request.headers.get('authorization')

  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('id')
    .eq('parcel_panel_api_key', apiKey)
    .single()

  if (!client) {
    console.log('[parcel-panel/webhook] unknown client, API key:', apiKey?.substring(0, 8))
    return NextResponse.json({ received: true })
  }

  const { error } = await supabaseAdmin
    .from('shipments')
    .upsert({
      client_id:          client.id,
      order_number:       body.order_number   || body.order?.name,
      tracking_number:    body.tracking_number,
      carrier:            body.carrier_name   || body.carrier?.name,
      status:             body.status         || body.shipment_status,
      customer_name:      body.customer?.name || body.customer_name,
      estimated_delivery: body.estimated_delivery_date || null,
      last_updated:       new Date().toISOString(),
      raw_data:           body,
    }, { onConflict: 'tracking_number' })

  if (error) {
    console.error('[parcel-panel/webhook] upsert error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
