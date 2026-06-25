'use client'

import { useState, useMemo } from 'react'
import { Plus, Tag as TagIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SettingsPageHeader } from '@/components/features/settings/settings-header'
import { SettingsEmptyState } from '@/components/features/settings/settings-empty-state'
import { useTags, useDeleteTag } from '@/hooks/settings'
import { useAuthStore } from '@/stores/auth'
import { ConfirmDialog } from '@/components/features/settings/confirm-dialog'
import { TagsTable } from './tags-table'
import { TagsBulkBar } from './tags-bulk-bar'
import { TagEditModal } from './tag-edit-modal'
import type { Tag } from '@/types/settings'

export function TagsView() {
  const isSuspended = useAuthStore((s) => s.isSuspended)
  const { data: tags = [], isLoading } = useTags()
  const deleteTag = useDeleteTag()

  const [editTag, setEditTag] = useState<Tag | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null)

  // TODO: get role from auth context; for now assume manage+delete permissions
  const canManage = true
  const canDelete = true

  function handleEdit(tag: Tag) {
    setEditTag(tag)
    setEditOpen(true)
  }

  function confirmDelete() {
    if (!deleteTarget) return
    deleteTag.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    })
  }

  // "Create tag" lives in the full-width section header bar (Figma node 956-28805).
  const headerActions = useMemo(
    () =>
      canManage ? (
        <Button
          onClick={() => {
            setEditTag(null)
            setEditOpen(true)
          }}
          disabled={isSuspended}
        >
          <Plus size={16} strokeWidth={1.75} />
          Create tag
        </Button>
      ) : null,
    [isSuspended, canManage],
  )

  const isTrulyEmpty = !isLoading && tags.length === 0

  return (
    <div className="mx-auto flex min-h-full max-w-[800px] flex-col px-6 py-10">
      <SettingsPageHeader
        title="Manage tags"
        description="Tags help organize macros, tickets, and conversations."
        actions={headerActions}
      />

      {isTrulyEmpty ? (
        <div className="flex flex-1 items-center justify-center">
          <TagsEmptyState />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <TagsBulkBar tags={tags} canDelete={canDelete} />
          <TagsTable
            tags={tags}
            isLoading={isLoading}
            canManage={canManage}
            canDelete={canDelete}
            onEdit={handleEdit}
            onDelete={setDeleteTarget}
          />
        </div>
      )}

      <TagEditModal open={editOpen} onOpenChange={setEditOpen} tag={editTag} />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title={`Delete tag "${deleteTarget?.name}"?`}
        description={`This will remove "${deleteTarget?.name}" from ${deleteTarget?.usage_count ?? 0} item${deleteTarget?.usage_count === 1 ? '' : 's'}. This cannot be undone.`}
        confirmLabel="Delete tag"
        variant="danger"
        loading={deleteTag.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

/** Centered empty state when the workspace has no tags (Figma node 964-29596). */
function TagsEmptyState() {
  return (
    <div className="w-[440px] max-w-full rounded-2xl border bg-card px-10 py-9">
      <SettingsEmptyState
        Icon={TagIcon}
        title="No tags yet"
        description="Create tags to organize macros, tickets, and conversations."
      />
    </div>
  )
}
