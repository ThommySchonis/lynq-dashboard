import { assertEquals } from '@std/assert'
import {
  createDraftOrderWithInvoice,
  sendDraftOrderInvoice,
} from '../lib/services/shopify.ts'

const CREDS = { domain: 'test-shop.myshopify.com', accessToken: 'token' } as unknown as Parameters<
  typeof sendDraftOrderInvoice
>[0]

interface Call {
  url: string
  body?: unknown
}

function withMockFetch(opts: { invoiceStatus?: number; calls: Call[] }): () => void {
  const orig = globalThis.fetch
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const body = init?.body ? JSON.parse(init.body as string) : undefined
    opts.calls.push({ url, body })
    if (url.includes('/send_invoice.json')) {
      return new Response(
        JSON.stringify({ draft_order_invoice: { to: 'buyer@example.com' } }),
        { status: opts.invoiceStatus ?? 200, headers: { 'Content-Type': 'application/json' } },
      )
    }
    return new Response(
      JSON.stringify({ draft_order: { id: 1, name: '#D1', invoice_url: 'x' } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }
  return () => {
    globalThis.fetch = orig
  }
}

Deno.test('sendDraftOrderInvoice: omits blank subject and message', async () => {
  const calls: Call[] = []
  const restore = withMockFetch({ calls })
  try {
    await sendDraftOrderInvoice(CREDS, 1, { subject: '  ', customMessage: '' })
    assertEquals(calls.length, 1)
    const inv = (calls[0].body as { draft_order_invoice: Record<string, unknown> }).draft_order_invoice
    assertEquals(inv, {})
  } finally {
    restore()
  }
})

Deno.test('sendDraftOrderInvoice: includes provided subject and message', async () => {
  const calls: Call[] = []
  const restore = withMockFetch({ calls })
  try {
    await sendDraftOrderInvoice(CREDS, 1, { subject: 'Your invoice', customMessage: 'Thanks!' })
    const inv = (calls[0].body as { draft_order_invoice: Record<string, unknown> }).draft_order_invoice
    assertEquals(inv, { subject: 'Your invoice', custom_message: 'Thanks!' })
  } finally {
    restore()
  }
})

Deno.test('createDraftOrderWithInvoice: invoiceSent true when both succeed', async () => {
  const calls: Call[] = []
  const restore = withMockFetch({ calls })
  try {
    const result = await createDraftOrderWithInvoice(CREDS, {
      customerId: '42',
      lineItems: [{ variantId: '100', quantity: 1 }],
    })
    assertEquals(result.invoiceSent, true)
    assertEquals(result.draftOrder.name, '#D1')
    assertEquals(result.invoiceError, undefined)
    assertEquals(calls.length, 2)
  } finally {
    restore()
  }
})

Deno.test('createDraftOrderWithInvoice: keeps draft and flags failure when invoice send fails', async () => {
  const calls: Call[] = []
  const restore = withMockFetch({ calls, invoiceStatus: 422 })
  try {
    const result = await createDraftOrderWithInvoice(CREDS, {
      customerId: '42',
      lineItems: [{ variantId: '100', quantity: 1 }],
    })
    assertEquals(result.invoiceSent, false)
    assertEquals(result.draftOrder.name, '#D1')
    assertEquals(typeof result.invoiceError, 'string')
  } finally {
    restore()
  }
})
