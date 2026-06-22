import { shopifyFetchJSON } from './shopify-core'
import type {
  ShopifyCredentials,
  ShopifyDraftOrderResponse,
  CreateDraftOrderParams,
} from './shopify-types'

/**
 * Create a Shopify draft order for an existing customer.
 * Used by the inbox CreateOrderModal.
 */
export async function createDraftOrder(
  credentials: ShopifyCredentials,
  params: CreateDraftOrderParams
) {
  const email = params.email?.trim()
  if (!params.customerId && !email) {
    throw new Error('createDraftOrder requires a customer id or email')
  }

  const draftOrder: Record<string, unknown> = {
    line_items: params.lineItems.map((li) => ({
      variant_id: Number(li.variantId),
      quantity: li.quantity,
    })),
  }

  if (params.customerId) {
    draftOrder.customer = { id: Number(params.customerId) }
  } else {
    draftOrder.email = email
  }

  if (params.note) draftOrder.note = params.note

  if (params.shippingAddress) {
    const a = params.shippingAddress
    draftOrder.shipping_address = {
      first_name: a.firstName,
      last_name: a.lastName,
      address1: a.address1,
      address2: a.address2,
      city: a.city,
      province: a.province,
      country: a.country,
      zip: a.zip,
      phone: a.phone,
    }
  }

  if (params.discount) {
    draftOrder.applied_discount = {
      description: 'Discount',
      value_type:
        params.discount.type === 'percentage' ? 'percentage' : 'fixed_amount',
      value: String(params.discount.value),
      title:
        params.discount.type === 'percentage'
          ? `${params.discount.value}% discount`
          : `${params.discount.value} discount`,
    }
  }

  const data = await shopifyFetchJSON<ShopifyDraftOrderResponse>(
    credentials,
    '/draft_orders.json',
    {
      method: 'POST',
      body: JSON.stringify({ draft_order: draftOrder }),
    }
  )

  return {
    id: data.draft_order?.id,
    name: data.draft_order?.name,
    invoiceUrl: data.draft_order?.invoice_url,
  }
}
