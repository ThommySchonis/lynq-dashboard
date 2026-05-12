'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { isEUCountry, isValidVATFormat } from '@/lib/billing/issuer'
import { useUpdateBillingInfo } from '@/hooks/billing'
import type { BillingInfo, UpdateBillingInfoInput } from '@/types/billing'

interface BillingInfoFormProps {
  initial:    BillingInfo | null
  onSaved?:   () => void
  onCancel?:  () => void
}

// Compact country list — most-used customer locales first. Could grow
// to full ISO-3166-1 alpha-2 set later via a separate constants file.
const COUNTRIES: { code: string; name: string }[] = [
  { code: 'US', name: 'United States' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'BE', name: 'Belgium' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'IE', name: 'Ireland' },
  { code: 'AT', name: 'Austria' },
  { code: 'PT', name: 'Portugal' },
  { code: 'PL', name: 'Poland' },
  { code: 'SE', name: 'Sweden' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
]

export function BillingInfoForm({ initial, onSaved, onCancel }: BillingInfoFormProps) {
  const update = useUpdateBillingInfo()
  const [form, setForm] = useState<UpdateBillingInfoInput>({
    billing_email:     initial?.billing_email     ?? '',
    organization_name: initial?.organization_name ?? '',
    phone_number:      initial?.phone_number      ?? '',
    address_line1:     initial?.address_line1     ?? '',
    address_line2:     initial?.address_line2     ?? '',
    city:              initial?.city              ?? '',
    postal_code:       initial?.postal_code       ?? '',
    country:           initial?.country           ?? 'US',
    state:             initial?.state             ?? '',
    vat_number:        initial?.vat_number        ?? '',
  })

  useEffect(() => {
    if (initial) {
      setForm({
        billing_email:     initial.billing_email,
        organization_name: initial.organization_name,
        phone_number:      initial.phone_number ?? '',
        address_line1:     initial.address_line1,
        address_line2:     initial.address_line2 ?? '',
        city:              initial.city,
        postal_code:       initial.postal_code,
        country:           initial.country,
        state:             initial.state ?? '',
        vat_number:        initial.vat_number ?? '',
      })
    }
  }, [initial])

  const country = (form.country ?? '').toUpperCase()
  const isEU    = isEUCountry(country)
  const isUS    = country === 'US'

  const vatOk = !form.vat_number || isValidVATFormat(form.vat_number)
  const canSubmit =
    !!form.billing_email?.trim() &&
    !!form.organization_name?.trim() &&
    !!form.address_line1?.trim() &&
    !!form.city?.trim() &&
    !!form.postal_code?.trim() &&
    !!form.country?.trim() &&
    (!isEU || !!form.vat_number?.trim()) &&
    (!isUS || !!form.state?.trim()) &&
    vatOk

  function set<K extends keyof UpdateBillingInfoInput>(key: K, value: UpdateBillingInfoInput[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || update.isPending) return
    update.mutate(form, { onSuccess: () => onSaved?.() })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="billing_email">Billing email *</Label>
          <Input
            id="billing_email"
            type="email"
            value={form.billing_email ?? ''}
            onChange={e => set('billing_email', e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="organization_name">Organization *</Label>
          <Input
            id="organization_name"
            value={form.organization_name ?? ''}
            onChange={e => set('organization_name', e.target.value)}
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="phone_number">Phone (optional)</Label>
        <Input
          id="phone_number"
          type="tel"
          value={form.phone_number ?? ''}
          onChange={e => set('phone_number', e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="address_line1">Address line 1 *</Label>
        <Input
          id="address_line1"
          value={form.address_line1 ?? ''}
          onChange={e => set('address_line1', e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="address_line2">Address line 2</Label>
        <Input
          id="address_line2"
          value={form.address_line2 ?? ''}
          onChange={e => set('address_line2', e.target.value)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="city">City *</Label>
          <Input
            id="city"
            value={form.city ?? ''}
            onChange={e => set('city', e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="postal_code">Postal code *</Label>
          <Input
            id="postal_code"
            value={form.postal_code ?? ''}
            onChange={e => set('postal_code', e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="country">Country *</Label>
          <Select value={form.country ?? 'US'} onValueChange={v => v && set('country', v)}>
            <SelectTrigger id="country">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map(c => (
                <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isUS && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="state">State *</Label>
          <Input
            id="state"
            value={form.state ?? ''}
            onChange={e => set('state', e.target.value)}
            placeholder="e.g. CA, NY, TX"
            required
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="vat_number">
          VAT Number {isEU && <span className="text-destructive">*</span>}
        </Label>
        <Input
          id="vat_number"
          value={form.vat_number ?? ''}
          onChange={e => set('vat_number', e.target.value.toUpperCase().replace(/\s/g, ''))}
          placeholder="e.g. NL123456789B01"
          required={isEU}
          aria-invalid={!vatOk}
        />
        {!vatOk && (
          <p className="text-xs text-destructive">
            VAT format invalid — expected 2-letter country code + 8-12 alphanumerics.
          </p>
        )}
        {isEU && (
          <p className="text-xs text-muted-foreground">
            Required for EU customers. Lynq &amp; Flow LLC is a US entity not registered for EU VAT —
            invoices use Article 196 reverse-charge.
          </p>
        )}
      </div>

      <div className="mt-2 flex items-center justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={update.isPending}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={!canSubmit || update.isPending}>
          {update.isPending ? 'Saving…' : 'Save billing info'}
        </Button>
      </div>
    </form>
  )
}
