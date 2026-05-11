// types/inbox.ts

export interface Thread {
  id: string
  subject: string
  snippet: string
  from: string
  from_email: string
  from_name: string
  customer_email?: string
  customer_name?: string
  status: 'open' | 'pending' | 'resolved' | 'unlinked' | 'trash' | 'closed'
  created_at: string
  updated_at: string
  last_message_at?: string
  date: string
  unread: boolean
  is_unread?: boolean
}

export interface Message {
  id: string
  thread_id: string
  from: string
  from_email: string
  from_name: string
  body: string
  body_html?: string
  body_text?: string
  direction: 'inbound' | 'outbound'
  sent_at?: string
  created_at: string
  date: string
}

export interface Note {
  id: string
  thread_id: string
  body: string
  author_name: string
  created_at: string
}

export interface ShopifyAddress {
  address1: string
  address2?: string
  city: string
  province: string
  zip: string
  country: string
  name?: string
  first_name?: string
  last_name?: string
  phone?: string
}

export interface ShopifyLineItem {
  id: string
  title: string
  quantity: number
  price: string
  sku?: string
  variant_title?: string
}

export interface ShopifyOrder {
  id: string
  name: string
  created_at: string
  financial_status: string
  fulfillment_status: string | null
  total_price: string
  currency: string
  line_items: ShopifyLineItem[]
  shipping_address: ShopifyAddress | null
  note: string | null
}

export interface ShopifyCustomer {
  id: string
  email: string
  first_name: string
  last_name: string
  phone: string | null
  orders_count: number
  total_spent: string
  addresses: ShopifyAddress[]
  orders: ShopifyOrder[]
}

export interface MacroTagObject {
  id?: string
  name: string
  color: string
}

export interface Macro {
  id: string
  name: string
  content?: string
  body?: string
  tags: string[]
  tagObjects?: MacroTagObject[]
  language: string
  variables?: string[]
  usageCount?: number
  usage_count?: number
  updatedAt?: string
  updated_at?: string
  last_updated_relative?: string | null
  archived: boolean
  archived_at?: string | null
  created_at?: string
}

export interface TicketMeta {
  tags: string[]
  assignee: string | null
  contactReason: string | null
  product: string | null
  resolution: string | null
}

export type InboxFolder = 'open' | 'pending' | 'resolved' | 'unlinked' | 'trash'

export interface FolderCounts {
  open: number
  pending: number
  resolved: number
  unlinked: number
  trash: number
}
