'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SettingsSection, SettingsCard } from '@/components/features/settings/settings-section'
import { StatusBadge } from '@/components/features/settings/status-badge'
import { ConfirmDialog } from '@/components/features/settings/confirm-dialog'
import { ShopifyConnectModal } from '@/components/features/settings/integrations/shopify-connect-modal'
import { useShopifyIntegration, useDisconnectShopify } from '@/hooks/settings'

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_state: 'Authorization failed. Please try again.',
  invalid_hmac: 'Authorization failed. Please try again.',
  token_exchange_failed: 'Could not complete Shopify authorization. Please try again.',
  no_workspace: 'No workspace found. Please contact support.',
  save_failed: 'Failed to save connection. Please try again.',
}

function useShopifyOAuthRedirectToast() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const shopify = searchParams.get('shopify')
    const error = searchParams.get('error')

    if (shopify === 'connected') {
      toast.success('Shopify connected')
      window.history.replaceState({}, '', window.location.pathname)
    } else if (error) {
      toast.error(OAUTH_ERROR_MESSAGES[error] || 'Something went wrong. Please try again.')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [searchParams])
}

const REQUIRED_SCOPES = [
  { label: 'read_orders', desc: 'Access order history and status' },
  { label: 'read_customers', desc: 'Look up customer profiles in tickets' },
  { label: 'read_products', desc: 'Display product info in conversations' },
  { label: 'read_fulfillments', desc: 'Track shipment and delivery status' },
]

export function ShopifySettings() {
  const [connectOpen, setConnectOpen] = useState(false)
  const [disconnectOpen, setDisconnectOpen] = useState(false)

  const { data: integration, isLoading } = useShopifyIntegration()
  const disconnectMutation = useDisconnectShopify()
  useShopifyOAuthRedirectToast()

  const isConnected =
    integration?.status === 'active' ||
    (!!integration?.domain && !!integration?.connected_at)

  function handleDisconnect() {
    disconnectMutation.mutate(undefined, {
      onSuccess: () => setDisconnectOpen(false),
    })
  }

  return (
    <div className="max-w-3xl mx-auto px-10 py-12 flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Shopify</h1>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          Connect your Shopify store to pull order data into tickets and unlock the AI Macro Generator.
        </p>
      </div>

      {/* Connection status */}
      <SettingsSection title="Connection">
        <SettingsCard>
          {isLoading ? (
            <div className="flex items-center gap-2.5 py-2 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin flex-shrink-0" />
              Loading…
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <StatusBadge
                  status={isConnected ? 'active' : 'disconnected'}
                  label={isConnected ? `Connected · ${integration?.domain ?? ''}` : 'Not connected'}
                />

                {isConnected ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDisconnectOpen(true)}
                    disabled={disconnectMutation.isPending}
                  >
                    {disconnectMutation.isPending && (
                      <Loader2 className="size-3.5 animate-spin" />
                    )}
                    {disconnectMutation.isPending ? 'Disconnecting…' : 'Disconnect'}
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => setConnectOpen(true)}>
                    <ShoppingBag className="size-3.5" />
                    Connect Shopify
                  </Button>
                )}
              </div>

              {isConnected && integration?.domain && (
                <p className="text-xs text-muted-foreground">
                  Connected store:{' '}
                  <span className="font-medium text-foreground">{integration.domain}</span>
                </p>
              )}
            </div>
          )}
        </SettingsCard>
      </SettingsSection>

      {/* Required scopes info */}
      <SettingsSection
        title="What you'll need"
        description="To connect Shopify, create a custom app in your Shopify Admin with the following API access scopes."
      >
        <SettingsCard>
          <ul className="flex flex-col gap-3">
            {REQUIRED_SCOPES.map((scope) => (
              <li key={scope.label} className="flex items-start gap-2.5">
                <span className="mt-1.5 size-1.5 rounded-full bg-primary flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">{scope.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{scope.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </SettingsCard>
      </SettingsSection>

      {/* Connect modal */}
      <ShopifyConnectModal open={connectOpen} onOpenChange={setConnectOpen} />

      {/* Disconnect confirm dialog */}
      <ConfirmDialog
        open={disconnectOpen}
        onOpenChange={setDisconnectOpen}
        title="Disconnect Shopify?"
        description="Order data will no longer be available in tickets. You can reconnect at any time."
        confirmLabel="Disconnect"
        variant="danger"
        loading={disconnectMutation.isPending}
        onConfirm={handleDisconnect}
      />
    </div>
  )
}
