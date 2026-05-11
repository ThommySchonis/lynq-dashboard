'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
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
import { useConnectShopify } from '@/hooks/settings'

interface ShopifyConnectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ShopifyConnectModal({ open, onOpenChange }: ShopifyConnectModalProps) {
  const [domain, setDomain] = useState('')
  const [accessToken, setAccessToken] = useState('')

  const connectMutation = useConnectShopify()

  function handleClose() {
    if (connectMutation.isPending) return
    setDomain('')
    setAccessToken('')
    onOpenChange(false)
  }

  async function handleConnect() {
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
    if (e.key === 'Enter') handleConnect()
  }

  const canSubmit = domain.trim().length > 0 && accessToken.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent showCloseButton={!connectMutation.isPending}>
        <DialogHeader>
          <DialogTitle>Connect Shopify</DialogTitle>
          <DialogDescription>
            Enter your Shopify store domain and Admin API access token.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4" onKeyDown={handleKeyDown}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="shopify-domain">Store domain</Label>
            <Input
              id="shopify-domain"
              type="text"
              value={domain}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDomain(e.target.value)}
              placeholder="your-store.myshopify.com"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              disabled={connectMutation.isPending}
            />
            <p className="text-xs text-muted-foreground">
              Must end with <span className="font-medium text-foreground">.myshopify.com</span>
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="shopify-token">Access token</Label>
            <PasswordInput
              id="shopify-token"
              value={accessToken}
              onChange={setAccessToken}
              placeholder="shpat_..."
              disabled={connectMutation.isPending}
            />
            <p className="text-xs text-muted-foreground">
              Found in Shopify Admin → Apps → Develop apps → API credentials
            </p>
          </div>
        </div>

        <DialogFooter showCloseButton={!connectMutation.isPending}>
          <Button
            onClick={handleConnect}
            disabled={!canSubmit || connectMutation.isPending}
          >
            {connectMutation.isPending && <Loader2 className="size-3.5 animate-spin" />}
            {connectMutation.isPending ? 'Connecting…' : 'Connect Shopify'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
