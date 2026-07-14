import { describe, it, expect, vi, beforeEach } from 'vitest'

// createDraftOrder / sendDraftOrderInvoice now use the GraphQL draftOrderCreate /
// draftOrderInvoiceSend mutations via the shared shopifyGraphQL helper — mock it
// so we can assert the exact mutation variables and exercise the userErrors ->
// throw path without a real network call.
const graphql = vi.fn()
vi.mock('@/lib/services/shopify-graphql', () => ({
  shopifyGraphQL: (...args: unknown[]): unknown => graphql(...args),
  SHOPIFY_GRAPHQL_VERSION: '2025-04',
}))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }))

import {
  createDraftOrder,
  sendDraftOrderInvoice,
  createDraftOrderWithInvoice,
} from '@/lib/services/shopify-draft-orders'
import { ShopifyApiError } from '@/lib/services/shopify-core'
import { logger } from '@/lib/logger'

const creds = { domain: 'shop.myshopify.com', accessToken: 't' }

beforeEach(() => {
  graphql.mockReset()
})

describe('createDraftOrder', () => {
  const draftOrderCreateResponse = {
    draftOrderCreate: {
      draftOrder: { id: 'gid://shopify/DraftOrder/9001', name: '#D1', invoiceUrl: 'https://shop.example/invoice/abc' },
      userErrors: [],
    },
  }

  it('throws when neither a customer id nor an email is provided, without calling GraphQL', async () => {
    const promise = createDraftOrder(creds, { lineItems: [{ variantId: '100', quantity: 1 }] })
    await expect(promise).rejects.toThrow(/customer id or email/)
    expect(graphql.mock.calls.length).toBe(0)
  })

  it('builds DraftOrderInput.lineItems (variantId gid + quantity) from the numeric legacy variant id and maps the created draft order to {id, name, invoiceUrl}', async () => {
    graphql.mockResolvedValueOnce(draftOrderCreateResponse)

    const result = await createDraftOrder(creds, {
      customerId: '42',
      lineItems: [
        { variantId: '100', quantity: 2 },
        { variantId: '200', quantity: 1 },
      ],
    })

    const [, , variables] = graphql.mock.calls[0] as [unknown, string, { input: Record<string, unknown> }]
    expect(variables.input.lineItems).toEqual([
      { variantId: 'gid://shopify/ProductVariant/100', quantity: 2 },
      { variantId: 'gid://shopify/ProductVariant/200', quantity: 1 },
    ])

    // gid -> numeric id, same as the old REST draft_order.id
    expect(result).toEqual({ id: 9001, name: '#D1', invoiceUrl: 'https://shop.example/invoice/abc' })
  })

  it('attaches the customer via purchasingEntity.customerId (DraftOrderInput.customerId is deprecated) and omits email', async () => {
    graphql.mockResolvedValueOnce(draftOrderCreateResponse)

    await createDraftOrder(creds, { customerId: '42', lineItems: [{ variantId: '100', quantity: 1 }] })

    const [, , variables] = graphql.mock.calls[0] as [unknown, string, { input: Record<string, unknown> }]
    expect(variables.input.purchasingEntity).toEqual({ customerId: 'gid://shopify/Customer/42' })
    expect('email' in variables.input).toBe(false)
  })

  it('uses the trimmed email and omits purchasingEntity when no customer id is provided', async () => {
    graphql.mockResolvedValueOnce(draftOrderCreateResponse)

    await createDraftOrder(creds, { email: '  buyer@example.com  ', lineItems: [{ variantId: '100', quantity: 1 }] })

    const [, , variables] = graphql.mock.calls[0] as [unknown, string, { input: Record<string, unknown> }]
    expect(variables.input.email).toBe('buyer@example.com')
    expect('purchasingEntity' in variables.input).toBe(false)
  })

  it('includes note only when provided', async () => {
    graphql.mockResolvedValueOnce(draftOrderCreateResponse)
    await createDraftOrder(creds, { customerId: '42', lineItems: [{ variantId: '100', quantity: 1 }], note: 'Gift wrap' })
    const [, , variables] = graphql.mock.calls[0] as [unknown, string, { input: Record<string, unknown> }]
    expect(variables.input.note).toBe('Gift wrap')

    graphql.mockReset()
    graphql.mockResolvedValueOnce(draftOrderCreateResponse)
    await createDraftOrder(creds, { customerId: '42', lineItems: [{ variantId: '100', quantity: 1 }] })
    const [, , variables2] = graphql.mock.calls[0] as [unknown, string, { input: Record<string, unknown> }]
    expect('note' in variables2.input).toBe(false)
  })

  it('maps shippingAddress 1:1 onto MailingAddressInput when provided', async () => {
    graphql.mockResolvedValueOnce(draftOrderCreateResponse)

    await createDraftOrder(creds, {
      customerId: '42',
      lineItems: [{ variantId: '100', quantity: 1 }],
      shippingAddress: {
        firstName: 'John',
        lastName: 'Doe',
        address1: '123 Main St',
        address2: 'Apt 4',
        city: 'Berlin',
        province: 'Berlin',
        country: 'Germany',
        zip: '10115',
        phone: '+491234567',
      },
    })

    const [, , variables] = graphql.mock.calls[0] as [unknown, string, { input: Record<string, unknown> }]
    expect(variables.input.shippingAddress).toEqual({
      firstName: 'John',
      lastName: 'Doe',
      address1: '123 Main St',
      address2: 'Apt 4',
      city: 'Berlin',
      province: 'Berlin',
      country: 'Germany',
      zip: '10115',
      phone: '+491234567',
    })
  })

  it('omits shippingAddress when not provided', async () => {
    graphql.mockResolvedValueOnce(draftOrderCreateResponse)
    await createDraftOrder(creds, { customerId: '42', lineItems: [{ variantId: '100', quantity: 1 }] })
    const [, , variables] = graphql.mock.calls[0] as [unknown, string, { input: Record<string, unknown> }]
    expect('shippingAddress' in variables.input).toBe(false)
  })

  it.each([
    ['percentage', 'PERCENTAGE', '10% discount'],
    ['fixed', 'FIXED_AMOUNT', '10 discount'],
  ] as const)('maps discount.type %s -> DraftOrderAppliedDiscountType %s, preserving the REST title text', async (type, expectedValueType, expectedTitle) => {
    graphql.mockResolvedValueOnce(draftOrderCreateResponse)

    await createDraftOrder(creds, {
      customerId: '42',
      lineItems: [{ variantId: '100', quantity: 1 }],
      discount: { type, value: 10 },
    })

    const [, , variables] = graphql.mock.calls[0] as [unknown, string, { input: Record<string, unknown> }]
    expect(variables.input.appliedDiscount).toEqual({
      description: 'Discount',
      valueType: expectedValueType,
      value: 10, // Float, not the REST String(value)
      title: expectedTitle,
    })
  })

  it('omits appliedDiscount when no discount is provided', async () => {
    graphql.mockResolvedValueOnce(draftOrderCreateResponse)
    await createDraftOrder(creds, { customerId: '42', lineItems: [{ variantId: '100', quantity: 1 }] })
    const [, , variables] = graphql.mock.calls[0] as [unknown, string, { input: Record<string, unknown> }]
    expect('appliedDiscount' in variables.input).toBe(false)
  })

  it('throws ShopifyApiError when draftOrderCreate returns userErrors, same failure mode as a non-2xx REST response', async () => {
    graphql.mockResolvedValueOnce({
      draftOrderCreate: { draftOrder: null, userErrors: [{ field: ['lineItems'], message: 'Variant is no longer available' }] },
    })

    const promise = createDraftOrder(creds, { customerId: '42', lineItems: [{ variantId: '100', quantity: 1 }] })
    await expect(promise).rejects.toBeInstanceOf(ShopifyApiError)
    await expect(promise).rejects.toThrow(/no longer available/)
  })
})

describe('sendDraftOrderInvoice', () => {
  const okResponse = {
    draftOrderInvoiceSend: { draftOrder: { id: 'gid://shopify/DraftOrder/1' }, userErrors: [] },
  }

  it('sends the draftOrderInvoiceSend mutation with the gid id and resolves (void, same as the old REST return)', async () => {
    graphql.mockResolvedValueOnce(okResponse)

    const result = await sendDraftOrderInvoice(creds, 1, { subject: 'Your invoice', customMessage: 'Thanks!' })

    expect(result).toBeUndefined()
    const [, , variables] = graphql.mock.calls[0] as [unknown, string, { id: string; email: Record<string, unknown> }]
    expect(variables.id).toBe('gid://shopify/DraftOrder/1')
    expect(variables.email).toEqual({ subject: 'Your invoice', customMessage: 'Thanks!' })
  })

  it('includes `to` only when non-empty after trimming', async () => {
    graphql.mockResolvedValueOnce(okResponse)
    await sendDraftOrderInvoice(creds, 1, { to: '  buyer@example.com  ' })
    const [, , variables] = graphql.mock.calls[0] as [unknown, string, { email: Record<string, unknown> }]
    expect(variables.email).toEqual({ to: 'buyer@example.com' })
  })

  it('omits blank/whitespace-only subject and customMessage, sending an empty EmailInput', async () => {
    graphql.mockResolvedValueOnce(okResponse)
    await sendDraftOrderInvoice(creds, 1, { subject: '  ', customMessage: '' })
    const [, , variables] = graphql.mock.calls[0] as [unknown, string, { email: Record<string, unknown> }]
    expect(variables.email).toEqual({})
  })

  it('defaults to an empty EmailInput when no opts are given', async () => {
    graphql.mockResolvedValueOnce(okResponse)
    await sendDraftOrderInvoice(creds, 1)
    const [, , variables] = graphql.mock.calls[0] as [unknown, string, { email: Record<string, unknown> }]
    expect(variables.email).toEqual({})
  })

  it('throws ShopifyApiError when draftOrderInvoiceSend returns userErrors, same failure mode as a non-2xx REST response', async () => {
    graphql.mockResolvedValueOnce({
      draftOrderInvoiceSend: { draftOrder: null, userErrors: [{ field: ['email', 'to'], message: 'Email is invalid' }] },
    })

    const promise = sendDraftOrderInvoice(creds, 1, { to: 'not-an-email' })
    await expect(promise).rejects.toBeInstanceOf(ShopifyApiError)
    await expect(promise).rejects.toThrow(/Email is invalid/)
  })
})

describe('createDraftOrderWithInvoice', () => {
  const draftOrderCreateResponse = {
    draftOrderCreate: {
      draftOrder: { id: 'gid://shopify/DraftOrder/9001', name: '#D1', invoiceUrl: 'https://shop.example/invoice/abc' },
      userErrors: [],
    },
  }
  const invoiceOkResponse = {
    draftOrderInvoiceSend: { draftOrder: { id: 'gid://shopify/DraftOrder/9001' }, userErrors: [] },
  }

  it('creates the draft then sends the invoice; returns invoiceSent:true on success', async () => {
    graphql.mockResolvedValueOnce(draftOrderCreateResponse).mockResolvedValueOnce(invoiceOkResponse)

    const result = await createDraftOrderWithInvoice(creds, {
      customerId: '42',
      lineItems: [{ variantId: '100', quantity: 1 }],
      invoiceSubject: 'Your invoice',
      invoiceMessage: 'Thanks!',
    })

    expect(graphql.mock.calls.length).toBe(2)
    expect(result).toEqual({
      draftOrder: { id: 9001, name: '#D1', invoiceUrl: 'https://shop.example/invoice/abc' },
      invoiceSent: true,
    })

    const [, , invoiceVars] = graphql.mock.calls[1] as [unknown, string, { id: string; email: Record<string, unknown> }]
    expect(invoiceVars.id).toBe('gid://shopify/DraftOrder/9001')
    expect(invoiceVars.email).toEqual({ subject: 'Your invoice', customMessage: 'Thanks!' })
  })

  it('BEST-EFFORT: keeps the draft order and returns invoiceSent:false + invoiceError when the invoice send fails (userErrors)', async () => {
    graphql.mockResolvedValueOnce(draftOrderCreateResponse).mockResolvedValueOnce({
      draftOrderInvoiceSend: { draftOrder: null, userErrors: [{ field: null, message: 'Draft order has already been invoiced' }] },
    })

    const result = await createDraftOrderWithInvoice(creds, {
      customerId: '42',
      lineItems: [{ variantId: '100', quantity: 1 }],
    })

    expect(result.invoiceSent).toBe(false)
    expect(result.draftOrder).toEqual({ id: 9001, name: '#D1', invoiceUrl: 'https://shop.example/invoice/abc' })
    expect(result.invoiceError).toMatch(/already been invoiced/)
    expect(logger.warn).toHaveBeenCalledWith(
      '[shopify-draft-orders]',
      'invoice send failed; draft kept',
      expect.objectContaining({ draftOrderId: 9001 })
    )
  })

  it('BEST-EFFORT: keeps the draft order when the invoice send throws a transport error', async () => {
    graphql.mockResolvedValueOnce(draftOrderCreateResponse).mockRejectedValueOnce(new Error('network boom'))

    const result = await createDraftOrderWithInvoice(creds, {
      customerId: '42',
      lineItems: [{ variantId: '100', quantity: 1 }],
    })

    expect(result.invoiceSent).toBe(false)
    expect(result.invoiceError).toBe('network boom')
    expect(result.draftOrder).toEqual({ id: 9001, name: '#D1', invoiceUrl: 'https://shop.example/invoice/abc' })
  })

  it('propagates a draftOrderCreate userErrors throw without attempting the invoice send', async () => {
    graphql.mockResolvedValueOnce({
      draftOrderCreate: { draftOrder: null, userErrors: [{ field: ['lineItems'], message: 'Variant is no longer available' }] },
    })

    const promise = createDraftOrderWithInvoice(creds, { customerId: '42', lineItems: [{ variantId: '100', quantity: 1 }] })
    await expect(promise).rejects.toBeInstanceOf(ShopifyApiError)
    expect(graphql.mock.calls.length).toBe(1)
  })
})
