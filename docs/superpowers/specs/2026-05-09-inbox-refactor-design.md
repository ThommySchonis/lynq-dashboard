# Inbox Page Refactor — Design Spec

**Date:** 2026-05-09
**Scope:** Refactor the 2,927-line `app/inbox/page.js` monolith into focused components, Zustand stores, and shadcn UI — using the foundation layer established in the UI refactor foundation spec.
**Out of scope:** API routes, database schema changes, new features. Pure code-quality refactor + design refresh + responsive layout.

## Context

The inbox page is the largest and most complex UI in the app. It contains 44 useState hooks, 20+ inline sub-components, 6 Shopify modals, a full macro system, AI features (urgency analysis, reply generation, translation), a custom rich text composer, and ~500 lines of CSS-in-JS — all in a single file.

This refactor breaks it into ~25 focused files while preserving all existing functionality.

## Decisions

- **State management:** 3 new Zustand stores (inbox, AI, ticket-meta)
- **Macros:** Move from localStorage to server (API already exists at `/api/macros`)
- **Ticket metadata:** Zustand with persist middleware → localStorage (server migration later)
- **Rich text editor:** Replace custom `execCommand` approach with Tiptap
- **Order modals:** Extracted as shared components (reusable from other pages)
- **CSS:** All inline styles + CSS-in-JS → Tailwind classes + shadcn components
- **Responsive:** 3-panel desktop, 2-panel tablet, single-panel mobile
- **TypeScript:** Full conversion from `.js` to `.tsx`

## 1. File Structure

```
stores/
  inbox.ts                                — Conversations, folders, selected thread, messages, notes
  ai.ts                                   — Analyses, translations, language, AI loading states
  ticket-meta.ts                          — Tags, assignee, contact reason (persist to localStorage)

components/features/inbox/
  thread-list.tsx                          — Folder tabs + search + thread rows + bulk select
  thread-row.tsx                           — Single thread row (avatar, subject, snippet, urgency, checkbox)
  conversation-view.tsx                    — Message list + header + status dropdown
  message-bubble.tsx                       — Single message (inbound/outbound/note, translate button)
  composer.tsx                             — Tiptap editor + toolbar + send buttons + macro trigger
  customer-panel.tsx                       — Right panel: search, customer info, stats, orders
  notes-section.tsx                        — Collapsible internal notes + add input
  macro-panel.tsx                          — Macro search + favorites + AI suggestions + insert
  macro-manager.tsx                        — Full-screen macro CRUD overlay

components/shared/
  order-card.tsx                           — Expandable order display with action buttons
  modals/
    refund-modal.tsx                       — Shopify refund (items, full, custom)
    cancel-modal.tsx                       — Cancel order
    duplicate-modal.tsx                    — Duplicate as draft
    edit-address-modal.tsx                 — Edit shipping address
    fulfill-modal.tsx                      — Mark fulfilled with tracking
    note-modal.tsx                         — Edit order note

hooks/
  use-inbox.ts                             — Convenience selectors from inbox store
  use-ai.ts                                — AI action dispatchers

app/inbox/page.tsx                         — ~50 lines, composing components in PageShell
```

### What gets deleted
- `app/inbox/page.js` — replaced entirely by `app/inbox/page.tsx` + feature components

## 2. Zustand Stores

### `stores/inbox.ts`

```typescript
interface InboxState {
  // Thread list
  threads: Thread[]
  activeFolder: 'open' | 'pending' | 'resolved' | 'unlinked' | 'trash'
  counts: { open: number; pending: number; resolved: number; unlinked: number; trash: number }
  search: string
  loadingThreads: boolean
  syncing: boolean
  connectedEmail: string | null
  checkedThreads: Record<string, boolean>

  // Selected conversation
  selectedThreadId: string | null
  messages: Message[]
  notes: Note[]
  loadingMessages: boolean

  // Customer (right panel)
  customer: ShopifyCustomer | null
  loadingCustomer: boolean

  // Actions
  loadConversations: (token: string, folder?: string) => Promise<void>
  selectThread: (thread: Thread, token: string) => Promise<void>
  updateStatus: (id: string, status: string, token: string) => Promise<void>
  sendReply: (threadId: string, html: string, token: string) => Promise<void>
  addNote: (threadId: string, text: string, token: string) => Promise<void>
  setSearch: (query: string) => void
  setActiveFolder: (folder: string) => void
  triggerSync: (token: string) => Promise<void>
  fetchCounts: (token: string) => Promise<void>
  toggleThreadCheck: (id: string) => void
  clearChecked: () => void
  searchCustomer: (query: string, token: string) => Promise<void>
}
```

Replaces: `threads`, `selected`, `messages`, `notes`, `activeFolder`, `counts`, `search`, `loadingThreads`, `loadingMsgs`, `syncing`, `connectedEmail`, `customer`, `loadingCust`, `checkedThreads`, `reply`, `composerTab`, `sending`, `noteInput`, `addingNote`, `showNotes`, `custSearch`, `session` useState hooks.

### `stores/ai.ts`

```typescript
interface AIState {
  analyses: Record<string, { urgency: string; score: number; reason: string }>
  translations: Record<string, string>
  customerLang: { code: string; name: string } | null
  autoTranslate: boolean
  aiLoading: boolean
  aiMacros: Macro[]

  // Actions
  analyzeThreads: (threads: Thread[], token: string) => Promise<void>
  generateReply: (thread: Thread, messages: Message[], token: string) => Promise<string>
  suggestMacros: (thread: Thread, token: string) => Promise<void>
  translateMessage: (msgId: string, text: string, token: string) => Promise<void>
  detectLanguage: (text: string, token: string) => Promise<void>
  setAutoTranslate: (enabled: boolean) => void
}
```

Replaces: `aiLoading`, `analyses`, `autoTranslate`, `customerLang`, `msgTranslations`, `aiMacros` useState hooks.

### `stores/ticket-meta.ts`

```typescript
interface TicketMetaState {
  meta: Record<string, {
    tags: string[]
    assignee: string | null
    contactReason: string | null
    product: string | null
    resolution: string | null
  }>

  addTag: (threadId: string, tag: string) => void
  removeTag: (threadId: string, tag: string) => void
  updateField: (threadId: string, key: string, value: string | null) => void
}
```

Uses Zustand `persist` middleware with localStorage key `lynq_ticket_meta`.

## 3. Component Design

### Thread List (`components/features/inbox/thread-list.tsx`)

- Folder tabs with badge counts — shadcn `Tabs`
- `SearchInput` from shared components (already built in foundation)
- Scrollable list of `ThreadRow` items
- Bulk select bar: "Select all" checkbox + actions (mark read, assign, move)
- Reads from `useInboxStore` for threads, folder, counts
- Sorts threads by urgency score (from AI store) then by date

### Thread Row (`components/features/inbox/thread-row.tsx`)

- shadcn `Checkbox` + avatar initials + sender name + relative time
- Subject line + snippet (truncated)
- Urgency badge (colored dot + label) from AI store
- Active highlight when `selectedThreadId` matches
- Click → `inboxStore.selectThread()`

### Conversation View (`components/features/inbox/conversation-view.tsx`)

- Header: subject, status dropdown (shadcn `DropdownMenu`), ticket action bar
- Ticket action bar: tags (shadcn `Badge`), assignee, contact reason, product, resolution — from ticket-meta store
- Scrollable message list with `MessageBubble` components
- `NotesSection` (collapsible)
- `Composer` at bottom
- Auto-scrolls to bottom on new messages

### Message Bubble (`components/features/inbox/message-bubble.tsx`)

- Three visual variants:
  - Inbound: left-aligned, surface background
  - Outbound: right-aligned, primary/accent background
  - Note: centered, muted style with note icon
- Sender name + formatted timestamp
- HTML content rendered with `dangerouslySetInnerHTML` (sanitized)
- Translate button → `aiStore.translateMessage()`
- Shows translated text below original when available

### Composer (`components/features/inbox/composer.tsx`)

- Tab bar: Reply | Note (shadcn `Tabs`)
- "To:" field (read-only, shows thread email)
- Tiptap editor with toolbar:
  - Bold, Italic, Underline (from starter-kit)
  - Link insertion (dialog)
  - Image insertion
  - Emoji picker (shadcn `Popover` + emoji grid)
- Attachment bar (file chips with remove button)
- Translation toggle bar (visible when customer language detected)
- Action bar:
  - Macro button → toggles `MacroPanel`
  - AI Reply button → `aiStore.generateReply()` → inserts into editor
  - Send button → `inboxStore.sendReply()`
  - Send & Resolve button → send + update status + select next thread

### Customer Panel (`components/features/inbox/customer-panel.tsx`)

- Customer search input (email or order number)
- Customer info card: name, email, phone, address
- Stats row: total orders, total spend, last order date
- Tabs: "Shopify" / "Info" (shadcn `Tabs`)
- List of `OrderCard` components (expandable)
- `LoadingState` / `EmptyState` from shared components

### Notes Section (`components/features/inbox/notes-section.tsx`)

- Collapsible section (shadcn pattern with chevron toggle)
- List of notes with author + timestamp
- Add note input + submit button
- Reads/writes via `inboxStore`

### Macro Panel (`components/features/inbox/macro-panel.tsx`)

- Search input
- Favorites section (starred macros)
- All macros list (filtered by search)
- AI suggestions section (from AI store)
- Click macro → inserts content into Tiptap editor via callback prop
- "Manage macros" link → opens MacroManager

### Macro Manager (`components/features/inbox/macro-manager.tsx`)

- Full-screen overlay (shadcn `Dialog` fullscreen)
- Left: macro list with filters (by tag, language), archive toggle
- Right: macro editor (name, content, tags, language, variables)
- CRUD operations via `/api/macros` endpoints
- Archive/restore functionality

### Order Card (`components/shared/order-card.tsx`)

- Expandable card: order number, date, status badges, total
- Expanded sections: items list, shipping info, tracking, timeline
- Action buttons trigger shared modals (refund, cancel, duplicate, edit address, fulfill, note)

### Order Action Modals (`components/shared/modals/`)

All modals use shadcn `Dialog` and follow the same pattern:
- Props: `open`, `onOpenChange`, `order`, `token`, `onSuccess`
- `onSuccess` callback refreshes customer data + shows toast

**Refund modal:** Item checkboxes with quantities, full refund toggle, custom amount, reason select, restock checkbox
**Cancel modal:** Reason select, restock checkbox, notify customer checkbox, refund checkbox
**Duplicate modal:** Discount percentage input, preview total
**Edit address modal:** Address form fields (name, address1, address2, city, province, zip, country)
**Fulfill modal:** Tracking number input, carrier select, notify customer checkbox
**Note modal:** Textarea for internal Shopify order note

## 4. Responsive Layout

### Desktop (≥ 1024px) — 3 panels
```
┌────────────┬──────────────────────┬──────────────┐
│ ThreadList  │ ConversationView     │ CustomerPanel│
│ (280px)     │ (flex-1)             │ (320px)      │
└────────────┴──────────────────────┴──────────────┘
```

### Tablet (768–1023px) — 2 panels + Sheet
```
┌────────────┬──────────────────────────────────────┐
│ ThreadList  │ ConversationView                     │
│ (260px)     │ (flex-1)  [customer icon → Sheet]    │
└────────────┴──────────────────────────────────────┘
```
Customer panel opens as a shadcn `Sheet` from the right, triggered by an icon button in the conversation header.

### Mobile (< 768px) — Single panel navigation
```
Step 1: ThreadList (full width)
Step 2: → tap thread → ConversationView (full width) + back button
Step 3: → tap customer icon → CustomerPanel as Sheet
```

Uses `use-media-query` hook for breakpoint detection. Mobile navigation uses local state for `activePanel: 'threads' | 'conversation'`.

## 5. Tiptap Integration

### Packages
- `@tiptap/react` — React bindings
- `@tiptap/starter-kit` — Bold, italic, strike, headings, lists, code, blockquote
- `@tiptap/extension-link` — Clickable/editable links
- `@tiptap/extension-image` — Inline images
- `@tiptap/extension-placeholder` — "Type your reply..." placeholder

### Editor setup
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

### Toolbar
Row of shadcn `Button` (variant="ghost", size="icon-sm") for formatting actions. Each button calls `editor.chain().focus().toggleBold().run()` etc.

### Macro insertion
`editor.commands.insertContent(macroHtml)` — directly into Tiptap, no DOM hacking.

### Output
`editor.getHTML()` for reply body sent to API.

## 6. Keyboard Shortcuts

Preserved from current implementation:
- `j` / `k` — navigate threads up/down
- `r` — focus reply composer
- `Escape` — close macro panel / customer sheet

Implemented via `useEffect` keydown listener in the inbox page component.

## 7. Types

New types in `types/inbox.ts`:

```typescript
interface Thread {
  id: string
  subject: string
  snippet: string
  from_email: string
  from_name: string
  status: 'open' | 'pending' | 'resolved' | 'unlinked' | 'trash'
  created_at: string
  updated_at: string
  unread: boolean
}

interface Message {
  id: string
  thread_id: string
  from_email: string
  from_name: string
  body_html: string
  direction: 'inbound' | 'outbound'
  created_at: string
}

interface Note {
  id: string
  thread_id: string
  body: string
  author_name: string
  created_at: string
}

interface ShopifyCustomer {
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

interface ShopifyOrder {
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

interface Macro {
  id: string
  name: string
  content: string
  tags: string[]
  language: string
  variables: string[]
  archived: boolean
  created_at: string
}
```

## 8. Migration Strategy

### What changes
- `app/inbox/page.js` → deleted, replaced by `app/inbox/page.tsx` (~50 lines)
- All 44 useState hooks → 3 Zustand stores
- All 20+ inline components → separate files
- ~500 lines CSS-in-JS → Tailwind classes
- Custom rich text → Tiptap
- Macros: localStorage → server API
- Inline styles → Tailwind + shadcn

### What stays the same
- All API endpoints (no backend changes)
- All user-facing functionality
- Keyboard shortcuts
- Folder system (open/pending/resolved/unlinked/trash)
- AI features (urgency, reply, translation, macro suggestions)

### Backward compatibility
- The old `page.js` is fully replaced (no coexistence needed)
- Ticket metadata migrates automatically (same localStorage key, Zustand persist reads it)
- Macro data migrates from localStorage to server on first load (fetch from API, if empty seed from localStorage, then clear localStorage)
