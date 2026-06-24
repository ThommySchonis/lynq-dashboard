'use client'

import { useMemo, useState } from 'react'
import {
  Search,
  MoreHorizontal,
  Tag as TagIcon,
  Edit2,
  Trash2,
  Plus,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
  onCreate: () => void
}

export function TagsTable({
  tags,
  isLoading,
  canManage,
  canDelete,
  onEdit,
  onDelete,
  onCreate,
}: TagsTableProps) {
  const [search, setSearch] = useState('')
  const selectedTagIds = useSettingsUI((s) => s.selectedTagIds)
  const toggleTagSelection = useSettingsUI((s) => s.toggleTagSelection)
  const selectAllTags = useSettingsUI((s) => s.selectAllTags)
  const clearTagSelection = useSettingsUI((s) => s.clearTagSelection)

  const filtered = useMemo(
    () =>
      tags.filter(
        (t) =>
          !search || t.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [tags, search],
  )

  const allSelected = filtered.length > 0 && selectedTagIds.size === filtered.length
  const someSelected = selectedTagIds.size > 0 && !allSelected

  function handleToggleAll() {
    if (allSelected || someSelected) clearTagSelection()
    else selectAllTags(filtered.map((t) => t.id))
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
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
    )
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <TagIcon size={28} strokeWidth={1.5} />
        </div>
        <h3 className="text-base font-semibold">
          {search ? 'No tags match your search' : 'No tags yet'}
        </h3>
        <p className="max-w-xs text-sm text-muted-foreground">
          {search
            ? 'Try a different search term.'
            : 'Create your first tag to organize your content.'}
        </p>
        {!search && canManage && (
          <Button onClick={onCreate}>
            <Plus size={16} strokeWidth={1.75} />
            Create tag
          </Button>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="relative max-w-xs">
        <Search
          size={14}
          strokeWidth={1.75}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="text"
          placeholder="Search tags by name..."
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
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
                <TableRow
                  key={tag.id}
                  data-state={isSelected ? 'selected' : undefined}
                >
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
    </>
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
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Tag actions" />
        }
      >
        <MoreHorizontal size={16} strokeWidth={1.75} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit(tag)}>
          <Edit2 size={14} strokeWidth={1.75} />
          Edit
        </DropdownMenuItem>
        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onDelete(tag)}
            >
              <Trash2 size={14} strokeWidth={1.75} />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
