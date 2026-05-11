export type ShipmentStatusKey =
  | 'PENDING' | 'INFO_RECEIVED' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY'
  | 'DELIVERED' | 'EXCEPTION' | 'FAILED_ATTEMPT' | 'EXPIRED'

export interface StatusConfig {
  label: string
  color: string
  bg: string
  border: string
}

export type AttentionType =
  | 'FAILED_ATTEMPT' | 'PICKUP_REQUIRED' | 'EXCEPTION' | 'OVERDUE' | 'EXPIRED'

export interface AttentionConfig {
  label: string
  desc: string
  color: string
  bg: string
  border: string
  priority: number
  message: (name: string, num: string) => string
}

export interface Checkpoint {
  status: string
  detail: string
  location?: string
  checkpoint_time: string
}

export interface Shipment {
  status: string
  carrier_name?: string
  carrier_logo?: string
  tracking_number?: string
  checkpoints?: Checkpoint[]
  last_mile?: {
    carrier_name?: string
    carrier_logo_url?: string
    name?: string
    logo_url?: string
  }
  carrier?: {
    carrier_name?: string
    name?: string
    logo_url?: string
  }
  products?: { name?: string; title?: string; quantity?: number }[]
  transit_time?: number
  delivery_date?: string
  fulfillment_date?: string
  estimated_delivery_date?: string
}

export interface Order {
  id: string
  order_number: string
  customer?: {
    name?: string
    email?: string
    phone?: string
  }
  products?: string[]
  created_at: string
  shipments?: Shipment[]
  shipping_address?: {
    name?: string
    city?: string
    province?: string
    country?: string
    zip?: string
    province_code?: string
  }
  tracking_link?: string
}

export interface AttentionItem {
  key: string
  order: Order
  shipment: Shipment
  type: AttentionType
  daysSince: number | null
  lastDetail: string
  cfg: AttentionConfig
}

export type SupplyChainFilter = 'All' | 'Needs Attention' | 'In Transit' | 'Out for Delivery' | 'Exception' | 'Delivered' | 'Pending'

export interface ParcelPanelSetup {
  connected: boolean
  apiKey?: string
}
