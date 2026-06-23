'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { sanitizeHtml, parseRecipientList } from '@/lib/inbox-utils'
import { useAuthStore } from '@/stores/auth'
import { useCustomerSearch, useEmailAccountInfo } from './use-inbox-data'
import { useComposeEmail, useUpdateStatus, useBulkConversationAction } from './use-inbox-mutations'
import { useTags, useCreateTag } from './use-tags'

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
 * search field). Submit is two-step: compose the email, then best-effort persist
 * ticket meta (priority + contact fields → metadata, assignee, tags) onto the
 * created conversation.
 */
export function useCreateTicketForm() {
  const router = useRouter()
  const isSuspended = useAuthStore((s) => s.isSuspended)
  const { data: accountInfo } = useEmailAccountInfo()
  const composeEmail = useComposeEmail()
  const updateStatus = useUpdateStatus()
  const bulkAction = useBulkConversationAction()
  const createTag = useCreateTag()
  const { data: allTags = [] } = useTags()

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

  /** Step 2 — persist ticket meta onto the freshly created conversation:
   *  priority + contact fields into metadata (BE #11), assignee via bulk `assign`,
   *  and each tag name resolved to an id (existing or newly created) then attached.
   *  Best-effort: the email is already sent, so failures here are swallowed. */
  const persistTicketMeta = useCallback(
    async (conversationId: string) => {
      const tasks: Array<Promise<unknown>> = []

      // priority + contact meta → conversation metadata
      const metadata: Record<string, string> = { priority }
      if (contactReason.trim()) metadata.contact_reason = contactReason.trim()
      if (product.trim()) metadata.product = product.trim()
      if (resolution.trim()) metadata.resolution = resolution.trim()
      tasks.push(updateStatus.mutateAsync({ threadId: conversationId, status: 'open', metadata }))

      // assignee
      if (assignedTo) {
        tasks.push(bulkAction.mutateAsync({ ids: [conversationId], action: 'assign', payload: { memberId: assignedTo } }))
      }

      // tags — resolve each name to an id concurrently (creating missing ones),
      // then attach. Runs in parallel with the status/assign mutations above.
      const tagIds = await Promise.all(
        tags
          .map((name) => name.trim())
          .filter(Boolean)
          .map(async (trimmed) => {
            const existing = allTags.find((t) => t.name.toLowerCase() === trimmed.toLowerCase())
            return existing?.id ?? (await createTag.mutateAsync({ name: trimmed })).id
          }),
      )
      for (const tagId of tagIds) {
        tasks.push(bulkAction.mutateAsync({ ids: [conversationId], action: 'add_tag', payload: { tagId } }))
      }

      await Promise.allSettled(tasks)
    },
    [priority, contactReason, product, resolution, assignedTo, tags, updateStatus, bulkAction, createTag, allTags],
  )

  /** Send the new outgoing email, then persist ticket meta (two-step). Body is
   *  owned by the composer and passed in. */
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
      // Demo mode (no provider connected) — no conversation to persist against.
      if (!accountInfo?.connected) {
        await new Promise((r) => setTimeout(r, 800))
        toast.success('Message sent!')
        setTimeout(goBack, 700)
        return
      }
      try {
        const data = await composeEmail.mutateAsync({
          to: parseRecipientList(to),
          subject: subject.trim() || '(no subject)',
          bodyHtml: sanitizeHtml(bodyHtml),
          bodyText,
          cc: cc.trim() ? parseRecipientList(cc) : undefined,
          bcc: bcc.trim() ? parseRecipientList(bcc) : undefined,
        })
        if (data.conversationId) {
          // Best-effort: a meta failure must not surface as a send failure.
          try { await persistTicketMeta(data.conversationId) } catch { /* email already sent */ }
        }
        toast.success('Message sent!')
        setTimeout(goBack, 700)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to send')
      }
    },
    [to, subject, cc, bcc, accountInfo?.connected, composeEmail, goBack, isSuspended, persistTicketMeta],
  )

  // Plain object — consumers (the three panels) re-render on form-state changes
  // regardless, and send/goBack are already useCallback-stable, so memoizing the
  // whole bag bought nothing but a large dep list to maintain.
  return {
    to, setTo, subject, setSubject, cc, setCc, bcc, setBcc, showCC, setShowCC,
    priority, setPriority, assignedTo, setAssignedTo,
    contactReason, setContactReason, product, setProduct,
    resolution, setResolution, tags, setTags,
    customer, ordersCount, accountInfo,
    send, isSending: composeEmail.isPending || isSuspended, goBack,
  }
}

export type CreateTicketForm = ReturnType<typeof useCreateTicketForm>
