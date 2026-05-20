import type { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthContext } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { parseJson } from '@/lib/utils/typed-json'
import { validateQuery } from '@/lib/validation'
import { shipmentsQuery } from '@/lib/schemas/parcel-panel'

interface ParcelPanelSettings {
  parcelpanel_api_key?: string
}

// GET /api/parcelpanel/shipments?status=failed_attempt&page=1
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [query, queryErr] = validateQuery(request, shipmentsQuery)
  if (queryErr) return queryErr

  const storeId = query.store_id

  // Get ParcelPanel API key for this store
  const { data: settings } = await supabaseAdmin
    .from('integrations')
    .select('parcelpanel_api_key')
    .eq('store_id', storeId)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  const ppApiKey = (settings as ParcelPanelSettings | null)?.parcelpanel_api_key
  if (!ppApiKey) {
    return NextResponse.json({ error: 'ParcelPanel not connected', connected: false }, { status: 200 })
  }

  const allowedStatuses = new Set(['', 'pending', 'info_received', 'in_transit', 'out_for_delivery', 'failed_attempt', 'delivered', 'exception', 'expired', 'pickup_point'])
  const status = query.status || ''
  if (!allowedStatuses.has(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }
  const page = query.page ?? 1
  const limit = Math.min(Math.max(query.limit ?? 20, 1), 100)

  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    ...(status && { transit_status: status }),
  })

  const res = await fetch(
    `https://www.parcelpanel.com/api/open/v2/trackings?${params.toString()}`,
    {
      headers: {
        'pp-api-key': ppApiKey,
        'Content-Type': 'application/json',
      },
    }
  )

  interface PPResponse { message?: string; data?: { trackings?: Record<string, unknown>[]; total?: number; in_transit?: number; delivered?: number; failed_attempt?: number; pickup_point?: number; expired?: number; exception?: number; page?: number } }
  const data = await parseJson<PPResponse>(res)
  if (!res.ok) {
    return NextResponse.json({ error: data.message || 'ParcelPanel error' }, { status: 502 })
  }

  // Normalize shipments
  const shipments = ((data.data?.trackings || []) as Record<string, unknown>[]).map(t => {
    const latestEvent = t.latest_event as Record<string, unknown> | undefined
    return {
      id: t.id,
      trackingNumber: t.tracking_number,
      courier: t.courier_name,
      status: t.transit_status,
      statusText: t.transit_status_text,
      lastUpdate: t.last_event_time,
      lastLocation: (latestEvent?.location as string) || '',
      lastMessage: (latestEvent?.message as string) || '',
      estimatedDelivery: t.estimated_delivery,
      orderNumber: t.order_number,
      customerEmail: t.customer_email,
      customerName: t.customer_name,
      destination: t.destination_country,
      daysInTransit: t.days_in_transit,
      failedAttempts: (t.failed_attempts as number) || 0,
      pickupExpiry: t.pickup_expiry_date || null,
    }
  })

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
