'use client'

import { useMemo } from 'react'
import { useResponseTime, useResolutionTime } from '@/hooks/analytics/use-support-analytics'
import { useKpis, useRefunds } from '@/hooks/analytics/use-analytics-data'
import { last30DaysRange } from '@/lib/home-utils'

/**
 * Composes the four "Your helpdesk at a glance" metrics over a trailing 30-day
 * window: first response + resolution time (support analytics) and refund rate
 * + avg refund (Shopify analytics). All real data — no placeholders.
 */
export function useHelpdeskGlance() {
  const range = useMemo(() => last30DaysRange(), [])

  const responseTime = useResponseTime(range)
  const resolutionTime = useResolutionTime(range)
  const kpis = useKpis(range)
  const refunds = useRefunds(range)

  const refundCount = refunds.data?.length ?? 0
  const refundTotal = (refunds.data ?? []).reduce(
    (sum, r) => sum + parseFloat(String(r.refundAmount || 0)),
    0,
  )
  const avgRefund = refundCount > 0 ? refundTotal / refundCount : undefined

  return {
    firstResponse: {
      seconds: responseTime.data?.avg_response_time_seconds,
      conversations: responseTime.data?.total_conversations,
      isLoading: responseTime.isLoading,
    },
    resolutionTime: {
      seconds: resolutionTime.data?.avg_resolution_time_seconds,
      resolved: resolutionTime.data?.total_resolved,
      isLoading: resolutionTime.isLoading,
    },
    refundRate: {
      value: kpis.data?.refundRate,
      isLoading: kpis.isLoading,
    },
    avgRefund: {
      value: avgRefund,
      count: refundCount,
      isLoading: refunds.isLoading,
    },
  }
}
