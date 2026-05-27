'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useWebhookEvents, useRetryWebhooks, useDismissWebhooks } from '@/hooks/admin'

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

const SOURCE_COLORS: Record<string, string> = {
  shopify: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
  whop: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  email: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  parcelpanel: 'bg-green-500/10 text-green-600 border-green-500/20',
}

const STATUS_VARIANTS: Record<string, string> = {
  dead_letter: 'bg-destructive/10 text-destructive border-destructive/20',
  failed: 'bg-warning-soft text-warning border-warning/20',
  dismissed: 'bg-muted text-muted-foreground border-border',
}

export function WebhooksView() {
  const [status, setStatus] = useState('dead_letter')
  const [source, setSource] = useState('')
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data } = useWebhookEvents({ status, source, page })
  const retryMutation = useRetryWebhooks()
  const dismissMutation = useDismissWebhooks()

  const events = data?.events ?? []
  const total = data?.total ?? 0
  const limit = data?.limit ?? 50
  const totalPages = Math.max(1, Math.ceil(total / limit))

  const allSelected = events.length > 0 && events.every((e) => selectedIds.has(e.id))

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(events.map((e) => e.id)))
    }
  }

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  const handleRetry = async (ids: string[]) => {
    try {
      await retryMutation.mutateAsync(ids)
      setSelectedIds(new Set())
      toast.success(`Retried ${ids.length} webhook${ids.length !== 1 ? 's' : ''}`)
    } catch {
      toast.error('Failed to retry webhooks')
    }
  }

  const handleDismiss = async (ids: string[]) => {
    try {
      await dismissMutation.mutateAsync(ids)
      setSelectedIds(new Set())
      toast.success(`Dismissed ${ids.length} webhook${ids.length !== 1 ? 's' : ''}`)
    } catch {
      toast.error('Failed to dismiss webhooks')
    }
  }

  const isDeadLetter = status === 'dead_letter'
  const selectedArray = Array.from(selectedIds)

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-center justify-between gap-4">
          <CardTitle>Webhook Events — {total}</CardTitle>
          <div className="flex items-center gap-2">
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); setSelectedIds(new Set()) }}
              className="h-8 rounded-md border border-border bg-card px-2 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="dead_letter">Dead Letter</option>
              <option value="failed">Failed</option>
              <option value="">All</option>
            </select>
            <select
              value={source}
              onChange={(e) => { setSource(e.target.value); setPage(1); setSelectedIds(new Set()) }}
              className="h-8 rounded-md border border-border bg-card px-2 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">All Sources</option>
              <option value="shopify">Shopify</option>
              <option value="whop">Whop</option>
              <option value="email">Email</option>
              <option value="parcelpanel">ParcelPanel</option>
            </select>
          </div>
        </div>
        {isDeadLetter && (
          <div className="mt-3 flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={selectedIds.size === 0 || retryMutation.isPending}
              onClick={() => void handleRetry(selectedArray)}
              className="h-7 text-[11px]"
            >
              Retry Selected ({selectedIds.size})
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={selectedIds.size === 0 || dismissMutation.isPending}
              onClick={() => void handleDismiss(selectedArray)}
              className="h-7 text-[11px] text-muted-foreground"
            >
              Dismiss Selected ({selectedIds.size})
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0">
        {events.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No webhook events found
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-[28px_80px_1fr_1fr_56px_72px_80px_80px_80px] items-center gap-2 border-b border-border/50 bg-muted/40 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="h-3.5 w-3.5 accent-primary"
              />
              <span>Source</span>
              <span>Event Type</span>
              <span>Error</span>
              <span>Attempts</span>
              <span>Created</span>
              <span>Next Retry</span>
              <span>Workspace</span>
              <span>Actions</span>
            </div>

            {events.map((event) => (
              <div key={event.id} className="border-b border-border/25 last:border-b-0">
                {/* Main row */}
                <div
                  className="grid cursor-pointer grid-cols-[28px_80px_1fr_1fr_56px_72px_80px_80px_80px] items-center gap-2 px-4 py-2.5 text-[12px] transition-colors hover:bg-muted/30"
                  onClick={() => toggleExpand(event.id)}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(event.id)}
                    onChange={() => toggleOne(event.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-3.5 w-3.5 accent-primary"
                  />

                  {/* Source badge */}
                  <span
                    className={`inline-flex h-5 w-fit items-center rounded-full border px-2 text-[10px] font-medium capitalize ${SOURCE_COLORS[event.source] ?? 'bg-muted text-muted-foreground border-border'}`}
                  >
                    {event.source}
                  </span>

                  {/* Event type */}
                  <span className="truncate font-mono text-[11px] text-foreground">
                    {event.event_type}
                  </span>

                  {/* Error */}
                  <span className="truncate text-muted-foreground" title={event.error_message ?? ''}>
                    {event.error_message
                      ? event.error_message.length > 60
                        ? `${event.error_message.slice(0, 60)}…`
                        : event.error_message
                      : '—'}
                  </span>

                  {/* Attempts */}
                  <span className="text-muted-foreground">
                    {event.attempt_count} / {event.attempt_count}
                  </span>

                  {/* Created */}
                  <span className="text-muted-foreground">{timeAgo(event.created_at)}</span>

                  {/* Next retry */}
                  <span className="text-muted-foreground">
                    {event.next_retry_at ? timeAgo(event.next_retry_at) : '—'}
                  </span>

                  {/* Workspace */}
                  <span className="truncate font-mono text-[10px] text-muted-foreground">
                    {event.workspace_id ?? '—'}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {isDeadLetter && (
                      <>
                        <button
                          className="rounded px-1.5 py-0.5 text-[10px] font-medium text-violet-600 transition-colors hover:bg-violet-500/10 disabled:opacity-40"
                          disabled={retryMutation.isPending}
                          onClick={() => void handleRetry([event.id])}
                        >
                          Retry
                        </button>
                        <button
                          className="rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
                          disabled={dismissMutation.isPending}
                          onClick={() => void handleDismiss([event.id])}
                        >
                          Dismiss
                        </button>
                      </>
                    )}
                    {!isDeadLetter && (
                      <Badge
                        className={`${STATUS_VARIANTS[event.status] ?? ''} border text-[10px]`}
                      >
                        {event.status}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Expanded payload */}
                {expandedId === event.id && (
                  <div className="border-t border-border/25 bg-muted/20 px-4 py-3">
                    <pre className="overflow-x-auto rounded-md bg-muted/50 p-3 font-mono text-[11px] text-foreground">
                      {JSON.stringify(event.metadata, null, 2) ?? 'No payload'}
                    </pre>
                  </div>
                )}
              </div>
            ))}

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-border/50 px-4 py-3">
              <span className="text-[12px] text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="h-7 text-[11px]"
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-7 text-[11px]"
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
