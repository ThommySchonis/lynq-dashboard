'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/stores/auth'

const schema = z.object({
  name: z.string().min(1, 'Store name is required'),
  domain: z.string().min(1, 'Shopify domain is required')
    .regex(/^[a-zA-Z0-9-]+\.myshopify\.com$/, 'Must be a valid .myshopify.com domain'),
})

type FormData = z.infer<typeof schema>

interface AddStoreModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddStoreModal({ open, onOpenChange }: AddStoreModalProps) {
  const token = useAuthStore((s) => s.session?.access_token ?? '')
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', domain: '' },
  })

  async function onSubmit(data: FormData) {
    // Initiate Shopify OAuth with store_name
    const res = await fetch('/api/auth/shopify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ shop: data.domain, store_name: data.name }),
    })

    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      throw new Error((d as { error?: string }).error || 'Failed to initiate connection')
    }

    const { authUrl } = await res.json()
    reset()
    onOpenChange(false)
    window.location.href = authUrl
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect a new store</DialogTitle>
          <DialogDescription>
            Enter a display name and your Shopify store domain to start the OAuth connection.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="store-name">Store name</Label>
            <Input
              id="store-name"
              placeholder="e.g. Store NL"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="store-domain">Shopify domain</Label>
            <Input
              id="store-domain"
              placeholder="yourstore.myshopify.com"
              {...register('domain')}
            />
            {errors.domain && (
              <p className="text-xs text-destructive">{errors.domain.message}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
              Connect
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
