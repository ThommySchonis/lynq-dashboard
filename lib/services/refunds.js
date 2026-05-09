/**
 * Map Shopify cancel_reason to standardized taxonomy value.
 */
const REASON_MAP = {
  customer: 'customer',
  fraud: 'fraud',
  inventory: 'inventory',
  declined: 'declined',
  other: 'other',
}

export function classifyRefundReason(cancelReason) {
  if (!cancelReason) return 'other'
  return REASON_MAP[cancelReason.toLowerCase()] || 'other'
}

/**
 * Group refund line items by order and calculate refund percentages.
 * @param {Array} orders - Raw Shopify orders with refunds
 * @param {{ from?: string, to?: string }} dateRange
 */
export function aggregateRefunds(orders, dateRange) {
  const fromTs = dateRange.from ? `${dateRange.from}T00:00:00` : null
  const toTs = dateRange.to ? `${dateRange.to}T23:59:59` : null

  return orders
    .filter(o => o.refunds && o.refunds.length > 0)
    .flatMap(o => {
      const orderTotal = parseFloat(o.total_price || 0)
      const inRange = (o.refunds || []).filter(r => {
        if (!fromTs && !toTs) return true
        if (fromTs && r.created_at < fromTs) return false
        if (toTs && r.created_at > toTs) return false
        return true
      })
      if (inRange.length === 0) return []

      const refundTotal = inRange.reduce((sum, r) =>
        sum + (r.transactions || []).reduce((ts, t) =>
          ts + parseFloat(t.amount || 0), 0), 0)

      if (refundTotal <= 0) return []

      return [{
        orderId: o.name,
        refundAmount: refundTotal.toFixed(2),
        orderTotal: orderTotal.toFixed(2),
        refundPct: orderTotal > 0 ? ((refundTotal / orderTotal) * 100).toFixed(1) : '0.0',
        reason: o.cancel_reason || null,
      }]
    })
}

/**
 * Aggregate refund data for AI analysis: top reasons, products, high-value.
 * @param {Array} refunds - Array of refund objects from getRefunds()
 */
export function getRefundInsights(refunds) {
  if (!refunds || refunds.length === 0) return { reasons: [], products: [], highValue: [] }

  // Top reasons
  const reasonCounts = {}
  for (const r of refunds) {
    const reason = r.reason || 'Unknown'
    reasonCounts[reason] = (reasonCounts[reason] || 0) + 1
  }
  const reasons = Object.entries(reasonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([reason, count]) => ({ reason, count }))

  // Top refunded products
  const productCounts = {}
  for (const r of refunds) {
    for (const p of (r.products || [])) {
      productCounts[p] = (productCounts[p] || 0) + 1
    }
  }
  const products = Object.entries(productCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([product, count]) => ({ product, count }))

  // High-value refunds
  const highValue = [...refunds]
    .sort((a, b) => parseFloat(b.refundAmount) - parseFloat(a.refundAmount))
    .slice(0, 3)
    .map(r => ({
      orderId: r.orderId,
      customer: r.customer,
      refundAmount: r.refundAmount,
      reason: r.reason,
    }))

  return { reasons, products, highValue }
}
