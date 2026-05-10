'use client'

import { useEffect, useRef, useState } from 'react'
import { MessageSquare, Tag, Plus, X, ChevronDown } from 'lucide-react'

import { useInboxStore } from '@/stores/inbox'
import { useAIStore } from '@/stores/ai'
import { useTicketMetaStore } from '@/stores/ticket-meta'
import { useInbox } from '@/hooks/inbox/use-inbox'
import { useAI } from '@/hooks/inbox/use-ai'
import { extractEmail } from '@/lib/inbox-utils'

import { MessageBubble, NoteBubble } from './message-bubble'
import { NotesSection } from './notes-section'
import { Composer, type ComposerHandle } from './composer'
import { MacroPanel } from './macro-panel'
import { MacroManager } from './macro-manager'
import { EmptyState } from '@/components/shared/empty-state'
import { LoadingState } from '@/components/shared/loading-state'
import { StatusBadge } from '@/components/shared/status-badge'

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_OPTIONS = ['open', 'pending', 'resolved', 'closed'] as const

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConversationView() {
  const selectedThreadId = useInboxStore((s) => s.selectedThreadId)
  const threads = useInboxStore((s) => s.threads)
  const messages = useInboxStore((s) => s.messages)
  const notes = useInboxStore((s) => s.notes)
  const loadingMessages = useInboxStore((s) => s.loadingMessages)
  const addingNote = useInboxStore((s) => s.addingNote)

  const translations = useAIStore((s) => s.translations)
  const ai = useAI()

  const getMeta = useTicketMetaStore((s) => s.getMeta)
  const addTag = useTicketMetaStore((s) => s.addTag)
  const removeTag = useTicketMetaStore((s) => s.removeTag)
  const updateField = useTicketMetaStore((s) => s.updateField)

  const inbox = useInbox()

  const [showMacros, setShowMacros] = useState(false)
  const [showMacroManager, setShowMacroManager] = useState(false)

  const composerRef = useRef<ComposerHandle>(null)
  const scrollEndRef = useRef<HTMLDivElement>(null)

  // Current thread
  const thread = threads.find((t) => t.id === selectedThreadId) ?? null
  const meta = selectedThreadId ? getMeta(selectedThreadId) : null

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollEndRef.current) {
      scrollEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, notes])

  // ---- No thread selected ------------------------------------------------

  if (!selectedThreadId) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          icon={MessageSquare}
          title="Select a conversation"
          description="Choose a thread from the list to view messages."
        />
      </div>
    )
  }

  // ---- Loading -----------------------------------------------------------

  if (loadingMessages && messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingState variant="page" />
      </div>
    )
  }

  if (!thread) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          icon={MessageSquare}
          title="Thread not found"
          description="The selected conversation could not be found."
        />
      </div>
    )
  }

  // ---- Handlers ----------------------------------------------------------

  function handleStatusChange(newStatus: string) {
    if (!selectedThreadId) return
    inbox.status(selectedThreadId, newStatus)
  }

  function handleAddTag() {
    if (!selectedThreadId) return
    const tag = window.prompt('Enter tag name:')
    if (tag?.trim()) {
      addTag(selectedThreadId, tag.trim())
    }
  }

  function handleRemoveTag(tag: string) {
    if (!selectedThreadId) return
    removeTag(selectedThreadId, tag)
  }

  function handleEditField(field: 'assignee' | 'contactReason' | 'product' | 'resolution') {
    if (!selectedThreadId) return
    const labels: Record<string, string> = {
      assignee: 'Assignee',
      contactReason: 'Contact Reason',
      product: 'Product',
      resolution: 'Resolution',
    }
    const current = meta?.[field] ?? ''
    const value = window.prompt(`Enter ${labels[field]}:`, current)
    if (value !== null) {
      updateField(selectedThreadId, field, value.trim() || null)
    }
  }

  async function handleSend(html: string) {
    if (!selectedThreadId) return false
    return inbox.send(selectedThreadId, html)
  }

  async function handleSendResolve(html: string) {
    if (!selectedThreadId) return
    const ok = await inbox.send(selectedThreadId, html)
    if (ok) {
      inbox.status(selectedThreadId, 'resolved')
    }
  }

  function handleTranslate(msgId: string, text: string) {
    if (!text) {
      // Clear translation (show original) — not supported in store, so no-op
      return
    }
    ai.translate(msgId, text)
  }

  const threadEmail = extractEmail(thread.from) || thread.customer_email || thread.from_email || ''

  // Interleave messages and notes by date
  type TimelineItem =
    | { type: 'message'; data: (typeof messages)[number] }
    | { type: 'note'; data: (typeof notes)[number] }

  const timeline: TimelineItem[] = [
    ...messages.map((m) => ({ type: 'message' as const, data: m })),
    ...notes.map((n) => ({ type: 'note' as const, data: n })),
  ].sort((a, b) => {
    const dateA = 'sent_at' in a.data ? a.data.sent_at || a.data.created_at : a.data.created_at
    const dateB = 'sent_at' in b.data ? b.data.sent_at || b.data.created_at : b.data.created_at
    return new Date(dateA || '').getTime() - new Date(dateB || '').getTime()
  })

  // ---- Render ------------------------------------------------------------

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-background px-4 py-3">
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          {thread.subject}
        </h2>
        <span className="shrink-0 truncate text-xs text-muted-foreground">
          {threadEmail}
        </span>

        {/* Status dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button className="flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-muted">
                <StatusBadge status={thread.status} />
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </button>
            }
          />
          <DropdownMenuContent side="bottom" align="end">
            {STATUS_OPTIONS.map((s) => (
              <DropdownMenuItem
                key={s}
                onClick={() => handleStatusChange(s)}
                className="gap-2 capitalize"
              >
                <StatusBadge status={s} />
                {s}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Ticket action bar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-4 py-2">
        {/* Tags */}
        <div className="flex items-center gap-1.5">
          <Tag className="size-3.5 text-muted-foreground" />
          {meta?.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 px-2 py-0.5 text-xs">
              {tag}
              <button
                onClick={() => handleRemoveTag(tag)}
                className="ml-0.5 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-2.5" />
              </button>
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="xs"
            onClick={handleAddTag}
            className="gap-1 text-muted-foreground hover:text-foreground"
          >
            <Plus className="size-3" />
            <span className="text-[11px]">Add tag</span>
          </Button>
        </div>

        <Separator orientation="vertical" className="mx-1 h-4" />

        {/* Meta fields */}
        <MetaField
          label="Assignee"
          value={meta?.assignee}
          onEdit={() => handleEditField('assignee')}
        />
        <MetaField
          label="Contact Reason"
          value={meta?.contactReason}
          onEdit={() => handleEditField('contactReason')}
        />
        <MetaField
          label="Product"
          value={meta?.product}
          onEdit={() => handleEditField('product')}
        />
        <MetaField
          label="Resolution"
          value={meta?.resolution}
          onEdit={() => handleEditField('resolution')}
        />
      </div>

      {/* Messages area */}
      <ScrollArea className="flex-1 bg-muted/20">
        <div className="space-y-4 p-4">
          {timeline.map((item) => {
            if (item.type === 'message') {
              return (
                <MessageBubble
                  key={item.data.id}
                  message={item.data}
                  translation={translations[item.data.id]}
                  onTranslate={handleTranslate}
                />
              )
            }
            return (
              <NoteBubble
                key={item.data.id}
                body={item.data.body}
                authorName={item.data.author_name}
                createdAt={item.data.created_at}
              />
            )
          })}
          <div ref={scrollEndRef} />
        </div>
      </ScrollArea>

      {/* Notes section */}
      <NotesSection
        notes={notes}
        onAddNote={(text) => inbox.note(selectedThreadId, text)}
        loading={addingNote}
      />

      {/* Composer */}
      <Composer
        ref={composerRef}
        threadId={selectedThreadId}
        threadEmail={threadEmail}
        onSend={handleSend}
        onSendResolve={handleSendResolve}
        onMacroTrigger={() => setShowMacros((prev) => !prev)}
      />

      {/* Macro panel */}
      {showMacros && (
        <MacroPanel
          onInsert={(content) => {
            composerRef.current?.insertContent(content)
            setShowMacros(false)
          }}
          onClose={() => setShowMacros(false)}
          onManage={() => {
            setShowMacros(false)
            setShowMacroManager(true)
          }}
        />
      )}

      {/* Macro manager dialog */}
      {showMacroManager && (
        <MacroManager
          macros={[]}
          favs={[]}
          onClose={() => setShowMacroManager(false)}
          onSaveMacro={() => {}}
          onDeleteMacro={() => {}}
          onToggleFav={() => {}}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// MetaField — small labeled field with edit button
// ---------------------------------------------------------------------------

interface MetaFieldProps {
  label: string
  value: string | null | undefined
  onEdit: () => void
}

function MetaField({ label, value, onEdit }: MetaFieldProps) {
  return (
    <button
      onClick={onEdit}
      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-left transition-colors hover:bg-muted"
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}:
      </span>
      <span className="max-w-[120px] truncate text-xs text-foreground">
        {value || '—'}
      </span>
    </button>
  )
}
