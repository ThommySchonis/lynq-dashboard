import { shopifyFetchJSON } from './shopify-core'
import { logger } from '@/lib/logger'
import type {
  ShopifyCredentials,
  ShopifyDraftOrderResponse,
  ShopifyDraftOrderInvoiceResponse,
  CreateDraftOrderParams,
  DraftOrderWithInvoiceResult,
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

export async function sendDraftOrderInvoice(
  credentials: ShopifyCredentials,
  draftOrderId: number,
  opts: { to?: string; subject?: string; customMessage?: string } = {}
): Promise<void> {
  const invoice: Record<string, unknown> = {}
  if (opts.to?.trim()) invoice.to = opts.to.trim()
  if (opts.subject?.trim()) invoice.subject = opts.subject.trim()
  if (opts.customMessage?.trim()) invoice.custom_message = opts.customMessage.trim()

  await shopifyFetchJSON<ShopifyDraftOrderInvoiceResponse>(
    credentials,
    `/draft_orders/${draftOrderId}/send_invoice.json`,
    { method: 'POST', body: JSON.stringify({ draft_order_invoice: invoice }) }
  )
}

export async function createDraftOrderWithInvoice(
  credentials: ShopifyCredentials,
  params: CreateDraftOrderParams
): Promise<DraftOrderWithInvoiceResult> {
  const draftOrder = await createDraftOrder(credentials, params)

  if (!draftOrder.id) {
    return { draftOrder, invoiceSent: false, invoiceError: 'Draft order has no id' }
  }

  try {
    await sendDraftOrderInvoice(credentials, draftOrder.id, {
      subject: params.invoiceSubject,
      customMessage: params.invoiceMessage,
    })
    return { draftOrder, invoiceSent: true }
  } catch (err) {
    const invoiceError = err instanceof Error ? err.message : 'Invoice send failed'
    logger.warn('[shopify-draft-orders]', 'invoice send failed; draft kept', {
      draftOrderId: draftOrder.id,
      error: invoiceError,
    })
    return { draftOrder, invoiceSent: false, invoiceError }
  }
}
