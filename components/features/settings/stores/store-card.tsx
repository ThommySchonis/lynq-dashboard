'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ArrowUpRight, ChevronDown, Loader2, Mail, Pencil, Plus, Trash2, Unplug, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SettingsCard } from '@/components/features/settings/settings-section'
import { StatusBadge } from '@/components/features/settings/status-badge'
import { ConfirmDialog } from '@/components/features/settings/confirm-dialog'
import { CustomEmailModal } from '@/components/features/settings/integrations/custom-email-modal'
import { ForwardingSetupWizard } from '@/components/features/settings/integrations/forwarding/forwarding-setup-wizard'
import { useUpdateStore, useDisconnectStore, useDeleteStore, useDeleteStoreEmailAccount } from '@/hooks/stores'
import { startShopifyOAuth } from '@/hooks/settings/use-integration-mutations'
import { useStoreEmailAccounts } from '@/hooks/stores'
import { useAuthStore } from '@/stores/auth'
import { usePermissions } from '@/hooks/use-permissions'
import type { StorePublic } from '@/types/stores'

interface StoreCardProps {
  store: StorePublic
}

export function StoreCard({ store }: StoreCardProps) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(store.name)
  const [disconnectOpen, setDisconnectOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const [emailsExpanded, setEmailsExpanded] = useState(false)
  const [customModalOpen, setCustomModalOpen] = useState(false)
  const [forwardingModalOpen, setForwardingModalOpen] = useState(false)

  const updateMutation = useUpdateStore()
  const disconnectMutation = useDisconnectStore()
  const deleteMutation = useDeleteStore()
  const deleteEmailMutation = useDeleteStoreEmailAccount()
  const { data: emailConfigs } = useStoreEmailAccounts(store.id)
  const token = useAuthStore((s) => s.session?.access_token ?? '')
  const isSuspended = useAuthStore((s) => s.isSuspended)
  const { can } = usePermissions()
  const canManage = can.manageWorkspace
  const adminTitle = canManage ? undefined : 'Admin access required to manage store connections.'

  const isConnected = !!store.shopify_connected_at
  const needsReauth = store.status === 'reauth_required'
  const [reconnecting, setReconnecting] = useState(false)

  async function handleReconnect() {
    if (!store.shopify_domain) return
    setReconnecting(true)
    try {
      const url = await startShopifyOAuth(token, store.shopify_domain, store.name)
      window.location.href = url
    } catch {
      setReconnecting(false)
    }
  }

  function handleSaveName() {
    if (!name.trim() || name === store.name) {
      setEditing(false)
      setName(store.name)
      return
    }
    updateMutation.mutate(
      { storeId: store.id, name: name.trim() },
      { onSuccess: () => setEditing(false) }
    )
  }

  return (
    <SettingsCard>
      <div className="flex flex-col gap-3">
        {/* Header: name + status */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {editing ? (
              <div className="flex items-center gap-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-8 w-48"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName()
                    if (e.key === 'Escape') { setEditing(false); setName(store.name) }
                  }}
                />
                <Button size="sm" variant="ghost" onClick={handleSaveName} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : 'Save'}
                </Button>
              </div>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                {store.name}
                <Pencil className="size-3 text-muted-foreground" />
              </button>
            )}
          </div>

          <StatusBadge
            status={needsReauth ? 'reauth' : isConnected ? 'active' : 'disconnected'}
            label={needsReauth ? 'Reconnect required' : isConnected ? 'Connected' : 'Disconnected'}
          />
        </div>

        {/* Domain + dates */}
        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          <p>{store.shopify_domain}</p>
          {store.shopify_connected_at && (
            <p>Connected {new Date(store.shopify_connected_at).toLocaleDateString()}</p>
          )}
        </div>

        {needsReauth && (
          <div className="flex flex-col gap-2 rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2.5">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Shopify rejected this store&apos;s access token. Reconnect to restore order, refund and customer data.
            </p>
            <Button
              size="sm"
              onClick={() => { void handleReconnect() }}
              disabled={isSuspended || reconnecting || !canManage || !store.shopify_domain}
              title={adminTitle}
              className="self-start"
            >
              {reconnecting ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowUpRight className="size-3.5" />}
              Reconnect Shopify
            </Button>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          {isConnected && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDisconnectOpen(true)}
              disabled={isSuspended || disconnectMutation.isPending || !canManage}
              title={adminTitle}
            >
              <Unplug className="size-3.5" />
              Disconnect
            </Button>
          )}
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
            disabled={isSuspended || deleteMutation.isPending || !canManage}
            title={adminTitle}
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        </div>

        {/* Per-store email configs (expandable) */}
        <div className="border-t border-border pt-3">
          <button
            onClick={() => setEmailsExpanded(!emailsExpanded)}
            className="flex w-full items-center justify-between text-sm font-medium text-foreground"
          >
            <span className="flex items-center gap-1.5">
              <Mail className="size-3.5 text-muted-foreground" />
              Email accounts ({emailConfigs?.length ?? 0})
            </span>
            <ChevronDown className={cn('size-3.5 text-muted-foreground transition-transform', emailsExpanded && 'rotate-180')} />
          </button>

          {emailsExpanded && (
            <div className="mt-2 flex flex-col gap-2">
              {emailConfigs?.map((config) => (
                <div key={config.id} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="capitalize text-xs text-muted-foreground">{config.provider}</span>
                    <span className="text-foreground">{config.email_address}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteEmailMutation.mutate({ storeId: store.id, configId: config.id })}
                    disabled={deleteEmailMutation.isPending || !canManage}
                    title={adminTitle}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              ))}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Email Forwarding (recommended) */}
                <button
                  type="button"
                  onClick={() => setForwardingModalOpen(true)}
                  disabled={!canManage}
                  title={adminTitle}
                  className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-left text-xs font-semibold text-foreground transition-colors hover:border-primary/50 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="flex size-5 items-center justify-center flex-shrink-0">
                    <Mail className="size-4 text-muted-foreground" />
                  </span>
                  <span className="flex-1">Email Forwarding</span>
                  <Plus className="size-3 text-muted-foreground flex-shrink-0" />
                </button>

                {/* Gmail */}
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = `/api/auth/gmail?t=${token}&store_id=${store.id}`
                  }}
                  disabled={!canManage}
                  title={adminTitle}
                  className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-left text-xs font-semibold text-foreground transition-colors hover:border-primary/50 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="flex size-5 items-center justify-center flex-shrink-0">
                    <Image src="/icons/gmail.svg" alt="Gmail" width={18} height={14} />
                  </span>
                  <span className="flex-1">Gmail</span>
                  <ArrowUpRight className="size-3 text-muted-foreground flex-shrink-0" />
                </button>

                {/* Outlook */}
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = `/api/auth/outlook?t=${token}&store_id=${store.id}`
                  }}
                  disabled={!canManage}
                  title={adminTitle}
                  className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-left text-xs font-semibold text-foreground transition-colors hover:border-primary/50 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="flex size-5 items-center justify-center flex-shrink-0">
                    <Image src="/icons/outlook.svg" alt="Outlook" width={18} height={18} />
                  </span>
                  <span className="flex-1">Outlook</span>
                  <ArrowUpRight className="size-3 text-muted-foreground flex-shrink-0" />
                </button>

                {/* Custom IMAP */}
                <button
                  type="button"
                  onClick={() => setCustomModalOpen(true)}
                  disabled={!canManage}
                  title={adminTitle}
                  className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-left text-xs font-semibold text-foreground transition-colors hover:border-primary/50 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="flex size-5 items-center justify-center flex-shrink-0">
                    <Mail className="size-4 text-muted-foreground" />
                  </span>
                  <span className="flex-1">Custom (IMAP)</span>
                  <Plus className="size-3 text-muted-foreground flex-shrink-0" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={disconnectOpen}
        onOpenChange={setDisconnectOpen}
        title="Disconnect store?"
        description="The Shopify access token will be revoked. Order data stays. You can reconnect later."
        confirmLabel="Disconnect"
        variant="danger"
        loading={disconnectMutation.isPending}
        onConfirm={() => {
          disconnectMutation.mutate(store.id, { onSuccess: () => setDisconnectOpen(false) })
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete store?"
        description="The store and its email configs will be removed. Existing orders will be kept but unlinked."
        confirmLabel="Delete"
        variant="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          deleteMutation.mutate(store.id, { onSuccess: () => setDeleteOpen(false) })
        }}
      />

      <CustomEmailModal
        open={customModalOpen}
        onOpenChange={setCustomModalOpen}
        storeId={store.id}
      />
      <ForwardingSetupWizard
        open={forwardingModalOpen}
        onOpenChange={setForwardingModalOpen}
      />
    </SettingsCard>
  )
}
