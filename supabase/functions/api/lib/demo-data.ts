export const DEMO_SHOP = 'lynq-demo-store.myshopify.com'

export const DEMO_ORDERS = [
  { id: 5504586930001, name: '#1001', customer: 'Sophie van der Berg', total: '89.95', financialStatus: 'paid', fulfillmentStatus: 'fulfilled', cancelReason: null, hasRefund: false, createdAt: '2026-04-01T09:15:00Z' },
  { id: 5504586930002, name: '#1002', customer: 'Lars Hendriksen', total: '59.95', financialStatus: 'paid', fulfillmentStatus: 'fulfilled', cancelReason: null, hasRefund: false, createdAt: '2026-04-01T14:30:00Z' },
  { id: 5504586930003, name: '#1003', customer: 'Emma de Vries', total: '69.95', financialStatus: 'paid', fulfillmentStatus: 'fulfilled', cancelReason: null, hasRefund: false, createdAt: '2026-04-02T10:00:00Z' },
  { id: 5504586930004, name: '#1004', customer: 'Thomas Mueller', total: '49.95', financialStatus: 'refunded', fulfillmentStatus: 'fulfilled', cancelReason: null, hasRefund: true, createdAt: '2026-04-02T16:45:00Z' },
  { id: 5504586930005, name: '#1005', customer: 'Isabelle Dupont', total: '129.90', financialStatus: 'paid', fulfillmentStatus: 'fulfilled', cancelReason: null, hasRefund: false, createdAt: '2026-04-03T11:20:00Z' },
]

export const DEMO_REFUNDS = [
  { orderId: '#1004', orderIdNumeric: 5504586930004, customer: 'Thomas Mueller', customerEmail: 'thomas@example.com', refundAmount: '49.95', orderTotal: '49.95', refundPct: '100.0', itemCount: 1, products: ['Classic Linen Shirt'], reason: 'Quality not as expected', refundedAt: '2026-04-04T10:15:00Z' },
]

export const DEMO_KPIS = {
  totalOrders: 30,
  cancelledOrders: 2,
  totalRefunds: 9,
  refundRate: '30.0',
  refundPct: '38.2',
  netRevenue: '1342',
  totalRevenue: '2168',
  discounts: '145',
  returns: '763',
  refundAmount: '763',
}

export const DEMO_TREND = [
  { date: '2026-04-01', revenue: 159.90 },
  { date: '2026-04-02', revenue: 119.90 },
  { date: '2026-04-03', revenue: 134.90 },
  { date: '2026-04-04', revenue: 0 },
  { date: '2026-04-05', revenue: 94.95 },
  { date: '2026-04-06', revenue: 0 },
  { date: '2026-04-07', revenue: 89.95 },
]
