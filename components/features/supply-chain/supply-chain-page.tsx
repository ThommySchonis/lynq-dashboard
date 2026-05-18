'use client'

import { useMemo } from 'react'
import { Package, RefreshCw, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react'
import { useShipments } from '@/hooks/supply-chain/use-supply-chain-data'
import { useSupplyChainUI } from '@/stores/supply-chain-ui'
import { getAttentionItems, FILTER_STATUS } from '@/lib/supply-chain-constants'
import { ShipmentKpiCards } from './shipment-kpi-cards'
import { ShipmentFilters } from './shipment-filters'
import { ShipmentRow } from './shipment-row'
import { AttentionCard } from './attention-card'
import { SetupWizard } from './setup-wizard'

function SkeletonRows() {
  return (
    <div className="animate-[fadeIn_0.3s_ease_both]">
      <div className="grid grid-cols-5 gap-3.5 mb-7">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-2xl p-5 px-[22px] shadow-[var(--shadow-card)] h-[84px]">
            <div className="h-[11px] w-[55%] mb-2.5 rounded-md bg-gradient-to-r from-(--skeleton-from) via-(--skeleton-to) to-(--skeleton-from) bg-[length:200%_100%] animate-[skWave_1.5s_ease-in-out_infinite]" />
            <div className="h-[26px] w-[40%] rounded-md bg-gradient-to-r from-(--skeleton-from) via-(--skeleton-to) to-(--skeleton-from) bg-[length:200%_100%] animate-[skWave_1.5s_ease-in-out_infinite]" />
          </div>
        ))}
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-card border border-border rounded-[14px] py-[15px] px-5 mb-2.5 h-[68px]">
          <div className="h-[13px] w-[28%] mb-2 rounded-md bg-gradient-to-r from-(--skeleton-from) via-(--skeleton-to) to-(--skeleton-from) bg-[length:200%_100%] animate-[skWave_1.5s_ease-in-out_infinite]" />
          <div className="h-[11px] w-[18%] rounded-md bg-gradient-to-r from-(--skeleton-from) via-(--skeleton-to) to-(--skeleton-from) bg-[length:200%_100%] animate-[skWave_1.5s_ease-in-out_infinite]" />
        </div>
      ))}
    </div>
  )
}

export function SupplyChainPage() {
  const { data: orders = [], isPending, isError, error, refetch, dataUpdatedAt } = useShipments()
  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt) : null
  const notConfigured = !isPending && !isError && orders.length === 0
  const { filter, search, dismissedKeys, showAllAttention, dismiss, toggleShowAllAttention } = useSupplyChainUI()

  const attentionItems = useMemo(() => getAttentionItems(orders, dismissedKeys), [orders, dismissedKeys])
  const attentionKeys = useMemo(() => new Set(attentionItems.map(i => i.key)), [attentionItems])

  const filtered = useMemo(() => orders.filter(o => {
    const s = o.shipments?.[0]
    if (!s) return false
    if (filter === 'Needs Attention') {
      if (!attentionKeys.has(o.order_number || o.id)) return false
    } else if (filter !== 'All') {
      if (!FILTER_STATUS[filter]?.includes(s.status)) return false
    }
    if (search) {
      const q = search.toLowerCase()
      return (
        o.order_number?.toLowerCase().includes(q) ||
        o.customer?.name?.toLowerCase().includes(q) ||
        s.tracking_number?.toLowerCase().includes(q) ||
        (s.carrier?.name || '').toLowerCase().includes(q)
      )
    }
    return true
  }), [orders, filter, search, attentionKeys])

  const visibleAttention = showAllAttention ? attentionItems : attentionItems.slice(0, 3)

  return (
      <main className="min-h-screen overflow-y-auto py-10 px-11 relative text-foreground [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-(--scrollbar) [&::-webkit-scrollbar-thumb]:rounded-sm" style={{ fontFamily: "'Switzer', -apple-system, BlinkMacSystemFont, sans-serif" }}>
        <div className="relative z-[1] max-w-[980px] mx-auto">

          {/* Header */}
          <div className="animate-[fadeUp_0.4s_ease_both]" style={{ marginBottom: notConfigured ? 0 : 30 }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="w-9 h-9 rounded-[10px] bg-secondary border border-border flex items-center justify-center">
                    <Package className="w-[17px] h-[17px] text-foreground-2" />
                  </div>
                  <span className="text-[11.5px] font-bold text-muted-foreground uppercase tracking-[.08em]">
                    Supply Chain
                  </span>
                </div>
                <h1 className="text-xl font-bold tracking-[-0.02em] leading-[1.1] mb-2 text-foreground">
                  Shipment Tracker
                </h1>
                <p className="text-sm text-muted-foreground">
                  {lastUpdated
                    ? `Last updated at ${lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
                    : 'Live tracking powered by Parcel Panel'}
                </p>
              </div>

              {!notConfigured && (
                <div className="flex gap-2 items-center shrink-0 pt-1">
                  <button
                    onClick={() => void refetch()}
                    disabled={isPending}
                    className="flex items-center gap-1.5 py-2 px-3.5 rounded-[9px] bg-secondary border border-border text-foreground-2 text-[12.5px] font-semibold cursor-pointer transition-all duration-150"
                  >
                    <RefreshCw className={`w-[13px] h-[13px] ${isPending ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>
              )}
            </div>
            {!notConfigured && <div className="h-px bg-secondary mt-[22px]" />}
          </div>

          {/* Setup screen */}
          {notConfigured && <SetupWizard onConnected={() => void refetch()} />}

          {/* Loading skeleton */}
          {isPending && !notConfigured && <SkeletonRows />}

          {/* Error state */}
          {isError && !isPending && (
            <div className="text-center py-[60px]">
              <div className="w-14 h-14 rounded-full bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.2)] flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-[22px] h-[22px] text-[#f87171]" />
              </div>
              <p className="text-[15px] font-bold text-foreground mb-1.5">Could not load shipments</p>
              <p className="text-[13.5px] text-muted-foreground mb-5">{error?.message}</p>
              <button
                onClick={() => void refetch()}
                className="py-[9px] px-5 rounded-[9px] bg-[#111111] text-white border-none text-[13.5px] font-bold cursor-pointer"
              >
                Try again
              </button>
            </div>
          )}

          {/* Main content */}
          {!isPending && !isError && !notConfigured && (
            <>
              {/* KPI cards */}
              <ShipmentKpiCards orders={orders} isPending={isPending} attentionCount={attentionItems.length} />

              {/* All-good banner */}
              {attentionItems.length === 0 && orders.length > 0 && (
                <div className="flex items-center gap-2.5 py-3 px-4 rounded-[10px] bg-[rgba(22,163,74,0.06)] border border-[rgba(22,163,74,0.15)] mb-6 animate-[fadeUp_0.4s_ease_0.1s_both]">
                  <CheckCircle className="w-[15px] h-[15px] text-[#16A34A]" />
                  <span className="text-[13.5px] text-[#16A34A] font-semibold">All good — no action items required</span>
                </div>
              )}

              {/* Attention section */}
              {attentionItems.length > 0 && (
                <div className="mb-8 animate-[fadeUp_0.4s_ease_0.1s_both]">
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="flex items-center gap-[9px]">
                      <AlertTriangle className="w-[15px] h-[15px] text-[#DC2626]" />
                      <span className="text-sm font-bold text-foreground">Action items</span>
                      <span className="text-[11px] font-extrabold bg-[rgba(220,38,38,0.08)] border border-[rgba(220,38,38,0.18)] text-[#DC2626] py-0.5 px-2 rounded-full">
                        {attentionItems.length}
                      </span>
                    </div>
                    {attentionItems.length > 3 && (
                      <button
                        onClick={toggleShowAllAttention}
                        className="bg-transparent border-none text-muted-foreground text-[12.5px] cursor-pointer font-semibold"
                      >
                        {showAllAttention ? 'Show less' : `Show all ${attentionItems.length}`}
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-3">
                    {visibleAttention.map(item => (
                      <AttentionCard key={item.key} item={item} onDismiss={dismiss} />
                    ))}
                  </div>
                </div>
              )}

              {/* Shipment list */}
              <ShipmentFilters attentionCount={attentionItems.length} filteredCount={filtered.length} />

              {/* Column headers */}
              {filtered.length > 0 && (
                <div className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-4 items-center py-2 px-5 bg-background rounded-[10px] mb-1.5">
                  <span className="text-[10px] font-bold text-foreground-4 uppercase tracking-[.08em]">Order / Customer</span>
                  <span className="text-[10px] font-bold text-foreground-4 uppercase tracking-[.08em]">Products</span>
                  <span className="text-[10px] font-bold text-foreground-4 uppercase tracking-[.08em]">Carrier</span>
                  <span className="text-[10px] font-bold text-foreground-4 uppercase tracking-[.08em] text-right min-w-[90px]">Date</span>
                  <span />
                </div>
              )}

              {/* Rows or empty state */}
              {filtered.length === 0 ? (
                <div className="bg-card border border-border rounded-2xl p-5 px-[22px] shadow-[var(--shadow-card)] text-center py-10 px-5 text-muted-foreground text-[13.5px]">
                  {orders.length === 0 ? (
                    <>
                      <p className="font-semibold text-foreground-2 mb-1.5">No shipments received yet</p>
                      <p>Shipments will appear here once Parcel Panel sends a status update. Existing orders will not appear retroactively.</p>
                    </>
                  ) : (
                    'No shipments match this filter.'
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {filtered.map((order, i) => (
                    <ShipmentRow
                      key={order.order_number || i}
                      order={order}
                      index={i}
                      isAttention={attentionKeys.has(order.order_number || order.id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    )
}
