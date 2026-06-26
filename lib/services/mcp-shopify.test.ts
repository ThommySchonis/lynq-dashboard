import { describe, it, expect, vi, beforeEach } from 'vitest'
const getStoreCredentials = vi.fn()
const listStores = vi.fn()
const getOrders = vi.fn()
const getOrderDetail = vi.fn()
const getCustomer = vi.fn()
vi.mock('@/lib/store-credentials', () => ({
  getStoreCredentials: (...a: unknown[]): unknown => getStoreCredentials(...a),
}))
vi.mock('@/lib/services/stores', () => ({
  listStores: (...a: unknown[]): unknown => listStores(...a),
}))
vi.mock('@/lib/services/shopify-orders', () => ({
  getOrders: (...a: unknown[]): unknown => getOrders(...a),
  getOrderDetail: (...a: unknown[]): unknown => getOrderDetail(...a),
  getCustomer: (...a: unknown[]): unknown => getCustomer(...a),
}))
import { listOrdersForWorkspace, lookupCustomerForWorkspace } from '@/lib/services/mcp-shopify'

beforeEach(() => { getStoreCredentials.mockReset(); listStores.mockReset(); getOrders.mockReset(); getCustomer.mockReset() })

describe('listOrdersForWorkspace', () => {
  it('resolves the first store when storeId omitted, then fetches orders with credentials', async () => {
    listStores.mockResolvedValue([{ id: 'store1', name: 'S' }])
    getStoreCredentials.mockResolvedValue({ domain: 'd.myshopify.com', accessToken: 't' })
    getOrders.mockResolvedValue([{ id: 1 }])
    const out = await listOrdersForWorkspace('w1', { limit: 10 })
    expect(getStoreCredentials).toHaveBeenCalledWith('store1', 'w1')
    expect(getOrders).toHaveBeenCalledWith({ domain: 'd.myshopify.com', accessToken: 't' }, { limit: 10 })
    expect(out).toEqual([{ id: 1 }])
  })
  it('throws a clear error when the workspace has no connected store', async () => {
    listStores.mockResolvedValue([])
    await expect(listOrdersForWorkspace('w1', {})).rejects.toThrow(/no .*store/i)
  })
  it('throws when credentials are missing', async () => {
    getStoreCredentials.mockResolvedValue(null)
    await expect(listOrdersForWorkspace('w1', { storeId: 'store1' })).rejects.toThrow(/credential|connect/i)
  })
})

describe('lookupCustomerForWorkspace', () => {
  it('passes the query to getCustomer with resolved credentials', async () => {
    getStoreCredentials.mockResolvedValue({ domain: 'd', accessToken: 't' })
    getCustomer.mockResolvedValue({ email: 'a@b.c' })
    await lookupCustomerForWorkspace('w1', { email: 'a@b.c' }, { storeId: 'store1' })
    expect(getCustomer).toHaveBeenCalledWith({ domain: 'd', accessToken: 't' }, { email: 'a@b.c' })
  })
})
