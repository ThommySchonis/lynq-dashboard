'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useCreateClient } from '@/hooks/admin'
import { INITIAL_CLIENT_FORM } from '@/lib/admin-constants'
import type { CreateClientForm as CreateClientFormType } from '@/types/admin'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function CreateClientForm() {
  const [form, setForm] = useState<CreateClientFormType>(INITIAL_CLIENT_FORM)
  const mutation = useCreateClient()

  const update = (field: keyof CreateClientFormType, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await mutation.mutateAsync(form)
      toast.success(`Client "${form.company_name}" created successfully`)
      setForm(INITIAL_CLIENT_FORM)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create client')
    }
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-[15px] font-semibold text-foreground mb-0.5">
          Create client
        </div>
        <div className="text-[13px] text-muted-foreground mb-5">
          Create account + configure API integrations
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Account Details
          </div>

          <Label className="mb-1.5">Company Name</Label>
          <Input
            className="mb-3"
            value={form.company_name}
            onChange={(e) => update('company_name', e.target.value)}
            required
            placeholder="Smith Sisters"
          />

          <Label className="mb-1.5">Email</Label>
          <Input
            className="mb-3"
            type="email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            required
            placeholder="client@company.com"
          />

          <Label className="mb-1.5">Password</Label>
          <Input
            className="mb-3"
            type="password"
            value={form.password}
            onChange={(e) => update('password', e.target.value)}
            required
            placeholder="Min. 6 characters"
          />

          <div className="border-t border-border my-4" />

          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Integrations
          </div>

          <Label className="mb-1.5">Shopify Domain</Label>
          <Input
            className="mb-3"
            value={form.shopify_domain}
            onChange={(e) => update('shopify_domain', e.target.value)}
            placeholder="store.myshopify.com"
          />

          <Label className="mb-1.5">Shopify API Key</Label>
          <Input
            className="mb-3"
            value={form.shopify_api_key}
            onChange={(e) => update('shopify_api_key', e.target.value)}
            placeholder="API key"
          />

          <div className="border-t border-border my-4" />

          <Label className="mb-1.5">Parcel Panel API Key</Label>
          <Input
            className="mb-3"
            value={form.parcel_panel_api_key}
            onChange={(e) => update('parcel_panel_api_key', e.target.value)}
            placeholder="Parcel Panel API key"
          />

          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? 'Creating...' : 'Create Client'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
