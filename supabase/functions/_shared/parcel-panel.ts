// supabase/functions/_shared/parcel-panel.ts
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ParcelPanel v2 API — centralized base + auth header.
// NOTE: existing connect code uses this header; confirm against a real key in Task 4.
export const PARCELPANEL_BASE = 'https://open.parcelwill.com'
export const PARCELPANEL_API_HEADER = 'Parcel-Panel-Api-Token'

// ── Frontend-facing shapes (MUST stay aligned with types/supply-chain.ts) ──
export interface TrackingCheckpoint {
  status: string
  detail: string
  location?: string
  checkpoint_time: string
}
export interface TrackingShipment {
  status: string
  carrier_name?: string
  carrier_logo?: string
  tracking_number?: string
  checkpoints?: TrackingCheckpoint[]
  carrier?: { carrier_name?: string; name?: string; logo_url?: string }
  products?: { name?: string; title?: string; quantity?: number }[]
  transit_time?: number
  delivery_date?: string
  fulfillment_date?: string
  estimated_delivery_date?: string
}
export interface TrackingOrder {
  id: string
  order_number: string
  customer?: { name?: string; email?: string; phone?: string }
  created_at: string
  shipments?: TrackingShipment[]
  shipping_address?: {
    name?: string; city?: string; province?: string
    province_code?: string; country?: string; zip?: string
  }
  tracking_link?: string
}

// ── Raw ParcelPanel payload (documented v2 fields) ──
interface RawCarrier { name?: string; code?: string; logo?: string; url?: string }
interface RawCheckpoint { status?: string; detail?: string; location?: string; checkpoint_time?: string }
interface RawProduct { title?: string; quantity?: number }
interface RawShipment {
  status?: string
  status_label?: string
  tracking_number?: string
  carrier?: RawCarrier
  checkpoints?: RawCheckpoint[]
  products?: RawProduct[]
  transit_time?: number
  delivery_date?: string
  fulfillment_date?: string
  estimated_delivery_date?: string | { source?: string; display_text?: string }
}
interface RawShippingAddress {
  name?: string; city?: string; province?: string
  province_code?: string; country?: string; zip?: string
}
export interface ParcelPanelPayload {
  order_id?: string | number
  order_number?: string
  order_date?: string
  customer?: { name?: string; email?: string; phone?: string }
  shipping_address?: RawShippingAddress
  tracking_link?: string
  shipments?: RawShipment[]
}

function estimatedDelivery(v: RawShipment['estimated_delivery_date']): string | undefined {
  if (!v) return undefined
  return typeof v === 'string' ? v : v.display_text
}

function mapShipment(s: RawShipment): TrackingShipment {
  return {
    status: s.status ?? 'PENDING',
    tracking_number: s.tracking_number,
    carrier_name: s.carrier?.name,
    carrier_logo: s.carrier?.logo,
    carrier: s.carrier
      ? { name: s.carrier.name, carrier_name: s.carrier.name, logo_url: s.carrier.logo }
      : undefined,
    checkpoints: [...(s.checkpoints ?? [])]
      .sort((a, b) => (b.checkpoint_time ?? '').localeCompare(a.checkpoint_time ?? ''))
      .map((c) => ({
        status: c.status ?? '',
        detail: c.detail ?? '',
        location: c.location,
        checkpoint_time: c.checkpoint_time ?? '',
      })),
    products: (s.products ?? []).map((p) => ({ title: p.title, name: p.title, quantity: p.quantity })),
    transit_time: s.transit_time,
    delivery_date: s.delivery_date,
    fulfillment_date: s.fulfillment_date,
    estimated_delivery_date: estimatedDelivery(s.estimated_delivery_date),
  }
}

/** One TrackingOrder per shipment with a tracking number (keyed later by tracking_number). */
export function mapPayloadToOrders(p: ParcelPanelPayload): TrackingOrder[] {
  const base: Omit<TrackingOrder, 'shipments'> = {
    id: String(p.order_id ?? p.order_number ?? ''),
    order_number: p.order_number ?? '',
    customer: p.customer
      ? { name: p.customer.name, email: p.customer.email, phone: p.customer.phone }
      : undefined,
    created_at: p.order_date ?? new Date().toISOString(),
    shipping_address: p.shipping_address
      ? {
          name: p.shipping_address.name,
          city: p.shipping_address.city,
          province: p.shipping_address.province,
          province_code: p.shipping_address.province_code,
          country: p.shipping_address.country,
          zip: p.shipping_address.zip,
        }
      : undefined,
    tracking_link: p.tracking_link,
  }
  return (p.shipments ?? [])
    .filter((s) => s.tracking_number)
    .map((s) => ({ ...base, shipments: [mapShipment(s)] }))
}

function toTimestamp(v: string | undefined): string | null {
  if (!v) return null
  const t = Date.parse(v)
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}

/** Upsert TrackingOrders into `shipments` (one row per tracking_number). Returns rows written. */
export async function persistTrackingOrders(
  sb: SupabaseClient,
  workspaceId: string,
  orders: TrackingOrder[],
): Promise<number> {
  let count = 0
  for (const order of orders) {
    const s = order.shipments?.[0]
    if (!s?.tracking_number) continue
    const { error } = await sb.from('shipments').upsert(
      {
        workspace_id: workspaceId,
        order_number: order.order_number || null,
        tracking_number: s.tracking_number,
        carrier: s.carrier_name ?? s.carrier?.name ?? null,
        status: s.status,
        customer_name: order.customer?.name ?? null,
        estimated_delivery: toTimestamp(s.estimated_delivery_date),
        last_updated: new Date().toISOString(),
        raw_data: order,
      },
      { onConflict: 'workspace_id,tracking_number' },
    )
    if (error) {
      console.error('[parcel-panel] shipments upsert failed', error.message)
    } else {
      count++
    }
  }
  return count
}

/** Stable idempotency key: dedupe identical deliveries, reprocess on status/checkpoint change. */
export function extractParcelEventId(body: unknown): string | null {
  const p = body as ParcelPanelPayload
  const s = p?.shipments?.[0]
  if (!s?.tracking_number) return p?.order_number ?? null
  const times = (s.checkpoints ?? []).map((c) => c.checkpoint_time ?? '').filter(Boolean)
  const last = times.length ? times.reduce((a, b) => (a > b ? a : b)) : ''
  const count = s.checkpoints?.length ?? 0
  return `${s.tracking_number}:${s.status ?? ''}:${last}:${count}`
}

/** Local lookup for inbox enrichment — reads `shipments` only, no ParcelPanel API call. */
export async function getTrackingsByOrderNumbers(
  sb: SupabaseClient,
  workspaceId: string,
  orderNumbers: string[],
): Promise<Record<string, TrackingOrder[]>> {
  const numbers = [...new Set(orderNumbers.filter(Boolean))]
  if (numbers.length === 0) return {}
  const { data } = await sb
    .from('shipments')
    .select('order_number, raw_data')
    .eq('workspace_id', workspaceId)
    .in('order_number', numbers)
  const map: Record<string, TrackingOrder[]> = {}
  for (const row of (data ?? []) as { order_number: string | null; raw_data: TrackingOrder | null }[]) {
    if (!row.order_number || !row.raw_data) continue
    ;(map[row.order_number] ??= []).push(row.raw_data)
  }
  return map
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Backfill recent Shopify orders' tracking from ParcelPanel (throttled under 120 req/min). */
export async function backfillTrackings(
  sb: SupabaseClient,
  workspaceId: string,
  apiKey: string,
  opts?: { sinceDays?: number },
): Promise<{ processed: number; total: number }> {
  const sinceDays = opts?.sinceDays ?? 90
  const sinceIso = new Date(Date.now() - sinceDays * 86400000).toISOString()
  const { data: rows } = await sb
    .from('shopify_orders')
    .select('order_number')
    .eq('workspace_id', workspaceId)
    .gte('created_at_shopify', sinceIso)
  const orderNumbers = [
    ...new Set(
      ((rows ?? []) as { order_number: string | null }[])
        .map((r) => r.order_number)
        .filter((n): n is string => !!n),
    ),
  ]
  let processed = 0
  for (const orderNumber of orderNumbers) {
    try {
      const res = await fetch(
        `${PARCELPANEL_BASE}/api/v2/tracking/order?order_number=${encodeURIComponent(orderNumber)}`,
        { headers: { [PARCELPANEL_API_HEADER]: apiKey } },
      )
      if (res.status === 429) { await sleep(60000); continue }
      if (!res.ok) { await sleep(520); continue } // 404 = no tracking yet; skip quietly
      const payload = (await res.json()) as ParcelPanelPayload
      processed += await persistTrackingOrders(sb, workspaceId, mapPayloadToOrders(payload))
      await sleep(520) // ~115 req/min
    } catch (e) {
      console.error('[parcel-panel] backfill order failed', e instanceof Error ? e.message : String(e))
      await sleep(520)
    }
  }
  return { processed, total: orderNumbers.length }
}
