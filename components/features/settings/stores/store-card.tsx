'use client'

import { useState } from 'react'
import { ChevronDown, Loader2, Mail, Pencil, Trash2, Unplug, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SettingsCard } from '@/components/features/settings/settings-section'
import { StatusBadge } from '@/components/features/settings/status-badge'
import { ConfirmDialog } from '@/components/features/settings/confirm-dialog'
import { useUpdateStore, useDisconnectStore, useDeleteStore, useDeleteStoreEmailConfig } from '@/hooks/stores'
import { useStoreEmailConfigs } from '@/hooks/stores'
import { useAuthStore } from '@/stores/auth'
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

  const updateMutation = useUpdateStore()
  const disconnectMutation = useDisconnectStore()
  const deleteMutation = useDeleteStore()
  const deleteEmailMutation = useDeleteStoreEmailConfig()
  const { data: emailConfigs } = useStoreEmailConfigs(store.id)
  const token = useAuthStore((s) => s.session?.access_token ?? '')

  const isConnected = !!store.shopify_connected_at

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
            status={isConnected ? 'active' : 'disconnected'}
            label={isConnected ? 'Connected' : 'Disconnected'}
          />
        </div>

        {/* Domain + dates */}
        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          <p>{store.shopify_domain}</p>
          {store.shopify_connected_at && (
            <p>Connected {new Date(store.shopify_connected_at).toLocaleDateString()}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          {isConnected && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDisconnectOpen(true)}
              disabled={disconnectMutation.isPending}
            >
              <Unplug className="size-3.5" />
              Disconnect
            </Button>
          )}
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
            disabled={deleteMutation.isPending}
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
                    disabled={deleteEmailMutation.isPending}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              ))}

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    window.location.href = `/api/auth/gmail?t=${token}&store_id=${store.id}`
                  }}
                >
                  Add Gmail
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    window.location.href = `/api/auth/outlook?t=${token}&store_id=${store.id}`
                  }}
                >
                  Add Outlook
                </Button>
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
    </SettingsCard>
  )
}
