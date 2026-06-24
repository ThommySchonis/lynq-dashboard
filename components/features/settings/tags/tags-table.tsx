'use client'

import { useMemo, useState } from 'react'
import { MoreHorizontal, Tag as TagIcon, Edit2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { SettingsSearchInput } from '@/components/features/settings/settings-search-input'
import { SettingsEmptyState } from '@/components/features/settings/settings-empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { useSettingsUI } from '@/stores/settings-ui'
import { paletteFor } from '@/lib/tags'
import type { Tag } from '@/types/settings'

interface TagsTableProps {
  tags: Tag[]
  isLoading: boolean
  canManage: boolean
  canDelete: boolean
  onEdit: (tag: Tag) => void
  onDelete: (tag: Tag) => void
}

export function TagsTable({
  tags,
  isLoading,
  canManage,
  canDelete,
  onEdit,
  onDelete,
}: TagsTableProps) {
  const [search, setSearch] = useState('')
  const selectedTagIds = useSettingsUI((s) => s.selectedTagIds)
  const toggleTagSelection = useSettingsUI((s) => s.toggleTagSelection)
  const selectAllTags = useSettingsUI((s) => s.selectAllTags)
  const clearTagSelection = useSettingsUI((s) => s.clearTagSelection)

  const filtered = useMemo(
    () => tags.filter((t) => !search || t.name.toLowerCase().includes(search.toLowerCase())),
    [tags, search],
  )

  const allSelected = filtered.length > 0 && selectedTagIds.size === filtered.length
  const someSelected = selectedTagIds.size > 0 && !allSelected

  function handleToggleAll() {
    if (allSelected || someSelected) clearTagSelection()
    else selectAllTags(filtered.map((t) => t.id))
  }

  return (
    <div className="flex flex-col gap-4">
      <SettingsSearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search tags by name…"
      />

      {isLoading ? (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <Table>
            <TableHeader className="bg-foreground/[0.02]">
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Tag</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {[0, 1, 2].map((i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-4 rounded" />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Skeleton className="h-2.5 w-2.5 rounded-full" />
                      <Skeleton className="h-3.5 w-24" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-3.5 w-8" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-6" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : filtered.length === 0 ? (
        <SettingsEmptyState
          Icon={TagIcon}
          title="No tags match your search"
          description="Try a different search term."
          className="rounded-2xl border bg-card py-16"
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <Table>
            <TableHeader className="bg-foreground/[0.02]">
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onCheckedChange={handleToggleAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Tag</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((tag) => {
                const palette = paletteFor(tag.color)
                const isSelected = selectedTagIds.has(tag.id)
                return (
                  <TableRow key={tag.id} data-state={isSelected ? 'selected' : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleTagSelection(tag.id)}
                        aria-label={`Select ${tag.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <span
                          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: palette.dot }}
                        />
                        <span className="font-medium">{tag.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {tag.usage_count > 0 ? (
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                          {tag.usage_count}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {canManage && (
                        <TagRowMenu
                          tag={tag}
                          canDelete={canDelete}
                          onEdit={onEdit}
                          onDelete={onDelete}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function TagRowMenu({
  tag,
  canDelete,
  onEdit,
  onDelete,
}: {
  tag: Tag
  canDelete: boolean
  onEdit: (tag: Tag) => void
  onDelete: (tag: Tag) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Tag actions" />}>
        <MoreHorizontal size={16} strokeWidth={1.75} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onEdit(tag)}>
          <Edit2 size={14} strokeWidth={1.75} />
          Edit
        </DropdownMenuItem>
        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => onDelete(tag)}>
              <Trash2 size={14} strokeWidth={1.75} />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
