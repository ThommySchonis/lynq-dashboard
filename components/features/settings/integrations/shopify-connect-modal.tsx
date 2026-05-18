'use client'

import { useState } from 'react'
import { Loader2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { PasswordInput } from '@/components/features/settings/password-input'
import { useConnectShopify, startShopifyOAuth } from '@/hooks/settings'
import { useAuthStore } from '@/stores/auth'
import { toast } from 'sonner'

interface ShopifyConnectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ShopifyConnectModal({ open, onOpenChange }: ShopifyConnectModalProps) {
  const [domain, setDomain] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [oauthLoading, setOauthLoading] = useState(false)

  const token = useAuthStore((s) => s.session?.access_token ?? '')
  const connectMutation = useConnectShopify()

  const isBusy = connectMutation.isPending || oauthLoading

  function handleClose() {
    if (isBusy) return
    setDomain('')
    setAccessToken('')
    onOpenChange(false)
  }

  async function handleOAuth() {
    if (!domain.trim()) return
    setOauthLoading(true)
    try {
      const url = await startShopifyOAuth(token, domain.trim())
      window.location.href = url
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start Shopify OAuth')
      setOauthLoading(false)
    }
  }

  async function handleManualConnect() {
    if (!domain.trim() || !accessToken.trim()) return
    await connectMutation.mutateAsync(
      { domain: domain.trim(), access_token: accessToken.trim() },
      {
        onSuccess: () => {
          setDomain('')
          setAccessToken('')
          onOpenChange(false)
        },
      }
    )
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && accessToken.trim()) void handleManualConnect()
  }

  const canOAuth = domain.trim().length > 0
  const canManual = domain.trim().length > 0 && accessToken.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent showCloseButton={!isBusy}>
        <DialogHeader>
          <DialogTitle>Connect Shopify</DialogTitle>
          <DialogDescription>
            Connect your store via Shopify or enter credentials manually.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          {/* ── OAuth section ── */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="shopify-domain-oauth">Store domain</Label>
              <Input
                id="shopify-domain-oauth"
                type="text"
                value={domain}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDomain(e.target.value)}
                placeholder="your-store.myshopify.com"
                autoFocus
                autoComplete="off"
                spellCheck={false}
                disabled={isBusy}
              />
            </div>
            <Button
              onClick={() => void handleOAuth()}
              disabled={!canOAuth || isBusy}
              className="w-full"
            >
              {oauthLoading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ExternalLink className="size-3.5" />
              )}
              {oauthLoading ? 'Redirecting…' : 'Connect with Shopify'}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              We'll redirect you to Shopify to authorize access
            </p>
          </div>

          {/* ── Divider ── */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* ── Manual section ── */}
          <div className="flex flex-col gap-3" onKeyDown={handleKeyDown}>
            {domain.trim() && (
              <p className="text-xs text-muted-foreground">
                Store: <span className="font-medium text-foreground">{domain.trim()}</span>
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="shopify-token">Access token</Label>
              <PasswordInput
                id="shopify-token"
                value={accessToken}
                onChange={setAccessToken}
                placeholder="shpat_..."
                disabled={isBusy}
              />
              <p className="text-xs text-muted-foreground">
                Found in Shopify Admin → Apps → Develop apps → API credentials
              </p>
            </div>
          </div>
        </div>

        <DialogFooter showCloseButton={!isBusy}>
          <Button
            onClick={() => void handleManualConnect()}
            disabled={!canManual || isBusy}
            variant="secondary"
          >
            {connectMutation.isPending && <Loader2 className="size-3.5 animate-spin" />}
            {connectMutation.isPending ? 'Connecting…' : 'Connect with token'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
