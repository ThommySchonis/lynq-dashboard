'use client'

import { useMemo, useState } from 'react'
import { Search, SlidersHorizontal, ArrowUpDown, MoreHorizontal, Store as StoreIcon, Unplug, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { StatusBadge } from '@/components/features/settings/status-badge'
import { ConfirmDialog } from '@/components/features/settings/confirm-dialog'
import { StoreManageModal } from './store-manage-modal'
import { useDisconnectStore, useDeleteStore } from '@/hooks/stores'
import { useAuthStore } from '@/stores/auth'
import { usePermissions } from '@/hooks/use-permissions'
import type { StorePublic } from '@/types/stores'

type StoreTab = 'all' | 'active' | 'reauth'

function storeState(store: StorePublic): 'active' | 'reauth' | 'disconnected' {
  if (store.status === 'reauth_required') return 'reauth'
  if (store.shopify_connected_at) return 'active'
  return 'disconnected'
}

interface StoresTableProps {
  stores: StorePublic[]
  /** Domain of the store that hosts the managed-pricing subscription, if any. */
  paymentsStoreDomain: string | null
}

export function StoresTable({ stores, paymentsStoreDomain }: StoresTableProps) {
  const [tab, setTab] = useState<StoreTab>('all')
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')

  const counts = useMemo(() => {
    let active = 0
    let reauth = 0
    for (const s of stores) {
      const st = storeState(s)
      if (st === 'active') active++
      else if (st === 'reauth') reauth++
    }
    return { all: stores.length, active, reauth }
  }, [stores])

  const filtered = useMemo(() => {
    return stores.filter((s) => {
      if (tab === 'active' && storeState(s) !== 'active') return false
      if (tab === 'reauth' && storeState(s) !== 'reauth') return false
      if (search && !(s.shopify_domain ?? s.name).toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [stores, tab, search])

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        {searchOpen ? (
          <Input
            type="text"
            placeholder="Search by domain…"
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            autoFocus
            className="h-8 max-w-xs bg-card"
          />
        ) : (
          <div className="flex items-center gap-2">
            <TabChip label="All" count={counts.all} active={tab === 'all'} onClick={() => setTab('all')} />
            <TabChip label="Active" count={counts.active} active={tab === 'active'} onClick={() => setTab('active')} />
            <TabChip label="Needs reauth" count={counts.reauth} active={tab === 'reauth'} onClick={() => setTab('reauth')} />
          </div>
        )}

        <div className="flex items-center gap-2">
          <IconButton
            label="Search"
            active={searchOpen}
            onClick={() => {
              setSearchOpen((o) => !o)
              setSearch('')
            }}
          >
            <Search size={16} strokeWidth={1.75} />
          </IconButton>
          <IconButton label="Filter">
            <SlidersHorizontal size={16} strokeWidth={1.75} />
          </IconButton>
          <IconButton label="Sort">
            <ArrowUpDown size={16} strokeWidth={1.75} />
          </IconButton>
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* Column header */}
      <div className="flex items-center gap-4 bg-foreground/[0.02] px-5 py-3">
        <span className="flex-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Shop domain
        </span>
        <span className="w-[200px] text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Status
        </span>
        <span className="w-[170px]" />
      </div>

      {/* Rows */}
      {filtered.map((store) => (
        <StoreRow
          key={store.id}
          store={store}
          isPaymentsStore={!!paymentsStoreDomain && store.shopify_domain === paymentsStoreDomain}
        />
      ))}

      {filtered.length === 0 && (
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">No stores in this view.</div>
      )}

      <div className="h-px bg-border" />

      {/* Footer */}
      <div className="px-5 py-3 text-xs text-muted-foreground">
        Showing {filtered.length === 0 ? 0 : 1}–{filtered.length} of {stores.length}{' '}
        {stores.length === 1 ? 'store' : 'stores'}
      </div>
    </div>
  )
}

function TabChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex items-center gap-1 rounded-full px-3.5 py-2 text-sm transition-colors',
        active
          ? 'bg-accent-soft font-semibold text-primary'
          : 'border border-border font-semibold text-foreground-2 hover:bg-black/[0.03]',
      ].join(' ')}
    >
      {label}
      <span className={active ? 'text-primary' : 'font-normal text-muted-foreground'}>{count}</span>
    </button>
  )
}

function IconButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  onClick?: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={[
        'flex size-[34px] items-center justify-center rounded-[9px] border border-border transition-colors',
        active ? 'bg-accent-soft text-primary' : 'bg-card text-foreground-2 hover:bg-black/[0.03]',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function StoreRow({ store, isPaymentsStore }: { store: StorePublic; isPaymentsStore: boolean }) {
  const [manageOpen, setManageOpen] = useState(false)
  const [disconnectOpen, setDisconnectOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const disconnectMutation = useDisconnectStore()
  const deleteMutation = useDeleteStore()
  const isSuspended = useAuthStore((s) => s.isSuspended)
  const { can } = usePermissions()
  const canManage = can.manageWorkspace

  const state = storeState(store)
  const isConnected = state === 'active'

  return (
    <>
      <div className="flex items-center gap-4 border-t border-border px-5 py-4 first:border-t-0">
        {/* Domain */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex size-[34px] shrink-0 items-center justify-center rounded-[9px] bg-border/60 text-foreground-2">
            <StoreIcon size={18} strokeWidth={1.75} />
          </span>
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold text-foreground">
              {store.shopify_domain ?? store.name}
            </span>
            {isPaymentsStore && (
              <span className="shrink-0 rounded-md bg-info-soft px-2 py-0.5 text-xs font-semibold text-info">
                Used for payments
              </span>
            )}
          </div>
        </div>

        {/* Status */}
        <div className="w-[200px]">
          <StatusBadge
            status={state === 'reauth' ? 'reauth' : isConnected ? 'active' : 'disconnected'}
            label={state === 'reauth' ? 'Reconnect required' : isConnected ? 'Connected' : 'Disconnected'}
          />
        </div>

        {/* Actions */}
        <div className="flex w-[170px] items-center justify-end gap-1.5">
          <Button variant="outline" size="sm" onClick={() => setManageOpen(true)}>
            Manage
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Store actions" />}>
              <MoreHorizontal size={16} strokeWidth={1.75} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isConnected && (
                <DropdownMenuItem
                  onSelect={() => setDisconnectOpen(true)}
                  disabled={isSuspended || !canManage}
                >
                  <Unplug size={14} strokeWidth={1.75} />
                  Disconnect
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setDeleteOpen(true)}
                disabled={isSuspended || !canManage}
              >
                <Trash2 size={14} strokeWidth={1.75} />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <StoreManageModal store={store} open={manageOpen} onOpenChange={setManageOpen} />

      <ConfirmDialog
        open={disconnectOpen}
        onOpenChange={setDisconnectOpen}
        title="Disconnect store?"
        description="The Shopify access token will be revoked. Order data stays. You can reconnect later."
        confirmLabel="Disconnect"
        variant="danger"
        loading={disconnectMutation.isPending}
        onConfirm={() => disconnectMutation.mutate(store.id, { onSuccess: () => setDisconnectOpen(false) })}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete store?"
        description="The store and its email configs will be removed. Existing orders will be kept but unlinked."
        confirmLabel="Delete"
        variant="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(store.id, { onSuccess: () => setDeleteOpen(false) })}
      />
    </>
  )
}
