'use client'

import { useState } from 'react'
import { CreditCard, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { BillingInfoForm } from './billing-info-form'
import { ChangePaymentMethodModal } from './change-payment-method-modal'
import { useBillingInfo, usePaymentMethods } from '@/hooks/billing'

/**
 * Tab 2 — Payment Information. Three sections:
 *   1. Payment method (Whop-fed, empty until integration lands)
 *   2. Billing frequency (monthly only)
 *   3. Billing information (editable via modal)
 *   4. Consulting agency partner (informational)
 */
export function PaymentInfoTab() {
  const { data: billingInfo, isLoading: billingLoading }    = useBillingInfo()
  const { data: paymentMethods = [], isLoading: pmLoading } = usePaymentMethods()

  const [paymentModalOpen, setPaymentModalOpen]   = useState(false)
  const [billingModalOpen, setBillingModalOpen]   = useState(false)

  const defaultMethod = paymentMethods.find(m => m.is_default) ?? paymentMethods[0] ?? null

  return (
    <div className="flex flex-col gap-6">
      {/* ── Section 1: Payment method ───────────────────────────── */}
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Payment method</h3>
          <Button type="button" size="sm" variant="ghost" onClick={() => setPaymentModalOpen(true)}>
            {defaultMethod ? 'Change' : 'Add'}
          </Button>
        </div>

        {pmLoading ? (
          <Skeleton className="h-10 w-3/4" />
        ) : defaultMethod ? (
          <div className="flex items-center gap-3 text-sm">
            <div className="flex size-8 items-center justify-center rounded-md bg-foreground/5">
              <CreditCard size={16} strokeWidth={1.75} className="text-foreground/70" />
            </div>
            <span className="font-medium capitalize">{defaultMethod.brand || defaultMethod.type}</span>
            {defaultMethod.last_four && (
              <span className="text-muted-foreground">ending in {defaultMethod.last_four}</span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-secondary/30 p-4">
            <Plus size={16} strokeWidth={1.75} className="text-muted-foreground" />
            <span className="text-sm text-muted-foreground">No payment method on file</span>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          Payments are securely processed by Whop. Charges appear as{' '}
          <span className="font-mono">WHOP * LYNQ FLOW</span> on your statement.
        </p>
      </section>

      {/* ── Section 2: Billing frequency ───────────────────────── */}
      <section className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">Billing frequency</h3>
          <p className="text-xs text-muted-foreground">All plans are billed monthly.</p>
        </div>
        <Button type="button" size="sm" variant="ghost" disabled title="Annual billing coming later">
          Change frequency
        </Button>
      </section>

      {/* ── Section 3: Billing information ─────────────────────── */}
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Billing information</h3>
          <Button type="button" size="sm" variant="ghost" onClick={() => setBillingModalOpen(true)}>
            {billingInfo ? 'Update' : 'Add'}
          </Button>
        </div>

        {billingLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : billingInfo ? (
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Email</dt>
              <dd>{billingInfo.billing_email}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Organization</dt>
              <dd>{billingInfo.organization_name}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Address</dt>
              <dd>
                {billingInfo.address_line1}
                {billingInfo.address_line2 && <>, {billingInfo.address_line2}</>}
                <br />
                {billingInfo.city}, {billingInfo.postal_code}
                {billingInfo.state && <> · {billingInfo.state}</>}
                <br />
                {billingInfo.country}
              </dd>
            </div>
            {billingInfo.vat_number && (
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">VAT number</dt>
                <dd className="font-mono text-xs">{billingInfo.vat_number}</dd>
              </div>
            )}
          </dl>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
            No billing information yet. Add details before your first invoice is issued.
          </div>
        )}
      </section>

      {/* ── Section 4: Consulting agency partner ───────────────── */}
      <section className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">Consulting agency partner</h3>
          <p className="text-xs text-muted-foreground">lynqagency.com</p>
        </div>
      </section>

      {/* Modals */}
      <ChangePaymentMethodModal open={paymentModalOpen} onOpenChange={setPaymentModalOpen} />

      <Dialog open={billingModalOpen} onOpenChange={setBillingModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{billingInfo ? 'Update billing information' : 'Add billing information'}</DialogTitle>
            <DialogDescription>
              VAT number is required for EU customers (reverse-charge invoicing).
            </DialogDescription>
          </DialogHeader>
          <BillingInfoForm
            initial={billingInfo ?? null}
            onSaved={() => setBillingModalOpen(false)}
            onCancel={() => setBillingModalOpen(false)}
          />
          <DialogFooter />
        </DialogContent>
      </Dialog>
    </div>
  )
}
