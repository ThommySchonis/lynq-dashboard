import { describe, it, expect, vi, beforeEach } from 'vitest'
const getStoreCredentials = vi.fn()
const listStores = vi.fn()
const getOrders = vi.fn()
const getOrderDetail = vi.fn()
const getCustomer = vi.fn()
const createRefund = vi.fn()
const cancelOrder = vi.fn()
const fulfillOrder = vi.fn()
const updateOrderNote = vi.fn()
const updateOrderAddress = vi.fn()
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
vi.mock('@/lib/services/shopify-order-actions', () => ({
  createRefund: (...a: unknown[]): unknown => createRefund(...a),
  cancelOrder: (...a: unknown[]): unknown => cancelOrder(...a),
  fulfillOrder: (...a: unknown[]): unknown => fulfillOrder(...a),
  updateOrderNote: (...a: unknown[]): unknown => updateOrderNote(...a),
  updateOrderAddress: (...a: unknown[]): unknown => updateOrderAddress(...a),
}))
import { listOrdersForWorkspace, lookupCustomerForWorkspace, refundOrderForWorkspace, cancelOrderForWorkspace, updateOrderNoteForWorkspace } from '@/lib/services/mcp-shopify'

beforeEach(() => {
  getStoreCredentials.mockReset()
  listStores.mockReset()
  getOrders.mockReset()
  getCustomer.mockReset()
  createRefund.mockReset()
  cancelOrder.mockReset()
  fulfillOrder.mockReset()
  updateOrderNote.mockReset()
  updateOrderAddress.mockReset()
})

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

describe('order actions for workspace', () => {
  it('refund resolves credentials then calls createRefund with stripped params', async () => {
    listStores.mockResolvedValue([{ id: 's1', shopify_connected_at: '2026-01-01' }])
    getStoreCredentials.mockResolvedValue({ domain: 'd', accessToken: 't' })
    createRefund.mockResolvedValue({ refund: { id: 1 } })
    await refundOrderForWorkspace('w1', '123', { customAmount: '10.00', reason: 'damaged', restock: true })
    expect(createRefund).toHaveBeenCalledWith({ domain: 'd', accessToken: 't' }, '123', { customAmount: '10.00', reason: 'damaged', restock: true })
  })
  it('cancel strips storeId and passes the rest', async () => {
    listStores.mockResolvedValue([{ id: 's1', shopify_connected_at: '2026-01-01' }])
    getStoreCredentials.mockResolvedValue({ domain: 'd', accessToken: 't' })
    cancelOrder.mockResolvedValue({ ok: true })
    await cancelOrderForWorkspace('w1', '123', { storeId: 's1', reason: 'fraud', refund: true })
    expect(cancelOrder).toHaveBeenCalledWith({ domain: 'd', accessToken: 't' }, '123', { reason: 'fraud', refund: true })
  })
  it('propagates the no-connected-store error', async () => {
    listStores.mockResolvedValue([])
    await expect(updateOrderNoteForWorkspace('w1', '123', { note: 'x' })).rejects.toThrow(/no .*store/i)
  })
})
