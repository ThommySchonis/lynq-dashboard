'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  FileText,
  MoreHorizontal,
  Edit2,
  Copy,
  Archive,
  ArchiveRestore,
  Trash2,
} from 'lucide-react'
import { TableRow, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/features/settings/confirm-dialog'
import { paletteFor } from '@/lib/tags'
import { relativeTime } from '@/lib/macros'
import { MACRO_LANG_LABEL } from '@/lib/settings-constants'
import type { Macro, MacroTagObject } from '@/types/inbox'

interface MacroRowProps {
  macro: Macro
  canManage: boolean
  canDelete: boolean
  onDuplicate: (id: string) => void
  onArchive: (id: string) => void
  onRestore: (id: string) => void
  onDelete: (id: string) => void
}

export function MacroRow({
  macro,
  canManage,
  canDelete,
  onDuplicate,
  onArchive,
  onRestore,
  onDelete,
}: MacroRowProps) {
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const isArchived = !!macro.archived_at
  const usageCount = macro.usage_count ?? macro.usageCount ?? 0
  const timeLabel =
    macro.last_updated_relative ??
    relativeTime(macro.updated_at ?? macro.updatedAt) ??
    '--'

  // Prefer tagObjects (colored, from join) over legacy string array
  const tagObjs: MacroTagObject[] =
    Array.isArray(macro.tagObjects) && macro.tagObjects.length > 0
      ? macro.tagObjects
      : (macro.tags ?? []).map((name) => ({ name, color: 'slate' }))

  return (
    <>
      <TableRow className="group">
        {/* Name */}
        <TableCell>
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
              <FileText size={16} strokeWidth={1.75} className="text-muted-foreground" />
            </div>
            <button
              type="button"
              className="text-left text-sm font-medium text-foreground hover:text-primary"
              onClick={() =>
                router.push(`/settings/workspace/macros/${macro.id}`)
              }
            >
              {macro.name}
            </button>
          </div>
        </TableCell>

        {/* Tags */}
        <TableCell>
          {tagObjs.length === 0 ? (
            <span className="text-xs text-muted-foreground">--</span>
          ) : (
            <div className="flex flex-wrap items-center gap-1">
              {tagObjs.slice(0, 4).map((t, i) => {
                const p = paletteFor(t.color)
                return (
                  <span
                    key={t.id ?? `${t.name}-${i}`}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-px text-[11px] font-medium"
                    style={{ background: p.bg, color: p.text }}
                  >
                    <span
                      className="size-1.5 rounded-full"
                      style={{ background: p.dot }}
                    />
                    {t.name}
                  </span>
                )
              })}
              {tagObjs.length > 4 && (
                <span className="ml-1 text-[11px] text-muted-foreground">
                  +{tagObjs.length - 4}
                </span>
              )}
            </div>
          )}
        </TableCell>

        {/* Language */}
        <TableCell>
          <Badge variant="secondary" className="text-xs font-normal">
            {MACRO_LANG_LABEL[macro.language] ?? macro.language}
          </Badge>
        </TableCell>

        {/* Usage */}
        <TableCell>
          {usageCount > 0 ? (
            <Badge variant="secondary">{usageCount}</Badge>
          ) : (
            <span className="text-xs text-muted-foreground">0</span>
          )}
        </TableCell>

        {/* Last updated */}
        <TableCell>
          <span className="text-xs text-muted-foreground">{timeLabel}</span>
        </TableCell>

        {/* Actions */}
        <TableCell className="text-right">
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground"
                    aria-label="Macro actions"
                  />
                }
              >
                <MoreHorizontal size={16} strokeWidth={1.75} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={4}>
                <DropdownMenuItem
                  onClick={() =>
                    router.push(`/settings/workspace/macros/${macro.id}`)
                  }
                >
                  <Edit2 size={14} strokeWidth={1.75} />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDuplicate(macro.id)}>
                  <Copy size={14} strokeWidth={1.75} />
                  Duplicate
                </DropdownMenuItem>
                {isArchived ? (
                  <DropdownMenuItem onClick={() => onRestore(macro.id)}>
                    <ArchiveRestore size={14} strokeWidth={1.75} />
                    Restore
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => onArchive(macro.id)}>
                    <Archive size={14} strokeWidth={1.75} />
                    Archive
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 size={14} strokeWidth={1.75} />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </TableCell>
      </TableRow>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete "${macro.name}"?`}
        description="This permanently removes the macro from your workspace. This cannot be undone. If you might want it back later, archive it instead."
        confirmLabel="Delete macro"
        variant="danger"
        onConfirm={() => {
          onDelete(macro.id)
          setDeleteOpen(false)
        }}
      />
    </>
  )
}
