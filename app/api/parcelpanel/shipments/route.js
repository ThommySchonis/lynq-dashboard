import { supabaseAdmin, getUserFromToken } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

// GET /api/parcelpanel/shipments?status=failed_attempt&page=1
export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get ParcelPanel API key for this user
  const { data: settings } = await supabaseAdmin
    .from('integrations')
    .select('parcelpanel_api_key')
    .eq('user_id', user.id)
    .single()

  if (!settings?.parcelpanel_api_key) {
    return NextResponse.json({ error: 'ParcelPanel not connected', connected: false }, { status: 200 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || ''
  const page = searchParams.get('page') || 1
  const limit = searchParams.get('limit') || 20

  const params = new URLSearchParams({
    page,
    limit,
    ...(status && { transit_status: status }),
  })

  const res = await fetch(
    `https://www.parcelpanel.com/api/open/v2/trackings?${params.toString()}`,
    {
      headers: {
        'pp-api-key': settings.parcelpanel_api_key,
        'Content-Type': 'application/json',
      },
    }
  )

  const data = await res.json()
  if (!res.ok) {
    return NextResponse.json({ error: data.message || 'ParcelPanel error' }, { status: 502 })
  }

  // Normalize shipments
  const shipments = (data.data?.trackings || []).map(t => ({
    id: t.id,
    trackingNumber: t.tracking_number,
    courier: t.courier_name,
    status: t.transit_status,
    statusText: t.transit_status_text,
    lastUpdate: t.last_event_time,
    lastLocation: t.latest_event?.location || '',
    lastMessage: t.latest_event?.message || '',
    estimatedDelivery: t.estimated_delivery,
    orderNumber: t.order_number,
    customerEmail: t.customer_email,
    customerName: t.customer_name,
    destination: t.destination_country,
    daysInTransit: t.days_in_transit,
    failedAttempts: t.failed_attempts || 0,
    pickupExpiry: t.pickup_expiry_date || null,
  }))

  // Summary counts
  const summary = {
    total: data.data?.total || 0,
    inTransit: data.data?.in_transit || 0,
    delivered: data.data?.delivered || 0,
    failedAttempt: data.data?.failed_attempt || 0,
    pickupPoint: data.data?.pickup_point || 0,
    expired: data.data?.expired || 0,
    exception: data.data?.exception || 0,
  }

  return NextResponse.json({
    connected: true,
    shipments,
    summary,
    page: data.data?.page || 1,
    totalPages: Math.ceil((data.data?.total || 0) / limit),
  })
}
