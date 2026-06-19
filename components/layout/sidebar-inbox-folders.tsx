'use client'

import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { CountBadge } from '@/components/shared/count-badge'
import { useInboxUI } from '@/stores/inbox-ui'
import { useInboxCounts } from '@/hooks/inbox'
import { INBOX_FOLDERS } from '@/lib/inbox-constants'

/**
 * Inbox folder submenu (Figma 776-17288). Indented items with a vertical guide
 * line; switches the inbox folder via the shared store, reusing the same
 * INBOX_FOLDERS source as the inbox folder tabs. Visibility is controlled by
 * the parent (SidebarInboxItem) — this only renders the list.
 */
export function SidebarInboxFolders() {
  const pathname = usePathname()
  const router = useRouter()
  const activeFolder = useInboxUI((s) => s.activeFolder)
  const setActiveFolder = useInboxUI((s) => s.setActiveFolder)
  const setSelectedThreadId = useInboxUI((s) => s.setSelectedThreadId)
  const { data: counts } = useInboxCounts()

  const onInbox = pathname === '/inbox'

  function handleSelect(key: string) {
    setActiveFolder(key)
    setSelectedThreadId(null)
    if (!onInbox) router.push('/inbox')
  }

  return (
    <div className="relative flex flex-col gap-0.5 pb-1 pt-0.5 before:absolute before:bottom-1.5 before:left-[18px] before:top-1.5 before:w-px before:bg-border">
      {INBOX_FOLDERS.map((folder) => {
        const isActive = onInbox && activeFolder === folder.key
        const count = counts?.[folder.key as keyof typeof counts] ?? 0
        return (
          <button
            key={folder.key}
            type="button"
            onClick={() => handleSelect(folder.key)}
            className={cn(
              'flex h-8 items-center rounded-lg py-[7px] pl-[34px] pr-2.5 text-sm transition-colors',
              isActive
                ? 'font-medium text-foreground'
                : 'text-foreground-3 hover:bg-muted hover:text-foreground',
            )}
          >
            <span className="truncate">{folder.label}</span>
            <CountBadge count={count} className="px-1.5 text-[11px]" />
          </button>
        )
      })}
    </div>
  )
}
