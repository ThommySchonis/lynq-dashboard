'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { sanitizeHtml } from '@/lib/inbox-utils'
import { useAuthStore } from '@/stores/auth'
import { useCustomerSearch, useEmailAccountInfo } from './use-inbox-data'
import { useComposeEmail } from './use-inbox-mutations'

/** Shopify customer shape returned by useCustomerSearch (subset the ticket card reads). */
export interface TicketCustomer {
  firstName?: string
  lastName?: string
  email?: string
  city?: string
  country?: string
  totalSpent?: string | number
  currency?: string
  tags?: string
}
interface CustomerSearchResult {
  customer?: TicketCustomer
  orders?: Array<Record<string, unknown>>
}

/** A complete-looking email is "x@y.z" — gates the customer lookup so it doesn't
 *  fire on every keystroke while the To field is half-typed. */
function looksLikeEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

/**
 * Owns all Create Ticket form state + the send flow, so the page stays a thin
 * orchestrator. The customer card auto-resolves from the To address (no separate
 * search field). Submit currently maps to the compose endpoint; the two-step
 * persist (metadata + assignee + tags) lands in a follow-up once wired.
 */
export function useCreateTicketForm() {
  const router = useRouter()
  const isSuspended = useAuthStore((s) => s.isSuspended)
  const { data: accountInfo } = useEmailAccountInfo()
  const composeEmail = useComposeEmail()

  // Recipients + subject
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [cc, setCc] = useState('')
  const [bcc, setBcc] = useState('')
  const [showCC, setShowCC] = useState(false)

  // Priority + assignee live in the subject header (Figma). assignedTo is
  // persisted via bulk `assign` in the two-step follow-up; priority + the
  // contact meta go into the conversation metadata (BE #11).
  const [priority, setPriority] = useState('normal')
  const [assignedTo, setAssignedTo] = useState<string | null>(null)
  const [contactReason, setContactReason] = useState('')
  const [product, setProduct] = useState('')
  const [resolution, setResolution] = useState('')
  const [tags, setTags] = useState<string[]>([])

  // Auto-resolve the customer from the To address (Figma "Ticket details" card).
  const customerQuery = looksLikeEmail(to) ? to.trim() : ''
  const { data: customerData } = useCustomerSearch(customerQuery)
  const customer = (customerData as CustomerSearchResult | undefined)?.customer ?? null
  const ordersCount = (customerData as CustomerSearchResult | undefined)?.orders?.length ?? 0

  const goBack = useCallback(() => router.push('/inbox'), [router])

  /** Send the new outgoing email. Body is owned by the composer and passed in. */
  const send = useCallback(
    async (bodyHtml: string, bodyText: string) => {
      if (isSuspended) {
        toast.error('Workspace is suspended')
        return
      }
      if (!to.trim()) {
        toast.error('Please enter a recipient email')
        return
      }
      // Demo mode (no provider connected) — mirror the live page's stub.
      if (!accountInfo?.connected) {
        await new Promise((r) => setTimeout(r, 800))
        toast.success('Message sent!')
        setTimeout(goBack, 700)
        return
      }
      composeEmail.mutate(
        {
          to: [{ email: to.trim(), name: '' }],
          subject: subject.trim() || '(no subject)',
          bodyHtml: sanitizeHtml(bodyHtml),
          bodyText,
          cc: cc.trim() ? [{ email: cc.trim(), name: '' }] : undefined,
          bcc: bcc.trim() ? [{ email: bcc.trim(), name: '' }] : undefined,
        },
        {
          onSuccess: () => {
            toast.success('Message sent!')
            setTimeout(goBack, 700)
          },
          onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to send'),
        },
      )
    },
    [to, subject, cc, bcc, accountInfo?.connected, composeEmail, goBack, isSuspended],
  )

  return useMemo(
    () => ({
      to, setTo, subject, setSubject, cc, setCc, bcc, setBcc, showCC, setShowCC,
      priority, setPriority, assignedTo, setAssignedTo,
      contactReason, setContactReason, product, setProduct,
      resolution, setResolution, tags, setTags,
      customer, ordersCount, accountInfo,
      send, isSending: composeEmail.isPending || isSuspended, goBack,
    }),
    [to, subject, cc, bcc, showCC, priority, assignedTo, contactReason, product, resolution,
     tags, customer, ordersCount, accountInfo, send, composeEmail.isPending, isSuspended, goBack],
  )
}

export type CreateTicketForm = ReturnType<typeof useCreateTicketForm>
