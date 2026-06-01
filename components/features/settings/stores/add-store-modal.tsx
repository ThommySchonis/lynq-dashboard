'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { Loader2, ExternalLink } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/features/settings/password-input'
import { useConnectShopify } from '@/hooks/settings'
import { useAuthStore } from '@/stores/auth'

/* ── OAuth tab schema ── */
const oauthSchema = z.object({
  name: z.string().min(1, 'Store name is required'),
  domain: z.string().min(1, 'Shopify domain is required')
    .regex(/^[a-zA-Z0-9-]+\.myshopify\.com$/, 'Must be a valid .myshopify.com domain'),
})

type OAuthFormData = z.infer<typeof oauthSchema>

/* ── Manual tab schema ── */
const manualSchema = z.object({
  domain: z.string().min(1, 'Shopify domain is required'),
  accessToken: z.string().min(1, 'Access token is required'),
})

type ManualFormData = z.infer<typeof manualSchema>

interface AddStoreModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddStoreModal({ open, onOpenChange }: AddStoreModalProps) {
  const token = useAuthStore((s) => s.session?.access_token ?? '')
  const isSuspended = useAuthStore((s) => s.isSuspended)
  const connectMutation = useConnectShopify()

  /* ── OAuth form ── */
  const oauthForm = useForm<OAuthFormData>({
    resolver: zodResolver(oauthSchema),
    defaultValues: { name: '', domain: '' },
  })

  /* ── Manual form ── */
  const manualForm = useForm<ManualFormData>({
    resolver: zodResolver(manualSchema),
    defaultValues: { domain: '', accessToken: '' },
  })

  const [oauthLoading, setOauthLoading] = useState(false)
  const isBusy = oauthLoading || connectMutation.isPending

  function handleClose() {
    if (isBusy) return
    oauthForm.reset()
    manualForm.reset()
    onOpenChange(false)
  }

  /* ── OAuth submit ── */
  const [oauthError, setOauthError] = useState<string | null>(null)

  async function onOAuthSubmit(data: OAuthFormData) {
    setOauthLoading(true)
    setOauthError(null)
    try {
      const res = await fetch('/api/auth/shopify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ shop: data.domain, store_name: data.name }),
      })

      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string }

      if (!res.ok) {
        throw new Error(json.error ?? 'Failed to initiate connection')
      }

      oauthForm.reset()
      onOpenChange(false)
      window.location.href = json.url!
    } catch (err) {
      setOauthError(err instanceof Error ? err.message : 'Failed to initiate connection')
      setOauthLoading(false)
    }
  }

  /* ── Manual submit ── */
  async function onManualSubmit(data: ManualFormData) {
    await connectMutation.mutateAsync(
      { domain: data.domain.trim(), access_token: data.accessToken.trim() },
      {
        onSuccess: () => {
          manualForm.reset()
          onOpenChange(false)
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect a new store</DialogTitle>
          <DialogDescription>
            Connect your Shopify store via the app or with an access token.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="oauth">
          <TabsList className="w-full">
            <TabsTrigger value="oauth" disabled={isBusy}>Shopify App</TabsTrigger>
            <TabsTrigger value="manual" disabled={isBusy}>Access Token</TabsTrigger>
          </TabsList>

          {/* ── OAuth tab ── */}
          <TabsContent value="oauth">
            <form
              onSubmit={(e) => { void oauthForm.handleSubmit(onOAuthSubmit)(e) }}
              className="flex flex-col gap-4 pt-2"
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="oauth-name">Store name</Label>
                <Input
                  id="oauth-name"
                  placeholder="e.g. Store NL"
                  disabled={isBusy}
                  {...oauthForm.register('name')}
                />
                {oauthForm.formState.errors.name && (
                  <p className="text-xs text-destructive">{oauthForm.formState.errors.name.message}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="oauth-domain">Shopify domain</Label>
                <Input
                  id="oauth-domain"
                  placeholder="yourstore.myshopify.com"
                  disabled={isBusy}
                  {...oauthForm.register('domain')}
                />
                {oauthForm.formState.errors.domain && (
                  <p className="text-xs text-destructive">{oauthForm.formState.errors.domain.message}</p>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Recommended — we&apos;ll redirect you to Shopify to authorize access
              </p>

              {oauthError && (
                <p className="text-xs text-destructive">{oauthError}</p>
              )}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => handleClose()} disabled={isBusy}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSuspended || isBusy}>
                  {oauthLoading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <ExternalLink className="size-3.5" />
                  )}
                  {oauthLoading ? 'Redirecting…' : 'Connect'}
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* ── Manual tab ── */}
          <TabsContent value="manual">
            <form
              onSubmit={(e) => { void manualForm.handleSubmit(onManualSubmit)(e) }}
              className="flex flex-col gap-4 pt-2"
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="manual-domain">Shopify domain</Label>
                <Input
                  id="manual-domain"
                  placeholder="yourstore.myshopify.com"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={isBusy}
                  {...manualForm.register('domain')}
                />
                {manualForm.formState.errors.domain && (
                  <p className="text-xs text-destructive">{manualForm.formState.errors.domain.message}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="manual-token">Access token</Label>
                <PasswordInput
                  id="manual-token"
                  value={manualForm.watch('accessToken')}
                  onChange={(v) => manualForm.setValue('accessToken', v, { shouldValidate: true })}
                  placeholder="shpat_..."
                  disabled={isBusy}
                />
                {manualForm.formState.errors.accessToken && (
                  <p className="text-xs text-destructive">{manualForm.formState.errors.accessToken.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Found in Shopify Admin → Apps → Develop apps → API credentials
                </p>
              </div>

              {connectMutation.isError && (
                <p className="text-xs text-destructive">{connectMutation.error.message}</p>
              )}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => handleClose()} disabled={isBusy}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSuspended || isBusy}>
                  {connectMutation.isPending && <Loader2 className="size-3.5 animate-spin" />}
                  {connectMutation.isPending ? 'Connecting…' : 'Connect with token'}
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
