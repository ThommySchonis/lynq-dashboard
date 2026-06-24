'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ArrowUpRight, ChevronDown, Loader2, Mail, Pencil, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/features/settings/status-badge'
import { CustomEmailModal } from '@/components/features/settings/integrations/custom-email-modal'
import { ForwardingSetupWizard } from '@/components/features/settings/integrations/forwarding/forwarding-setup-wizard'
import {
  useUpdateStore,
  useStoreEmailAccounts,
  useDeleteStoreEmailAccount,
} from '@/hooks/stores'
import { startShopifyOAuth } from '@/hooks/settings/use-integration-mutations'
import { useAuthStore } from '@/stores/auth'
import { usePermissions } from '@/hooks/use-permissions'
import type { StorePublic } from '@/types/stores'

interface StoreManageModalProps {
  store: StorePublic
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function StoreManageModal({ store, open, onOpenChange }: StoreManageModalProps) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(store.name)
  const [emailsExpanded, setEmailsExpanded] = useState(false)
  const [customModalOpen, setCustomModalOpen] = useState(false)
  const [forwardingModalOpen, setForwardingModalOpen] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)

  const updateMutation = useUpdateStore()
  const deleteEmailMutation = useDeleteStoreEmailAccount()
  const { data: emailConfigs } = useStoreEmailAccounts(store.id)
  const token = useAuthStore((s) => s.session?.access_token ?? '')
  const isSuspended = useAuthStore((s) => s.isSuspended)
  const { can } = usePermissions()
  const canManage = can.manageWorkspace
  const adminTitle = canManage ? undefined : 'Admin access required to manage store connections.'

  const isConnected = !!store.shopify_connected_at
  const needsReauth = store.status === 'reauth_required'

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
      { onSuccess: () => setEditing(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage store</DialogTitle>
          <DialogDescription>{store.shopify_domain}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Name + status */}
          <div className="flex items-center justify-between gap-3">
            {editing ? (
              <div className="flex items-center gap-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-8 w-48"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName()
                    if (e.key === 'Escape') {
                      setEditing(false)
                      setName(store.name)
                    }
                  }}
                />
                <Button size="sm" variant="ghost" onClick={handleSaveName} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : 'Save'}
                </Button>
              </div>
            ) : (
              <button
                onClick={() => setEditing(true)}
                disabled={!canManage}
                title={adminTitle}
                className="flex items-center gap-1.5 text-sm font-semibold text-foreground transition-colors hover:text-primary"
              >
                {store.name}
                <Pencil className="size-3 text-muted-foreground" />
              </button>
            )}

            <StatusBadge
              status={needsReauth ? 'reauth' : isConnected ? 'active' : 'disconnected'}
              label={needsReauth ? 'Reconnect required' : isConnected ? 'Connected' : 'Disconnected'}
            />
          </div>

          {needsReauth && (
            <div className="flex flex-col gap-2 rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2.5">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Shopify rejected this store&apos;s access token. Reconnect to restore order, refund and
                customer data.
              </p>
              <Button
                size="sm"
                onClick={() => void handleReconnect()}
                disabled={isSuspended || reconnecting || !canManage || !store.shopify_domain}
                title={adminTitle}
                className="self-start"
              >
                {reconnecting ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowUpRight className="size-3.5" />}
                Reconnect Shopify
              </Button>
            </div>
          )}

          {/* Email accounts */}
          <div className="border-t border-border pt-3">
            <button
              onClick={() => setEmailsExpanded(!emailsExpanded)}
              className="flex w-full items-center justify-between text-sm font-medium text-foreground"
            >
              <span className="flex items-center gap-1.5">
                <Mail className="size-3.5 text-muted-foreground" />
                Email accounts ({emailConfigs?.length ?? 0})
              </span>
              <ChevronDown
                className={cn('size-3.5 text-muted-foreground transition-transform', emailsExpanded && 'rotate-180')}
              />
            </button>

            {emailsExpanded && (
              <div className="mt-2 flex flex-col gap-2">
                {emailConfigs?.map((config) => (
                  <div
                    key={config.id}
                    className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-xs capitalize text-muted-foreground">{config.provider}</span>
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

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <EmailProviderButton onClick={() => setForwardingModalOpen(true)} disabled={!canManage} title={adminTitle} label="Email Forwarding" trailing="plus">
                    <Mail className="size-4 text-muted-foreground" />
                  </EmailProviderButton>
                  <EmailProviderButton onClick={() => { window.location.href = `/api/auth/gmail?t=${token}&store_id=${store.id}` }} disabled={!canManage} title={adminTitle} label="Gmail" trailing="external">
                    <Image src="/icons/gmail.svg" alt="Gmail" width={18} height={14} />
                  </EmailProviderButton>
                  <EmailProviderButton onClick={() => { window.location.href = `/api/auth/outlook?t=${token}&store_id=${store.id}` }} disabled={!canManage} title={adminTitle} label="Outlook" trailing="external">
                    <Image src="/icons/outlook.svg" alt="Outlook" width={18} height={18} />
                  </EmailProviderButton>
                  <EmailProviderButton onClick={() => setCustomModalOpen(true)} disabled={!canManage} title={adminTitle} label="Custom (IMAP)" trailing="plus">
                    <Mail className="size-4 text-muted-foreground" />
                  </EmailProviderButton>
                </div>
              </div>
            )}
          </div>
        </div>

        <CustomEmailModal open={customModalOpen} onOpenChange={setCustomModalOpen} storeId={store.id} />
        <ForwardingSetupWizard open={forwardingModalOpen} onOpenChange={setForwardingModalOpen} />
      </DialogContent>
    </Dialog>
  )
}

function EmailProviderButton({
  onClick,
  disabled,
  title,
  label,
  trailing,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  title?: string
  label: string
  trailing: 'plus' | 'external'
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-left text-xs font-semibold text-foreground transition-colors hover:border-primary/50 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="flex size-5 shrink-0 items-center justify-center">{children}</span>
      <span className="flex-1">{label}</span>
      {trailing === 'plus' ? (
        <Plus className="size-3 shrink-0 text-muted-foreground" />
      ) : (
        <ArrowUpRight className="size-3 shrink-0 text-muted-foreground" />
      )}
    </button>
  )
}
