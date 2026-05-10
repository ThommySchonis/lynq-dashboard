# Inbox Page Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the 2,927-line inbox page monolith into ~25 focused files using Zustand stores, shadcn/ui components, Tiptap editor, and Tailwind CSS while preserving all existing functionality.

**Architecture:** Bottom-up build — types first, then stores, then leaf components (message bubble, thread row), then composite components (thread list, conversation view, customer panel), then page composition. Each component is self-contained and reads from Zustand stores.

**Tech Stack:** Next.js 16.2.3, React 19, Zustand, shadcn/ui (base-nova), Tiptap, Tailwind CSS v4, Lucide React, TypeScript

**Spec:** `docs/superpowers/specs/2026-05-09-inbox-refactor-design.md`

**User preferences:** No commit steps — user handles git themselves. No TDD — this is a UI refactor extracting existing working code.

---

## File Map

### New files to create

```
types/inbox.ts                                — Thread, Message, Note, ShopifyCustomer, ShopifyOrder, Macro types
stores/inbox.ts                               — Conversations, folders, messages, notes, customer
stores/ai.ts                                  — Analyses, translations, AI loading, macro suggestions
stores/ticket-meta.ts                         — Tags, assignee, contact reason (persist localStorage)
lib/inbox-utils.ts                            — authFetch, fmtDate, fmtPrice, relTime, extractEmail, sanitizeHtml
hooks/use-inbox.ts                            — Convenience selectors from inbox store
hooks/use-ai.ts                               — AI action dispatchers
hooks/use-inbox-shortcuts.ts                  — Keyboard shortcuts (j/k/r/Escape)
components/features/inbox/thread-row.tsx      — Single thread row
components/features/inbox/thread-list.tsx      — Folder tabs + search + thread rows + bulk select
components/features/inbox/message-bubble.tsx   — Single message (in/out/note)
components/features/inbox/notes-section.tsx    — Collapsible notes + add input
components/features/inbox/composer.tsx         — Tiptap editor + toolbar + send/resolve
components/features/inbox/customer-panel.tsx   — Right panel: search, info, stats, orders
components/features/inbox/macro-panel.tsx      — Macro search + favorites + AI suggestions
components/features/inbox/macro-manager.tsx    — Full-screen macro CRUD overlay
components/shared/order-card.tsx               — Expandable order with action buttons
components/shared/modals/refund-modal.tsx      — Shopify refund
components/shared/modals/cancel-modal.tsx      — Cancel order
components/shared/modals/duplicate-modal.tsx   — Duplicate as draft
components/shared/modals/edit-address-modal.tsx — Edit shipping address
components/shared/modals/fulfill-modal.tsx     — Mark fulfilled
components/shared/modals/note-modal.tsx        — Edit order note
app/inbox/page.tsx                            — ~80 lines, composing components with responsive layout
```

### Files to delete

```
app/inbox/page.js                             — Replaced entirely by page.tsx + components
```

---

## Task 1: Install Tiptap Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Tiptap packages**

```bash
cd /Users/dendy/Documents/Work/lynq-dashboard && npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-image @tiptap/extension-placeholder
```

- [ ] **Step 2: Verify installation**

```bash
cat package.json | grep tiptap
```

Expected: All 5 Tiptap packages listed in dependencies.

---

## Task 2: Create Inbox Types

**Files:**
- Modify: `types/inbox.ts` (create)
- Modify: `types/index.ts` (add export)

- [ ] **Step 1: Create types/inbox.ts**

```typescript
// types/inbox.ts

export interface Thread {
  id: string
  subject: string
  snippet: string
  from: string
  from_email: string
  from_name: string
  customer_email?: string
  customer_name?: string
  status: 'open' | 'pending' | 'resolved' | 'unlinked' | 'trash' | 'closed'
  created_at: string
  updated_at: string
  last_message_at?: string
  date: string
  unread: boolean
  is_unread?: boolean
}

export interface Message {
  id: string
  thread_id: string
  from: string
  from_email: string
  from_name: string
  body: string
  body_html?: string
  body_text?: string
  direction: 'inbound' | 'outbound'
  sent_at?: string
  created_at: string
  date: string
}

export interface Note {
  id: string
  thread_id: string
  body: string
  author_name: string
  created_at: string
}

export interface ShopifyAddress {
  address1: string
  address2?: string
  city: string
  province: string
  zip: string
  country: string
  name?: string
  first_name?: string
  last_name?: string
  phone?: string
}

export interface ShopifyLineItem {
  id: string
  title: string
  quantity: number
  price: string
  sku?: string
  variant_title?: string
}

export interface ShopifyOrder {
  id: string
  name: string
  created_at: string
  financial_status: string
  fulfillment_status: string | null
  total_price: string
  currency: string
  line_items: ShopifyLineItem[]
  shipping_address: ShopifyAddress | null
  note: string | null
}

export interface ShopifyCustomer {
  id: string
  email: string
  first_name: string
  last_name: string
  phone: string | null
  orders_count: number
  total_spent: string
  addresses: ShopifyAddress[]
  orders: ShopifyOrder[]
}

export interface Macro {
  id: string
  name: string
  content?: string
  body?: string
  tags: string[]
  language: string
  variables?: string[]
  usageCount?: number
  updatedAt?: string
  archived: boolean
  created_at?: string
}

export interface TicketMeta {
  tags: string[]
  assignee: string | null
  contactReason: string | null
  product: string | null
  resolution: string | null
}

export type InboxFolder = 'open' | 'pending' | 'resolved' | 'unlinked' | 'trash'

export interface FolderCounts {
  open: number
  pending: number
  resolved: number
  unlinked: number
  trash: number
}
```

- [ ] **Step 2: Add export to types/index.ts**

Add `export * from './inbox'` to `types/index.ts`.

---

## Task 3: Create Inbox Utility Functions

**Files:**
- Create: `lib/inbox-utils.ts`

- [ ] **Step 1: Create lib/inbox-utils.ts**

Extract these utilities from the current `page.js`:

```typescript
// lib/inbox-utils.ts

export function authFetch(url: string, opts: RequestInit = {}, token: string) {
  return fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...opts.headers,
    },
  })
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return '—'
  }
}

export function fmtPrice(v: string | number, c = 'EUR'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: c || 'EUR' }).format(Number(v) || 0)
}

export function relTime(s: string | null | undefined): string {
  if (!s) return ''
  const diff = Date.now() - new Date(s).getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`
  return new Date(s).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function extractEmail(s: string | null | undefined): string {
  if (!s) return ''
  const m = s.match(/<(.+?)>/)
  return m ? m[1] : s.trim()
}

export function getInitials(name: string): string {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function normalizeSafeUrl(href: string | null, opts?: { allowImages?: boolean }): string | null {
  if (!href) return null
  try {
    const url = new URL(href, window.location.origin)
    if (['http:', 'https:', 'mailto:'].includes(url.protocol)) return url.href
    if (opts?.allowImages && url.protocol === 'data:') return url.href
    return null
  } catch {
    return null
  }
}

export function sanitizeHtml(html = ''): string {
  if (typeof document === 'undefined') return html.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')

  const allowedTags = new Set(['A', 'B', 'BR', 'BLOCKQUOTE', 'CODE', 'DIV', 'EM', 'I', 'LI', 'OL', 'P', 'PRE', 'SPAN', 'STRONG', 'U', 'UL', 'IMG'])
  const template = document.createElement('template')
  template.innerHTML = String(html)

  template.content.querySelectorAll('script,style,iframe,object,embed,form,meta,link').forEach(node => node.remove())
  template.content.querySelectorAll('*').forEach(node => {
    if (!allowedTags.has(node.tagName)) {
      node.replaceWith(...node.childNodes)
      return
    }
    ;[...node.attributes].forEach(attr => {
      const name = attr.name.toLowerCase()
      if (name.startsWith('on') || name === 'style') node.removeAttribute(attr.name)
    })
    if (node.tagName === 'A') {
      const href = normalizeSafeUrl(node.getAttribute('href'))
      if (href) {
        node.setAttribute('href', href)
        node.setAttribute('rel', 'noopener noreferrer')
        node.setAttribute('target', '_blank')
      } else {
        node.removeAttribute('href')
      }
    } else if (node.tagName === 'IMG') {
      const src = normalizeSafeUrl(node.getAttribute('src'), { allowImages: true })
      if (src) node.setAttribute('src', src)
      else node.remove()
      node.removeAttribute('srcset')
    } else {
      ;[...node.attributes].forEach(attr => node.removeAttribute(attr.name))
    }
  })
  return template.innerHTML
}

export function plainTextToSafeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
}

export const EMOJIS = ['😊','😀','🙏','👍','❤️','✅','⚠️','📦','🚚','💰','🔄','❌','✨','💬','🎉','😅','🤔','😢','😡','🥺','🙌','💪','🤝','⏰','🌍','🔔','⭐','📧','👋','😮','🫡','🙌']

export const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open:     { label: 'Open',     color: 'text-blue-500'    },
  pending:  { label: 'Pending',  color: 'text-amber-500'   },
  resolved: { label: 'Resolved', color: 'text-emerald-500' },
  closed:   { label: 'Closed',   color: 'text-zinc-400'    },
}

export const ORDER_STATUS_CONFIG: Record<string, { label: string; variant: string }> = {
  paid:        { label: 'Paid',        variant: 'active'    },
  unpaid:      { label: 'Unpaid',      variant: 'pending'   },
  fulfilled:   { label: 'Fulfilled',   variant: 'delivered' },
  unfulfilled: { label: 'Unfulfilled', variant: 'pending'   },
  partial:     { label: 'Partial',     variant: 'pending'   },
  refunded:    { label: 'Refunded',    variant: 'failed'    },
  cancelled:   { label: 'Cancelled',   variant: 'failed'    },
  voided:      { label: 'Voided',      variant: 'failed'    },
  pending:     { label: 'Pending',     variant: 'pending'   },
  authorized:  { label: 'Authorized',  variant: 'open'      },
}

export const CANCEL_REASONS = [
  { value: 'customer',  label: 'Customer requested' },
  { value: 'fraud',     label: 'Fraudulent'         },
  { value: 'inventory', label: 'Items unavailable'  },
  { value: 'declined',  label: 'Payment declined'   },
  { value: 'other',     label: 'Other'              },
]

export const REFUND_REASONS = [
  { value: 'customer',   label: 'Customer changed mind' },
  { value: 'fraud',      label: 'Fraudulent order'      },
  { value: 'inventory',  label: 'Item out of stock'     },
  { value: 'declined',   label: 'Payment declined'      },
  { value: 'quality',    label: 'Product quality issue'  },
  { value: 'shipping',   label: 'Shipping problem'      },
  { value: 'wrong_item', label: 'Wrong item received'   },
  { value: 'other',      label: 'Other'                 },
]
```

---

## Task 4: Create Zustand Stores

**Files:**
- Create: `stores/inbox.ts`
- Create: `stores/ai.ts`
- Create: `stores/ticket-meta.ts`

- [ ] **Step 1: Create stores/inbox.ts**

The inbox store manages all conversation state. Port the API calls from the current `page.js` using `authFetch` from `lib/inbox-utils.ts`. Key behavior to preserve:

- `loadConversations`: builds query params from folder/search, fetches from `/api/inbox/conversations`, maps response fields (`customer_name` → `from`, `last_message_at` → `date`, etc.), triggers AI analysis
- `selectThread`: fetches `/api/inbox/conversations/{id}`, maps messages, fetches customer data from `/api/shopify/customer`, triggers AI macro suggestions + language detection
- `sendReply`: sanitizes HTML, optionally auto-translates via `/api/ai/translate`, sends to `/api/inbox/conversations/{id}/reply`, reloads conversations + counts on success
- `updateStatus`: optimistic local update + PATCH to `/api/inbox/conversations/{id}`
- `addNote`: POST to `/api/inbox/conversations/{id}/notes`, appends to notes array
- `searchCustomer`: detects order number vs email, fetches from `/api/shopify/customer`

The store receives `token` as a parameter to each action (from `useAuthStore`).

Interface matches the spec exactly (Section 2, `stores/inbox.ts`).

- [ ] **Step 2: Create stores/ai.ts**

The AI store manages intelligence features. Port from current `page.js`:

- `analyzeThreads`: POST to `/api/ai/analyze` with top 25 threads, stores `{urgency, score, reason}` keyed by thread ID
- `generateReply`: POST to `/api/ai/reply`, returns reply text string
- `suggestMacros`: POST to `/api/ai/macros` with subject + snippet, stores suggested macros
- `translateMessage`: POST to `/api/ai/translate`, stores translation keyed by message ID. Uses `'__loading__'` sentinel for loading state
- `detectLanguage`: POST to `/api/ai/translate` with `detectOnly: true`, stores `{code, name}`. Auto-enables translate if code !== 'en'

All API calls use `authFetch` from `lib/inbox-utils.ts`.

- [ ] **Step 3: Create stores/ticket-meta.ts**

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TicketMeta } from '@/types'

interface TicketMetaState {
  meta: Record<string, TicketMeta>
  addTag: (threadId: string, tag: string) => void
  removeTag: (threadId: string, tag: string) => void
  updateField: (threadId: string, key: keyof Omit<TicketMeta, 'tags'>, value: string | null) => void
  getMeta: (threadId: string) => TicketMeta
}

const DEFAULT_META: TicketMeta = {
  tags: [],
  assignee: null,
  contactReason: null,
  product: null,
  resolution: null,
}

export const useTicketMetaStore = create<TicketMetaState>()(
  persist(
    (set, get) => ({
      meta: {},

      addTag: (threadId, tag) =>
        set((state) => {
          const current = state.meta[threadId] || { ...DEFAULT_META }
          if (current.tags.includes(tag)) return state
          return { meta: { ...state.meta, [threadId]: { ...current, tags: [...current.tags, tag] } } }
        }),

      removeTag: (threadId, tag) =>
        set((state) => {
          const current = state.meta[threadId]
          if (!current) return state
          return { meta: { ...state.meta, [threadId]: { ...current, tags: current.tags.filter(t => t !== tag) } } }
        }),

      updateField: (threadId, key, value) =>
        set((state) => {
          const current = state.meta[threadId] || { ...DEFAULT_META }
          return { meta: { ...state.meta, [threadId]: { ...current, [key]: value } } }
        }),

      getMeta: (threadId) => get().meta[threadId] || DEFAULT_META,
    }),
    {
      name: 'lynq_ticket_meta',
    },
  ),
)
```

---

## Task 5: Create Hooks

**Files:**
- Create: `hooks/use-inbox.ts`
- Create: `hooks/use-ai.ts`
- Create: `hooks/use-inbox-shortcuts.ts`

- [ ] **Step 1: Create hooks/use-inbox.ts**

Convenience hook that combines auth token with inbox store actions:

```typescript
'use client'

import { useAuthStore } from '@/stores/auth'
import { useInboxStore } from '@/stores/inbox'

export function useInbox() {
  const token = useAuthStore((s) => s.session?.access_token ?? '')
  const store = useInboxStore()

  return {
    ...store,
    load: (folder?: string) => store.loadConversations(token, folder),
    select: (thread: any) => store.selectThread(thread, token),
    send: (threadId: string, html: string) => store.sendReply(threadId, html, token),
    note: (threadId: string, text: string) => store.addNote(threadId, text, token),
    status: (id: string, s: string) => store.updateStatus(id, s, token),
    sync: () => store.triggerSync(token),
    counts: () => store.fetchCounts(token),
    custSearch: (q: string) => store.searchCustomer(q, token),
  }
}
```

- [ ] **Step 2: Create hooks/use-ai.ts**

Same pattern — wraps AI store actions with auth token:

```typescript
'use client'

import { useAuthStore } from '@/stores/auth'
import { useAIStore } from '@/stores/ai'
import type { Thread, Message } from '@/types'

export function useAI() {
  const token = useAuthStore((s) => s.session?.access_token ?? '')
  const store = useAIStore()

  return {
    ...store,
    analyze: (threads: Thread[]) => store.analyzeThreads(threads, token),
    reply: (thread: Thread, messages: Message[]) => store.generateReply(thread, messages, token),
    macros: (thread: Thread) => store.suggestMacros(thread, token),
    translate: (msgId: string, text: string) => store.translateMessage(msgId, text, token),
    detect: (text: string) => store.detectLanguage(text, token),
  }
}
```

- [ ] **Step 3: Create hooks/use-inbox-shortcuts.ts**

```typescript
'use client'

import { useEffect } from 'react'
import { useInboxStore } from '@/stores/inbox'
import { useAuthStore } from '@/stores/auth'

export function useInboxShortcuts(composerRef?: React.RefObject<HTMLElement | null>) {
  const threads = useInboxStore((s) => s.threads)
  const selectedThreadId = useInboxStore((s) => s.selectedThreadId)
  const selectThread = useInboxStore((s) => s.selectThread)
  const token = useAuthStore((s) => s.session?.access_token ?? '')

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger when typing in inputs
      const tag = (e.target as HTMLElement).tagName
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || (e.target as HTMLElement).isContentEditable) return

      if (e.key === 'j' || e.key === 'k') {
        e.preventDefault()
        const idx = threads.findIndex(t => t.id === selectedThreadId)
        const next = e.key === 'j' ? Math.min(idx + 1, threads.length - 1) : Math.max(idx - 1, 0)
        if (threads[next] && threads[next].id !== selectedThreadId) {
          selectThread(threads[next], token)
        }
      }

      if (e.key === 'r') {
        e.preventDefault()
        composerRef?.current?.focus()
      }

      if (e.key === 'Escape') {
        // Close macro panel / customer sheet — handled by dispatching a custom event
        // that the relevant components listen for
        window.dispatchEvent(new CustomEvent('inbox:escape'))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [threads, selectedThreadId, selectThread, token, composerRef])
}
```

---

## Task 6: Create Message Bubble Component

**Files:**
- Create: `components/features/inbox/message-bubble.tsx`

- [ ] **Step 1: Create message-bubble.tsx**

Props: `message: Message`, `translation?: string`, `onTranslate: (msgId: string, text: string) => void`

Three visual variants using Tailwind:
- **Inbound:** `items-start` alignment, `bg-card` background, left-aligned
- **Outbound:** `items-end` alignment, `bg-primary/5` background, right-aligned
- **System/note:** centered, muted text, italic

Content: uses `dangerouslySetInnerHTML` with `sanitizeHtml()` from `lib/inbox-utils.ts`.
Translate button: small text button below message that calls `onTranslate`. Shows translation below original when `translation` prop is set. Shows loading spinner when `translation === '__loading__'`.

Use shadcn `Button` (variant="ghost", size="sm") for translate button. Avatar uses `getInitials()` from `lib/inbox-utils.ts` with shadcn `Avatar`/`AvatarFallback`.

---

## Task 7: Create Notes Section Component

**Files:**
- Create: `components/features/inbox/notes-section.tsx`

- [ ] **Step 1: Create notes-section.tsx**

Props: `notes: Note[]`, `onAddNote: (text: string) => void`, `loading?: boolean`

- Collapsible section with chevron toggle (use local `useState` for collapsed)
- Header: "Internal Notes" + count badge + toggle chevron
- Note list: each note shows author, relative time, body text
- Add note: shadcn `Input` + shadcn `Button` ("Add Note")
- Uses `relTime()` from `lib/inbox-utils.ts`

---

## Task 8: Create Composer Component

**Files:**
- Create: `components/features/inbox/composer.tsx`

- [ ] **Step 1: Create composer.tsx**

This is the most complex component. Key structure:

Props: `threadId: string`, `threadEmail: string`, `onSend: (html: string) => Promise<boolean>`, `onSendResolve: (html: string) => Promise<void>`, `onMacroTrigger: () => void`

Internal state:
- `composerTab: 'reply' | 'note'` (shadcn `Tabs`)
- `attachments: { name: string; size: number }[]`
- `showEmoji: boolean`

Tiptap setup:
```typescript
const editor = useEditor({
  extensions: [
    StarterKit,
    Link.configure({ openOnClick: false }),
    Image,
    Placeholder.configure({ placeholder: 'Type your reply...' }),
  ],
  content: '',
})
```

Toolbar: row of shadcn `Button` (variant="ghost", size="icon") — Bold, Italic, Underline, Link, Image, Emoji.
Each button: `editor?.chain().focus().toggleBold().run()` etc.

Emoji picker: shadcn `Popover` containing a grid of `EMOJIS` from `lib/inbox-utils.ts`. Click inserts via `editor?.commands.insertContent(emoji)`.

Translation toggle bar: shown when `useAIStore().customerLang` is set. Toggle `autoTranslate` via AI store.

Action bar:
- Macro button (Lucide `Zap` icon) → calls `onMacroTrigger`
- AI Reply button → `useAI().reply()` → inserts result via `editor?.commands.setContent()`
- Send button → `onSend(editor?.getHTML())`
- Send & Resolve button → `onSendResolve(editor?.getHTML())`

Expose `insertContent(html: string)` method via `useImperativeHandle` for macro insertion from parent.

---

## Task 9: Create Thread Row Component

**Files:**
- Create: `components/features/inbox/thread-row.tsx`

- [ ] **Step 1: Create thread-row.tsx**

Props: `thread: Thread`, `isActive: boolean`, `urgency?: { urgency: string; score: number }`, `checked: boolean`, `onCheck: (id: string) => void`, `onClick: (thread: Thread) => void`

Layout: flex row with shadcn `Checkbox`, `Avatar`/`AvatarFallback` with initials, sender name + relative time, subject line, snippet (truncated), urgency dot+label.

Active state: `bg-primary/5 border-l-2 border-primary`
Urgency badge: colored dot (critical=red, high=amber, medium=blue, low=zinc) + small label text.

Uses `relTime()`, `getInitials()` from `lib/inbox-utils.ts`.

---

## Task 10: Create Thread List Component

**Files:**
- Create: `components/features/inbox/thread-list.tsx`

- [ ] **Step 1: Create thread-list.tsx**

Props: `onThreadSelect: (thread: Thread) => void`

Reads from stores: `useInboxStore` (threads, activeFolder, counts, search, checkedThreads, loadingThreads, syncing), `useAIStore` (analyses)

Structure:
- Header: "Inbox" title + sync button (Lucide `RefreshCw`, spinning when `syncing`)
- Folder tabs: shadcn `Tabs` with 5 tabs (open/pending/resolved/unlinked/trash), each with badge count
- `SearchInput` from `@/components/shared/search-input`
- Bulk select bar: shown when any threads checked. "Select all" checkbox + action buttons (move to folder dropdown)
- Thread list: `ScrollArea` containing sorted `ThreadRow` components
- Sort: by urgency score DESC, then by date DESC
- Empty state: `EmptyState` when no threads
- Loading state: `LoadingState` variant="table"

---

## Task 11: Create Order Card & Order Modals

**Files:**
- Create: `components/shared/order-card.tsx`
- Create: `components/shared/modals/refund-modal.tsx`
- Create: `components/shared/modals/cancel-modal.tsx`
- Create: `components/shared/modals/duplicate-modal.tsx`
- Create: `components/shared/modals/edit-address-modal.tsx`
- Create: `components/shared/modals/fulfill-modal.tsx`
- Create: `components/shared/modals/note-modal.tsx`

- [ ] **Step 1: Create order-card.tsx**

Props: `order: ShopifyOrder`, `token: string`, `onSuccess: (msg: string) => void`

Expandable card using local `useState` for expanded state and expanded sub-sections. Uses shadcn `Card`, `Badge` (via `StatusBadge`), `Button`, `Separator`.

Header (always visible): order name (#1234), date, financial + fulfillment status badges, total price.
Expanded: line items table, shipping address, tracking info, action buttons.
Action buttons: Refund, Cancel, Duplicate, Edit Address, Fulfill, Note — each opens its respective modal via local `useState`.

- [ ] **Step 2: Create all 6 order modals**

All modals follow the same pattern:
- Use shadcn `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter`
- Props: `open: boolean`, `onOpenChange: (open: boolean) => void`, `order: ShopifyOrder`, `token: string`, `onSuccess: (msg: string) => void`
- Internal state for form fields + loading/error
- Submit handler: calls the appropriate Shopify API endpoint via `authFetch`, shows success/error, calls `onSuccess`

Port the exact form fields and API calls from the current `page.js`:
- **RefundModal:** line items with checkboxes + quantities, full refund toggle, custom amount input, reason select (`REFUND_REASONS`), restock checkbox. API: POST `/api/shopify/orders/{id}/refund`
- **CancelModal:** reason select (`CANCEL_REASONS`), restock checkbox, notify checkbox, refund checkbox. API: POST `/api/shopify/orders/{id}/cancel`
- **DuplicateModal:** discount percentage input, preview total. API: POST `/api/shopify/orders/{id}/duplicate`
- **EditAddressModal:** address form fields. API: PUT `/api/shopify/orders/{id}/address`
- **FulfillModal:** tracking number input, carrier select, notify checkbox. API: POST `/api/shopify/orders/{id}/fulfill`
- **NoteModal:** textarea for note. API: PUT `/api/shopify/orders/{id}/note`

Use shadcn `Input`, `Select`, `Checkbox`, `Label`, `Button` throughout. Use `fmtPrice()` from `lib/inbox-utils.ts`.

---

## Task 12: Create Customer Panel Component

**Files:**
- Create: `components/features/inbox/customer-panel.tsx`

- [ ] **Step 1: Create customer-panel.tsx**

Props: none (reads from `useInboxStore`)

Reads: `customer`, `loadingCustomer` from inbox store. Uses `useInbox().custSearch()` for search.

Structure:
- Search: `SearchInput` with submit handler that calls `custSearch(query)`
- Loading: `LoadingState` variant="cards"
- Empty: `EmptyState` when no customer
- Customer card: Avatar + name, email (clickable mailto), phone, primary address
- Stats row: 3 `StatCard`-style displays (orders count, total spent, member since)
- Tabs: shadcn `Tabs` — "Orders" / "Info"
- Orders tab: list of `OrderCard` components
- Info tab: addresses list, additional details

Uses `fmtDate()`, `fmtPrice()` from `lib/inbox-utils.ts`.

---

## Task 13: Create Macro Panel & Macro Manager

**Files:**
- Create: `components/features/inbox/macro-panel.tsx`
- Create: `components/features/inbox/macro-manager.tsx`

- [ ] **Step 1: Create macro-panel.tsx**

Props: `onInsert: (content: string) => void`, `onClose: () => void`, `onManage: () => void`

Fetches macros from `/api/macros` via `authFetch`. Stores in local state.

Structure:
- Header: "Macros" + close button + "Manage" link
- Search input (filters macros by name/tag)
- Favorites section: macros where `id` is in favorites list (stored in local state, loaded from localStorage `lynq_macro_favs`)
- All macros section: filtered list
- AI suggestions section: reads `aiMacros` from AI store
- Each macro row: name, tags, star toggle, click → `onInsert(macro.content || macro.body)`

- [ ] **Step 2: Create macro-manager.tsx**

Props: `open: boolean`, `onOpenChange: (open: boolean) => void`

Full-screen overlay using shadcn `Dialog`. Two-column layout:
- Left: macro list with search, filter by tag, filter by language, archive toggle. Each row is selectable.
- Right: macro editor form — name input, content textarea, tags input, language select, variables display. Save/Delete buttons.

CRUD via `/api/macros` endpoints:
- GET `/api/macros` — list
- POST `/api/macros` — create
- PUT `/api/macros/{id}` — update
- DELETE `/api/macros/{id}` — delete (or archive)

---

## Task 14: Create Conversation View Component

**Files:**
- Create: `components/features/inbox/conversation-view.tsx`

- [ ] **Step 1: Create conversation-view.tsx**

Props: none (reads from stores)

This is the main center panel. Reads from: `useInboxStore` (selectedThreadId, threads, messages, notes, loadingMessages), `useAIStore` (translations), `useTicketMetaStore` (getMeta).

Structure:
- **No thread selected:** `EmptyState` with "Select a conversation" message
- **Loading:** `LoadingState` variant="page"
- **Header:** flex row with:
  - Subject line (h2)
  - Status dropdown: shadcn `DropdownMenu` with status options (open/pending/resolved/closed). Uses `StatusBadge` for current status display. Change triggers `inboxStore.updateStatus()`
  - Customer info button (mobile/tablet): opens customer panel sheet
- **Ticket action bar:** Tags as shadcn `Badge` with X remove button + "Add tag" button (prompt). Assignee, Contact Reason, Product, Resolution — each as small labeled field with edit button (prompt-based for now). Reads/writes via `useTicketMetaStore`.
- **Messages area:** `ScrollArea` with `MessageBubble` components. Auto-scroll to bottom via `useEffect` + `useRef`.
- **Notes section:** `NotesSection` component
- **Composer:** `Composer` component with `MacroPanel` conditionally rendered alongside

Uses local `useState` for: `showMacros`, `showMacroManager`

---

## Task 15: Create Inbox Page with Responsive Layout

**Files:**
- Create: `app/inbox/page.tsx`

- [ ] **Step 1: Create page.tsx**

This replaces the entire `app/inbox/page.js`. Structure:

```typescript
'use client'

import { Suspense, useEffect, useState } from 'react'
import { useMediaQuery } from '@/hooks/use-media-query'
import { useAuthStore } from '@/stores/auth'
import { useInboxStore } from '@/stores/inbox'
import { useInboxShortcuts } from '@/hooks/use-inbox-shortcuts'
import { AppShell } from '@/components/layout/app-shell'
import { ThreadList } from '@/components/features/inbox/thread-list'
import { ConversationView } from '@/components/features/inbox/conversation-view'
import { CustomerPanel } from '@/components/features/inbox/customer-panel'
import { EmptyState } from '@/components/shared/empty-state'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { User, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
```

**Wrapper component:** checks email connection (same logic as current `InboxPageWrapper`). If not connected, shows `EmptyState` with link to `/settings/integrations/email`.

**Main InboxPage:**
- On mount: loads conversations, fetches counts, triggers sync
- Uses `useInboxShortcuts()`
- Responsive layout via `useMediaQuery`:

**Desktop (≥ 1024px):**
```tsx
<AppShell>
  <div className="flex h-screen">
    <div className="w-[280px] border-r border-border"><ThreadList /></div>
    <div className="flex-1"><ConversationView /></div>
    <div className="w-[320px] border-l border-border"><CustomerPanel /></div>
  </div>
</AppShell>
```

**Tablet (768–1023px):**
```tsx
<AppShell>
  <div className="flex h-screen">
    <div className="w-[260px] border-r border-border"><ThreadList /></div>
    <div className="flex-1"><ConversationView /></div>
    <Sheet open={customerOpen} onOpenChange={setCustomerOpen}>
      <SheetContent side="right"><CustomerPanel /></SheetContent>
    </Sheet>
  </div>
</AppShell>
```

**Mobile (< 768px):**
```tsx
<AppShell>
  {activePanel === 'threads' ? (
    <ThreadList onThreadSelect={() => setActivePanel('conversation')} />
  ) : (
    <div className="flex h-screen flex-col">
      <div className="flex items-center gap-2 border-b p-3">
        <Button variant="ghost" size="icon" onClick={() => setActivePanel('threads')}>
          <ArrowLeft size={18} />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setCustomerOpen(true)}>
          <User size={18} />
        </Button>
      </div>
      <ConversationView />
      <Sheet open={customerOpen} onOpenChange={setCustomerOpen}>
        <SheetContent side="right"><CustomerPanel /></SheetContent>
      </Sheet>
    </div>
  )}
</AppShell>
```

- [ ] **Step 2: Delete old page.js**

Delete `app/inbox/page.js` after verifying the new `page.tsx` works.

---

## Task 16: Verify Full Build & Functionality

**Files:** None (verification only)

- [ ] **Step 1: Run the build**

```bash
cd /Users/dendy/Documents/Work/lynq-dashboard && npm run build 2>&1 | tail -30
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 2: Manual smoke test**

Start dev server and verify:
- Thread list loads with folder tabs and counts
- Clicking a thread opens conversation with messages
- Reply composer works (Tiptap editor, formatting, send)
- Customer panel shows Shopify data
- Macros panel opens, search works, insertion works
- Status changes work (dropdown)
- Notes section works (add/view)
- Order actions work (refund, cancel, etc.)
- Keyboard shortcuts (j/k/r) work
- Responsive: tablet shows 2 panels, mobile shows single panel navigation
- Theme toggle works (light/dark)

- [ ] **Step 3: Fix any remaining issues**

Address any TypeScript errors, broken imports, or visual regressions.

---

## Summary

After completing all 16 tasks:

- **`app/inbox/page.js`** (2,927 lines) → deleted
- **`app/inbox/page.tsx`** (~80 lines) → clean composition
- **3 Zustand stores** (inbox, AI, ticket-meta) replace 44 useState hooks
- **9 feature components** in `components/features/inbox/`
- **7 shared components** (order card + 6 modals) in `components/shared/`
- **3 hooks** (use-inbox, use-ai, use-inbox-shortcuts)
- **1 utility file** (lib/inbox-utils.ts)
- **Tiptap** replaces custom rich text editor
- **All CSS-in-JS** → Tailwind + shadcn
- **Full TypeScript** with proper types
- **Responsive layout** (3-panel → 2-panel → single-panel)
