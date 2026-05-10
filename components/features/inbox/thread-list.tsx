'use client'

import { useCallback } from 'react'
import { RefreshCw, Inbox, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SearchInput } from '@/components/shared/search-input'
import { EmptyState } from '@/components/shared/empty-state'
import { LoadingState } from '@/components/shared/loading-state'
import { ThreadRow } from './thread-row'
import { useInboxStore } from '@/stores/inbox'
import { useAIStore } from '@/stores/ai'
import { useInbox } from '@/hooks/inbox/use-inbox'
import type { Thread, InboxFolder } from '@/types'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FOLDERS: { value: InboxFolder; label: string }[] = [
  { value: 'open',      label: 'Open'      },
  { value: 'pending',   label: 'Pending'   },
  { value: 'resolved',  label: 'Resolved'  },
  { value: 'unlinked',  label: 'Unlinked'  },
  { value: 'trash',     label: 'Trash'     },
]

const MOVE_FOLDERS: { value: InboxFolder; label: string }[] = [
  { value: 'open',     label: 'Move to Open'     },
  { value: 'pending',  label: 'Move to Pending'  },
  { value: 'resolved', label: 'Move to Resolved' },
  { value: 'trash',    label: 'Move to Trash'    },
]

// ---------------------------------------------------------------------------
// Sort helper
// ---------------------------------------------------------------------------

function sortThreads(threads: Thread[], analyses: Record<string, { urgency: string; score: number }>): Thread[] {
  return [...threads].sort((a, b) => {
    const aScore = analyses[a.id]?.score ?? -1
    const bScore = analyses[b.id]?.score ?? -1
    if (bScore !== aScore) return bScore - aScore
    const aDate = new Date(a.last_message_at || a.date || a.created_at || 0).getTime()
    const bDate = new Date(b.last_message_at || b.date || b.created_at || 0).getTime()
    return bDate - aDate
  })
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ThreadListProps {
  onThreadSelect?: (thread: Thread) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ThreadList({ onThreadSelect }: ThreadListProps) {
  const threads        = useInboxStore((s) => s.threads)
  const activeFolder   = useInboxStore((s) => s.activeFolder)
  const counts         = useInboxStore((s) => s.counts)
  const search         = useInboxStore((s) => s.search)
  const checkedThreads = useInboxStore((s) => s.checkedThreads)
  const loadingThreads = useInboxStore((s) => s.loadingThreads)
  const syncing        = useInboxStore((s) => s.syncing)
  const selectedThreadId = useInboxStore((s) => s.selectedThreadId)

  const setSearch         = useInboxStore((s) => s.setSearch)
  const setActiveFolder   = useInboxStore((s) => s.setActiveFolder)
  const setCheckedThreads = useInboxStore((s) => s.setCheckedThreads)

  const analyses = useAIStore((s) => s.analyses)

  const inbox = useInbox()

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleFolderChange = useCallback((folder: string) => {
    const f = folder as InboxFolder
    setActiveFolder(f)
    inbox.load(f)
  }, [setActiveFolder, inbox])

  const handleSearch = useCallback((value: string) => {
    setSearch(value)
    inbox.load()
  }, [setSearch, inbox])

  const handleThreadClick = useCallback((thread: Thread) => {
    inbox.select(thread)
    onThreadSelect?.(thread)
  }, [inbox, onThreadSelect])

  const handleCheck = useCallback((id: string) => {
    setCheckedThreads(
      checkedThreads.has(id)
        ? new Set([...checkedThreads].filter((x) => x !== id))
        : new Set([...checkedThreads, id]),
    )
  }, [checkedThreads, setCheckedThreads])

  const handleSelectAll = useCallback((checked: boolean) => {
    setCheckedThreads(checked ? new Set(threads.map((t) => t.id)) : new Set())
  }, [threads, setCheckedThreads])

  const handleMoveChecked = useCallback(async (targetFolder: InboxFolder) => {
    for (const id of checkedThreads) {
      await inbox.status(id, targetFolder)
    }
    setCheckedThreads(new Set())
    inbox.load()
  }, [checkedThreads, inbox, setCheckedThreads])

  // -------------------------------------------------------------------------
  // Derived state
  // -------------------------------------------------------------------------

  const sorted = sortThreads(threads, analyses)
  const hasChecked = checkedThreads.size > 0
  const allChecked = threads.length > 0 && checkedThreads.size === threads.length
  const someChecked = checkedThreads.size > 0 && !allChecked

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">Inbox</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => inbox.sync()}
          disabled={syncing}
          aria-label="Sync inbox"
          className="size-8"
        >
          <RefreshCw
            size={15}
            className={cn('text-muted-foreground', syncing && 'animate-spin')}
          />
        </Button>
      </div>

      {/* Folder tabs */}
      <div className="border-b border-border overflow-x-auto scrollbar-none">
        <Tabs
          value={activeFolder}
          onValueChange={handleFolderChange}
        >
          <TabsList
            variant="line"
            className="h-auto w-max min-w-full justify-start rounded-none bg-transparent px-2 py-0"
          >
            {FOLDERS.map(({ value, label }) => {
              const count = counts[value] ?? 0
              return (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="shrink-0 gap-1.5 px-2 py-2.5 text-xs"
                >
                  {label}
                  {count > 0 && (
                    <Badge
                      variant="secondary"
                      className="h-4 min-w-4 rounded-full px-1 text-[10px]"
                    >
                      {count > 99 ? '99+' : count}
                    </Badge>
                  )}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </Tabs>
      </div>

      {/* Search */}
      <div className="border-b border-border px-3 py-2">
        <SearchInput
          placeholder="Search conversations…"
          value={search}
          onChange={handleSearch}
        />
      </div>

      {/* Bulk select bar */}
      {hasChecked && (
        <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
          <Checkbox
            checked={allChecked}
            onCheckedChange={(checked) => handleSelectAll(Boolean(checked))}
            aria-label="Select all threads"
            className={cn('shrink-0', someChecked && 'opacity-60')}
          />
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {checkedThreads.size} selected
          </span>
          <div className="flex shrink-0 items-center gap-1">
            {MOVE_FOLDERS.filter((f) => f.value !== activeFolder).map(({ value, label }) => (
              <Button
                key={value}
                variant="ghost"
                size="sm"
                onClick={() => handleMoveChecked(value)}
                className="h-7 px-2 text-xs"
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Thread list body */}
      <div className="min-h-0 flex-1 bg-background">
        {loadingThreads ? (
          <div className="p-4">
            <LoadingState variant="table" count={5} />
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={search ? FolderOpen : Inbox}
            title={search ? 'No results' : 'All clear'}
            description={
              search
                ? `No conversations match "${search}"`
                : `No ${activeFolder} conversations`
            }
          />
        ) : (
          <ScrollArea className="h-full">
            {sorted.map((thread) => (
              <ThreadRow
                key={thread.id}
                thread={thread}
                isActive={thread.id === selectedThreadId}
                urgency={analyses[thread.id]}
                checked={checkedThreads.has(thread.id)}
                onCheck={handleCheck}
                onClick={handleThreadClick}
              />
            ))}
          </ScrollArea>
        )}
      </div>
    </div>
  )
}
