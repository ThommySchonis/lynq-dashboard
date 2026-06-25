// Thin Shopify Admin GraphQL client used by the billing service and webhook.
// All requests go to https://{shop}/admin/api/2026-04/graphql.json using the
// integration's access token. Only the operations the billing flow needs are
// exposed — no general-purpose client.

const API_VERSION = '2026-04'

export interface AppSubscriptionState {
  id: string                  // gid://shopify/AppSubscription/12345
  name: string                // human display name (may be translated — do NOT use as a key)
  handle: string | null       // stable Managed Pricing plan handle — the entitlements key
  priceAmount: number | null  // merchant's localized charged amount (multi-currency)
  priceCurrency: string | null // ISO currency of priceAmount
  status: ShopifyChargeStatus
  trialDays: number
  currentPeriodEnd: string | null
  createdAt: string
}

export type ShopifyChargeStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'CANCELLED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'FROZEN'
  | 'ACCEPTED'

export interface ShopBillingAddress {
  address1: string | null
  address2: string | null
  city: string | null
  province: string | null
  country: string | null
  zip: string | null
  company: string | null
}

export interface AppChargeRecord {
  id: string                // gid
  date: string              // ISO
  amount: number
  currency: string
  status: ShopifyChargeStatus | string
  receiptUrl: string | null
  planName: string
}

export class ShopifyAdminError extends Error {
  constructor(message: string, public statusCode = 502) {
    super(message)
    this.name = 'ShopifyAdminError'
  }
}

interface GraphQLResponse<T> {
  data?: T
  errors?: Array<{ message: string }>
}

async function graphql<T>(
  shopDomain: string,
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`https://${shopDomain}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({ query, variables: variables ?? {} }),
  })
  const body = (await res.json()) as GraphQLResponse<T>
  if (!res.ok || body.errors?.length) {
    const msg = body.errors?.map((e) => e.message).join('; ') ?? `HTTP ${res.status}`
    throw new ShopifyAdminError(`Shopify Admin GraphQL: ${msg}`, res.status)
  }
  if (!body.data) throw new ShopifyAdminError('Shopify Admin GraphQL: empty data')
  return body.data
}

// ── Reads ─────────────────────────────────────────────────────────────

export async function getCurrentAppSubscription(
  shopDomain: string,
  accessToken: string,
): Promise<AppSubscriptionState | null> {
  const query = /* GraphQL */ `
    query CurrentAppSubscription {
      currentAppInstallation {
        activeSubscriptions {
          id
          name
          handle
          status
          trialDays
          createdAt
          currentPeriodEnd
          lineItems {
            plan {
              pricingDetails {
                __typename
                ... on AppRecurringPricing {
                  price { amount currencyCode }
                }
              }
            }
          }
        }
      }
    }
  `
  interface Resp {
    currentAppInstallation: {
      activeSubscriptions: Array<{
        id: string
        name: string
        handle: string | null
        status: ShopifyChargeStatus
        trialDays: number
        createdAt: string
        currentPeriodEnd: string | null
        lineItems: Array<{ plan: { pricingDetails: { price?: { amount: string; currencyCode: string } } } }>
      }>
    }
  }
  const data = await graphql<Resp>(shopDomain, accessToken, query)
  const sub = data.currentAppInstallation.activeSubscriptions[0]
  if (!sub) return null
  const price = sub.lineItems[0]?.plan.pricingDetails.price
  return {
    id: sub.id,
    name: sub.name,
    handle: sub.handle,
    priceAmount: price ? Number(price.amount) : null,
    priceCurrency: price?.currencyCode ?? null,
    status: sub.status,
    trialDays: sub.trialDays,
    currentPeriodEnd: sub.currentPeriodEnd,
    createdAt: sub.createdAt,
  }
}

export async function getShopBillingAddress(
  shopDomain: string,
  accessToken: string,
): Promise<ShopBillingAddress> {
  const query = /* GraphQL */ `
    query ShopBillingAddress {
      shop {
        billingAddress {
          address1
          address2
          city
          province
          country
          zip
          company
        }
      }
    }
  `
  interface Resp { shop: { billingAddress: ShopBillingAddress } }
  const data = await graphql<Resp>(shopDomain, accessToken, query)
  return data.shop.billingAddress
}

export async function getAppChargeHistory(
  shopDomain: string,
  accessToken: string,
): Promise<AppChargeRecord[]> {
  const query = /* GraphQL */ `
    query AppCharges {
      currentAppInstallation {
        allSubscriptions(first: 50, reverse: true) {
          edges {
            node {
              id
              name
              status
              createdAt
              lineItems {
                plan {
                  pricingDetails {
                    __typename
                    ... on AppRecurringPricing {
                      price { amount currencyCode }
                    }
                  }
                }
              }
            }
          }
        }
        oneTimePurchases(first: 50, reverse: true) {
          edges {
            node {
              id
              name
              status
              createdAt
              price { amount currencyCode }
            }
          }
        }
      }
    }
  `
  interface Pricing {
    __typename: string
    price?: { amount: string; currencyCode: string }
  }
  interface SubNode {
    id: string
    name: string
    status: string
    createdAt: string
    lineItems: Array<{ plan: { pricingDetails: Pricing } }>
  }
  interface OneNode {
    id: string
    name: string
    status: string
    createdAt: string
    price: { amount: string; currencyCode: string }
  }
  interface Resp {
    currentAppInstallation: {
      allSubscriptions: { edges: Array<{ node: SubNode }> }
      oneTimePurchases: { edges: Array<{ node: OneNode }> }
    }
  }
  const data = await graphql<Resp>(shopDomain, accessToken, query)
  const subs = data.currentAppInstallation.allSubscriptions.edges.map<AppChargeRecord>((e) => {
    const li = e.node.lineItems[0]?.plan.pricingDetails
    return {
      id: e.node.id,
      date: e.node.createdAt,
      amount: Number(li?.price?.amount ?? 0),
      currency: li?.price?.currencyCode ?? 'EUR',
      status: e.node.status,
      receiptUrl: null,
      planName: e.node.name,
    }
  })
  const ones = data.currentAppInstallation.oneTimePurchases.edges.map<AppChargeRecord>((e) => ({
    id: e.node.id,
    date: e.node.createdAt,
    amount: Number(e.node.price.amount),
    currency: e.node.price.currencyCode,
    status: e.node.status,
    receiptUrl: null,
    planName: e.node.name,
  }))
  return [...subs, ...ones].sort((a, b) => (a.date < b.date ? 1 : -1))
}

// ── Mutations ─────────────────────────────────────────────────────────

export async function cancelAppSubscription(
  shopDomain: string,
  accessToken: string,
  subscriptionGid: string,
): Promise<void> {
  const query = /* GraphQL */ `
    mutation AppSubscriptionCancel($id: ID!) {
      appSubscriptionCancel(id: $id) {
        userErrors { field message }
        appSubscription { id status }
      }
    }
  `
  interface Resp {
    appSubscriptionCancel: {
      userErrors: Array<{ message: string }>
      appSubscription: { id: string; status: string } | null
    }
  }
  const data = await graphql<Resp>(shopDomain, accessToken, query, { id: subscriptionGid })
  const errs = data.appSubscriptionCancel.userErrors
  if (errs.length > 0) {
    throw new ShopifyAdminError(`appSubscriptionCancel: ${errs.map((e) => e.message).join('; ')}`)
  }
}

// ── URL helper ────────────────────────────────────────────────────────

export function buildManagedPricingUrl(shopDomain: string): string {
  const handle = Deno.env.get('SHOPIFY_APP_HANDLE')
  if (!handle) throw new ShopifyAdminError('SHOPIFY_APP_HANDLE env var is not set', 500)
  return `https://${shopDomain}/admin/charges/${handle}/pricing_plans`
}
