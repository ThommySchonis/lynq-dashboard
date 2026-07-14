import { assertEquals } from '@std/assert'
import {
  createDraftOrderWithInvoice,
  sendDraftOrderInvoice,
} from '../lib/services/shopify.ts'

const CREDS = { domain: 'test-shop.myshopify.com', accessToken: 'token' } as unknown as Parameters<
  typeof sendDraftOrderInvoice
>[0]

interface Call {
  body?: { query: string; variables: Record<string, unknown> }
}

// sendDraftOrderInvoice / createDraftOrderWithInvoice now use the
// draftOrderCreate / draftOrderInvoiceSend GraphQL mutations via the shared
// shopifyGraphQL helper. Queue GraphQL payloads by call order (create, then
// invoice send) and record each request body.
function withQueuedGraphql(opts: { invoiceUserErrors?: Array<{ field: string[] | null; message: string }>; calls: Call[] }): () => void {
  const orig = globalThis.fetch
  globalThis.fetch = (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(init.body as string) : undefined
    opts.calls.push({ body })
    if (body?.query?.includes('DraftOrderInvoiceSend')) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: {
              draftOrderInvoiceSend: {
                draftOrder: opts.invoiceUserErrors?.length ? null : { id: 'gid://shopify/DraftOrder/1' },
                userErrors: opts.invoiceUserErrors ?? [],
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
    }
    return Promise.resolve(
      new Response(
        JSON.stringify({
          data: {
            draftOrderCreate: {
              draftOrder: { id: 'gid://shopify/DraftOrder/1', name: '#D1', invoiceUrl: 'x' },
              userErrors: [],
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
  }
  return () => {
    globalThis.fetch = orig
  }
}

Deno.test('sendDraftOrderInvoice: omits blank subject and message, sending an empty EmailInput', async () => {
  const calls: Call[] = []
  const restore = withQueuedGraphql({ calls })
  try {
    await sendDraftOrderInvoice(CREDS, 1, { subject: '  ', customMessage: '' })
    assertEquals(calls.length, 1)
    const variables = calls[0].body?.variables as { id: string; email: Record<string, unknown> }
    assertEquals(variables.id, 'gid://shopify/DraftOrder/1')
    assertEquals(variables.email, {})
  } finally {
    restore()
  }
})

Deno.test('sendDraftOrderInvoice: includes provided subject and message under EmailInput.customMessage', async () => {
  const calls: Call[] = []
  const restore = withQueuedGraphql({ calls })
  try {
    await sendDraftOrderInvoice(CREDS, 1, { subject: 'Your invoice', customMessage: 'Thanks!' })
    const variables = calls[0].body?.variables as { email: Record<string, unknown> }
    assertEquals(variables.email, { subject: 'Your invoice', customMessage: 'Thanks!' })
  } finally {
    restore()
  }
})

Deno.test('createDraftOrderWithInvoice: invoiceSent true when both succeed', async () => {
  const calls: Call[] = []
  const restore = withQueuedGraphql({ calls })
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

Deno.test('createDraftOrderWithInvoice: keeps draft and flags failure when invoice send returns userErrors (BEST-EFFORT)', async () => {
  const calls: Call[] = []
  const restore = withQueuedGraphql({
    calls,
    invoiceUserErrors: [{ field: null, message: 'Draft order has already been invoiced' }],
  })
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
